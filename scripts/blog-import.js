import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import BlogPostModel from '../api/models/BlogPostModel.js';
import { readBlogSources } from './blog-source.js';
import { readUrlIndexes, requireBlogIndexes } from '../db.js';

/** Insert missing posts only. A rerun must never overwrite subsequent owner edits. */
export async function importBlog(model, posts, { apply = false } = {}) {
  const slugs = posts.map(post => post.slug);
  if (!posts.length || new Set(slugs).size !== posts.length) throw new Error('Invalid blog source set');
  const existing = await model.find({ slug: { $in: slugs } }).lean();
  const missing = posts.filter(post => !existing.some(record => record.slug === post.slug));
  const conflicts = existing.filter(record => {
    const source = posts.find(post => post.slug === record.slug);
    return Object.entries(source).some(([key, value]) => JSON.stringify(key === 'publishedAt' ? new Date(value) : value) !== JSON.stringify(record[key]));
  });
  const duplicateGroups = await model.aggregate([{ $group: { _id: '$slug', n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }]);
  const indexes = await readUrlIndexes(model.collection);
  const definitions = BlogPostModel.schema.indexes();
  const pending = definitions.filter(([key, options]) => !indexes.some(index =>
    JSON.stringify(index.key) === JSON.stringify(key) && !!index.unique === !!options.unique &&
    !index.sparse && !index.partialFilterExpression && (!index.collation || index.collation.locale === 'simple')));
  const indexConflict = pending.some(([key, options]) => indexes.some(index => index.name === options.name || JSON.stringify(index.key) === JSON.stringify(key)));
  const report = { mode: apply ? 'apply' : 'dry-run', sourcePosts: posts.length, existingPosts: existing.length,
    pendingPosts: missing.length, conflictingPosts: conflicts.map(post => post.slug),
    pendingIndexes: pending.map(([, options]) => options.name),
    blockedBy: duplicateGroups.length || conflicts.length ? 'BLOG_DATA_CONFLICT' : indexConflict ? 'BLOG_INDEX_CONFLICT' : null };
  if (!apply || report.blockedBy) return report;
  for (const [key, options] of pending) await model.collection.createIndex(key, { ...options, maxTimeMS: 30000 });
  let importedPosts = 0;
  for (const post of missing) {
    // setOnInsert + unique index makes interruption/concurrent retries safe.
    const timestamp = new Date();
    const result = await model.updateOne({ slug: post.slug }, { $setOnInsert: { ...post, createdAt: timestamp, updatedAt: timestamp } },
      { upsert: true, runValidators: true, timestamps: false });
    importedPosts += result.upsertedCount;
  }
  await requireBlogIndexes(model.collection);
  const after = await importBlog(model, posts);
  if (after.pendingPosts || after.blockedBy) throw new Error('Blog import verification failed');
  return { ...report, importedPosts, verifiedPosts: after.existingPosts };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => !['--apply', '--source-check'].includes(arg)) || args.length > 1) throw new Error('Invalid arguments');
    const posts = await readBlogSources();
    if (args[0] === '--source-check') {
      console.log(JSON.stringify({ sourcePosts: posts.length, slugs: posts.map(post => post.slug) }));
    } else {
      if (!/^mongodb(?:\+srv)?:\/\//.test(process.env.MIGRATION_MONGODB_URI || '') ||
          !/^[a-z\d_-]{1,63}$/i.test(process.env.MIGRATION_DB_NAME || '')) throw new Error('Explicit migration target required');
      await mongoose.connect(process.env.MIGRATION_MONGODB_URI, { dbName: process.env.MIGRATION_DB_NAME,
        autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000, socketTimeoutMS: 35000 });
      const report = await importBlog(BlogPostModel, posts, { apply: args[0] === '--apply' });
      console.log(JSON.stringify(report));
      if (report.blockedBy) process.exitCode = 2;
    }
  } catch {
    console.error(JSON.stringify({ error: 'Blog import failed. Check source files, explicit migration target and database availability.' }));
    process.exitCode = 1;
  } finally { await mongoose.disconnect(); }
}
