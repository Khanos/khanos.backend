import mongoose from 'mongoose';
import { BLOG_SLUG, blogImage } from '../utils/blog.js';

const schema = new mongoose.Schema({
  slug: { type: String, required: true, maxlength: 200, match: BLOG_SLUG },
  title: { type: String, required: true, maxlength: 300 },
  author: { type: String, default: '', maxlength: 200 },
  anonymous: { type: Boolean, default: false },
  excerpt: { type: String, required: true, maxlength: 1000 },
  content: { type: String, required: true, maxlength: 80000 },
  coverImage: { type: String, required: true, validate: blogImage },
  categories: { type: [String], default: [] },
  language: { type: String, required: true, enum: ['en', 'es'] },
  status: { type: String, required: true, enum: ['draft', 'published'], default: 'draft' },
  publishedAt: Date,
  displayDate: { type: String, maxlength: 40 },
  readingMinutes: { type: Number, required: true, min: 1 },
}, { timestamps: true, collection: 'blogposts', autoIndex: false, autoCreate: false, bufferCommands: false });
schema.index({ slug: 1 }, { name: 'unique_blog_slug', unique: true, collation: { locale: 'simple' } });
schema.index({ status: 1, publishedAt: -1, slug: 1 }, { name: 'blog_publication' });
export default mongoose.model('BlogPostModel', schema);
