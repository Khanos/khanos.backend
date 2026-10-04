import { blogInput, blogQuery, blogAdminQuery, blogImage, blogDate, blogSlug, blogId, preparedPost, articleText } from '../../api/utils/blog.js';
const input = { slug: 'en/test', language: 'en', title: 'Test', content: 'Test body', coverImage: 'https://example.com/cover.jpg' };
it('prepares secure defaults and preserves explicitly supplied metadata', () => {
  expect(preparedPost(input)).toMatchObject({ status: 'draft', author: '', anonymous: false, excerpt: 'Test body', readingMinutes: 1, categories: [] });
  expect(preparedPost({ ...input, status: 'published' }, new Date('2026-01-01'))).toMatchObject({ publishedAt: '2026-01-01T00:00:00.000Z' });
  expect(preparedPost({ ...input, status: 'published', publishedAt: '2024-01-01', author: 'Writer', anonymous: true, categories: ['react'], excerpt: 'Summary', displayDate: '01/01/2024' })).toMatchObject({ author: 'Writer', excerpt: 'Summary' });
  expect(articleText('# Heading\n\nA [link](https://example.com) **here** ![img](x) <em>text</em>\n```js\ncode\n```')).toBe('A link here text');
  expect(preparedPost({ ...input, content: Array(201).fill('word').join(' ') }).readingMinutes).toBe(2);
});
it.each([null, undefined, [], {}, 'text', { ...input, $set: {} }, { title: 'missing required' },
  { ...input, title: '' }, { ...input, title: 42 }, { ...input, title: 'a'.repeat(301) },
  { ...input, content: '' }, { ...input, content: 'a'.repeat(80001) }, { ...input, author: 1 },
  { ...input, excerpt: null }, { ...input, displayDate: '' }, { ...input, anonymous: 'true' },
  { ...input, slug: 'es/test' }, { ...input, slug: 'invalid' }, { ...input, language: 'fr' },
  { ...input, status: 'private' }, { ...input, coverImage: 'javascript:alert(1)' },
  { ...input, publishedAt: '2026-02-31' }, { ...input, categories: null },
  { ...input, categories: Array(21).fill('tag') }, { ...input, categories: [''] }, { ...input, categories: ['tag', 'tag'] },
])('rejects invalid post input %p', value => { expect(() => blogInput(value)).toThrow(); });
it('accepts partial edits without requiring create fields', () => {
  expect(blogInput({ title: 'New title' }, true)).toEqual({ title: 'New title' });
  expect(blogInput({ author: '', excerpt: '', anonymous: false, categories: [] }, true)).toMatchObject({ author: '' });
});
it.each([null, 4, '', 'x'.repeat(201), 'en/UPPER', 'en/a/b'])('rejects invalid slugs %p', value => { expect(() => blogSlug(value)).toThrow(); });
it.each([null, 4, 'A'.repeat(24)])('rejects invalid IDs %p', value => { expect(() => blogId(value)).toThrow(); });
it.each([null, 4, 'javascript:alert(1)', 'http://example.com/a', 'https://user:pass@example.com/a', 'https://example.com/a b', 'not a url', '/blog-assets//images/a.jpg', '/blog-assets/../a.jpg', 'a'.repeat(2049), 'https://example.com/\\x'])('rejects unsafe images %p', value => { expect(blogImage(value)).toBe(false); });
it('accepts backend assets and absolute HTTPS images', () => {
  expect(blogImage('/blog-assets/images/test.png')).toBe(true);
  expect(blogImage('https://example.com/test.jpg')).toBe(true);
});
it.each([null, 4, '', 'invalid', '2026-02-31', '2026-99-01', '2026-01-01T99:00:00Z'])('rejects invalid dates %p', value => { expect(blogDate(value)).toBe(false); });
it('accepts real ISO UTC dates and timestamps', () => {
  expect(blogDate('2024-02-29')).toBe(true);
  expect(blogDate('2026-01-01T12:30:00Z')).toBe(true);
});
it('validates list defaults and explicit pagination/filtering', () => {
  expect(blogQuery({})).toEqual({ language: undefined, category: undefined, page: 1, limit: 25, sort: 'slug' });
  expect(blogQuery({ language: 'es', category: 'react', page: '2', limit: '100', sort: 'publishedAt', status: 'published' })).toMatchObject({ language: 'es', page: 2, limit: 100 });
});
it.each([{ status: 'draft' }, { language: 'fr' }, { language: ['en', 'es'] }, { category: {} }, { sort: 'bad' },
  { page: '0' }, { page: '1001' }, { page: [] }, { page: '1.5' }, { limit: '101' }, { $where: 'bad' }])('rejects invalid public queries %p', query => { expect(() => blogQuery(query)).toThrow(); });
it('validates admin defaults and filters without widening the public query contract', () => {
  expect(blogAdminQuery({})).toEqual({ language: undefined, category: undefined, status: undefined, page: 1, limit: 25, sort: 'updatedAt' });
  expect(blogAdminQuery({ status: 'draft', language: 'es', category: 'react', page: '2', limit: '100', sort: 'createdAt' }))
    .toEqual({ status: 'draft', language: 'es', category: 'react', page: 2, limit: 100, sort: 'createdAt' });
  for (const sort of ['updatedAt', 'createdAt']) expect(() => blogQuery({ sort })).toThrow();
});
it.each([{ status: '' }, { status: 'scheduled' }, { status: ['draft', 'published'] }, { status: { $ne: 'draft' } },
  { language: ['en'] }, { category: ['react'] }, { sort: ['slug'] }, { sort: { $gt: '' } }, { page: '01' },
  { page: '1e2' }, { limit: '0' }, { limit: { $gt: 0 } }, { $where: 'bad' }])('rejects invalid admin queries %p', query => {
  expect(() => blogAdminQuery(query)).toThrow();
});
