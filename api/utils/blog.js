import ApiError from './ApiError.js';

export const BLOG_SLUG = /^(en|es)\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const invalid = () => new ApiError(400, 'INVALID_BLOG_INPUT', 'Invalid blog input');
const text = (value, max, empty = false) => typeof value === 'string' && value.length <= max && (empty || value.trim().length > 0);
const fields = ['slug', 'title', 'author', 'anonymous', 'excerpt', 'content', 'coverImage', 'categories', 'language', 'status', 'publishedAt', 'displayDate'];
export function blogSlug(value) {
  if (typeof value !== 'string' || value.length > 200 || !BLOG_SLUG.test(value)) throw invalid();
  return value;
}
export function blogId(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{24}$/.test(value)) throw invalid();
  return value;
}
export function blogImage(value) {
  // eslint-disable-next-line no-control-regex
  if (typeof value !== 'string' || value.length > 2048 || /[\s\x00-\x1f\\]/.test(value)) return false;
  if (/^\/blog-assets\/[a-zA-Z0-9/_-]+\.(png|jpe?g|webp|gif)$/.test(value) && !value.includes('//')) return true;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
  catch { return false; }
}
export function blogDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.slice(0, 10);
}
/** Strict allowlist. Mongo operators and server-owned fields are never accepted. */
export function blogInput(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length ||
      Object.keys(body).some(key => !fields.includes(key))) throw invalid();
  const data = { ...body };
  if (!partial && ['slug', 'title', 'content', 'language', 'coverImage'].some(key => !(key in data))) throw invalid();
  for (const [key, max, empty] of [['title', 300, false], ['content', 80000, false], ['author', 200, true], ['excerpt', 1000, true], ['displayDate', 40, false]]) {
    if (key in data && !text(data[key], max, empty)) throw invalid();
  }
  if ('slug' in data) blogSlug(data.slug);
  if ('language' in data && !['en', 'es'].includes(data.language)) throw invalid();
  if ('slug' in data && 'language' in data && !data.slug.startsWith(`${data.language}/`)) throw invalid();
  if ('status' in data && !['draft', 'published'].includes(data.status)) throw invalid();
  if ('anonymous' in data && typeof data.anonymous !== 'boolean') throw invalid();
  if ('coverImage' in data && !blogImage(data.coverImage)) throw invalid();
  if ('publishedAt' in data && !blogDate(data.publishedAt)) throw invalid();
  if ('categories' in data && (!Array.isArray(data.categories) || data.categories.length > 20 ||
      data.categories.some(item => !text(item, 80)) || new Set(data.categories).size !== data.categories.length)) throw invalid();
  return data;
}
function listQuery(query, admin) {
  if (Object.keys(query).some(key => !['language', 'category', 'page', 'limit', 'sort', 'status'].includes(key))) throw invalid();
  const number = (value, fallback, max) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max) throw invalid();
    return Number(value);
  };
  const statuses = admin ? ['draft', 'published'] : ['published'];
  const sorts = admin ? ['updatedAt', 'publishedAt', 'createdAt', 'slug'] : ['slug', 'publishedAt'];
  if (query.status !== undefined && !statuses.includes(query.status)) throw invalid();
  if (query.language !== undefined && !['en', 'es'].includes(query.language)) throw invalid();
  if (query.category !== undefined && !text(query.category, 80)) throw invalid();
  if (query.sort !== undefined && !sorts.includes(query.sort)) throw invalid();
  return { language: query.language, category: query.category, page: number(query.page, 1, 1000),
    limit: number(query.limit, 25, 100), sort: query.sort || (admin ? 'updatedAt' : 'slug'),
    ...(admin ? { status: query.status } : {}) };
}
export function blogQuery(query) {
  return listQuery(query, false);
}
export function blogAdminQuery(query) {
  return listQuery(query, true);
}
export function articleText(body) {
  return body.replace(/```[\s\S]*?```/g, '').replace(/<[^>]*>/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+.*$/gm, '').replace(/[*_`>#]/g, '').replace(/\s+/g, ' ').trim();
}
export function preparedPost(data, now = new Date()) {
  const input = blogInput(data);
  const plain = articleText(input.content);
  return { ...input, status: input.status || 'draft', author: input.author || '', anonymous: input.anonymous ?? false,
    categories: input.categories || [], excerpt: input.excerpt || plain.slice(0, 400),
    readingMinutes: Math.max(1, Math.ceil(plain.split(/\s+/).length / 200)),
    ...(input.status === 'published' && !input.publishedAt ? { publishedAt: now.toISOString() } : {}) };
}
