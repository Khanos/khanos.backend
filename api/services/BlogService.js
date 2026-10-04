import BlogPostModel from '../models/BlogPostModel.js';
import ApiError from '../utils/ApiError.js';
import { blogInput, preparedPost } from '../utils/blog.js';

const missing = () => new ApiError(404, 'BLOG_NOT_FOUND', 'Blog post not found');
export function postDto(record, detail = false) {
  const keys = ['slug', 'title', 'author', 'anonymous', 'excerpt', 'coverImage', 'categories', 'language', 'status', 'publishedAt', 'displayDate', 'readingMinutes', 'createdAt', 'updatedAt'];
  const summary = Object.fromEntries(keys.filter(key => record[key] !== undefined).map(key => [key, record[key]]));
  return { id: String(record._id), ...summary, ...(detail ? { content: record.content } : {}) };
}
export function createBlogService({ model = BlogPostModel, now = () => new Date(), log = () => {} } = {}) {
  async function database(operation, work) {
    try {
      const result = await work();
      log({ event: 'dependency', dependency: 'mongodb', operation, outcome: 'ok' });
      return result;
    } catch (error) {
      log({ event: 'dependency', dependency: 'mongodb', operation, outcome: 'failed' });
      if (error instanceof ApiError) throw error;
      if (error.code === 11000) throw new ApiError(409, 'DUPLICATE_BLOG_SLUG', 'Blog slug already exists');
      if (error.name === 'ValidationError') throw new ApiError(400, 'INVALID_BLOG_INPUT', 'Invalid blog input');
      throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Database unavailable');
    }
  }
  const published = () => ({ status: 'published', publishedAt: { $lte: now() } });
  async function listPosts({ language, category, page, limit, sort }, visibility, operation) {
    const filter = { ...visibility, ...(language ? { language } : {}), ...(category ? { categories: category } : {}) };
    return database(operation, async () => {
      const [records, total] = await Promise.all([
        model.find(filter, { content: 0, __v: 0 }).collation({ locale: 'simple' })
          .sort(sort === 'slug' ? { slug: 1 } : { [sort]: -1, slug: 1 })
          .skip((page - 1) * limit).limit(limit).lean(),
        model.countDocuments(filter),
      ]);
      return { data: records.map(record => postDto(record)), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
    });
  }
  return {
    async list(query) {
      return listPosts(query, published(), 'blog_list');
    },
    async listAdmin(query) {
      return listPosts(query, query.status ? { status: query.status } : {}, 'blog_admin_list');
    },
    async getAdmin(id) {
      return database('blog_admin_lookup', async () => {
        const record = await model.findById(id).lean();
        if (!record) throw missing();
        return postDto(record, true);
      });
    },
    async get(slug) {
      return database('blog_lookup', async () => {
        const record = await model.findOne({ slug, ...published() }).collation({ locale: 'simple' }).lean();
        if (!record) throw missing();
        return postDto(record, true);
      });
    },
    async create(input) {
      const data = preparedPost(input, now());
      return database('blog_create', async () => postDto((await model.create(data)).toObject(), true));
    },
    async update(id, input) {
      const patch = blogInput(input, true);
      return database('blog_update', async () => {
        const existing = await model.findById(id).lean();
        if (!existing) throw missing();
        const editable = { ...existing };
        for (const key of ['_id', '__v', 'createdAt', 'updatedAt', 'readingMinutes']) delete editable[key];
        // Recompute excerpts only if the caller changed content without supplying one.
        if ('content' in patch && !('excerpt' in patch)) delete editable.excerpt;
        if (editable.publishedAt) editable.publishedAt = editable.publishedAt.toISOString();
        const data = preparedPost({ ...editable, ...patch }, now());
        const updates = Object.fromEntries(Object.keys(patch).map(key => [key, data[key]]));
        if ('content' in patch) { updates.excerpt = data.excerpt; updates.readingMinutes = data.readingMinutes; }
        if (!existing.publishedAt && data.publishedAt) updates.publishedAt = data.publishedAt;
        const record = await model.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true }).lean();
        if (!record) throw missing();
        return postDto(record, true);
      });
    },
    async delete(id) {
      return database('blog_delete', async () => {
        const record = await model.findByIdAndDelete(id).lean();
        if (!record) throw missing();
        return { id: String(record._id) };
      });
    },
  };
}
