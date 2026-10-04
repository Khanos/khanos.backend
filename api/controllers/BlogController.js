import { blogId, blogSlug, blogQuery, blogAdminQuery } from '../utils/blog.js';

export default function createBlogController(service) {
  const cache = res => res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
  return {
    async index(req, res) {
      const result = await service.list(blogQuery(req.query));
      cache(res);
      res.json(result);
    },
    async get(req, res) {
      const result = await service.get(blogSlug(req.params.slug));
      cache(res);
      res.json(result);
    },
    async adminIndex(req, res) {
      res.json(await service.listAdmin(blogAdminQuery(req.query)));
    },
    async adminGet(req, res) {
      res.json(await service.getAdmin(blogId(req.params.id)));
    },
    async create(req, res) { res.status(201).json(await service.create(req.body)); },
    async update(req, res) { res.json(await service.update(blogId(req.params.id), req.body)); },
    async delete(req, res) { res.json(await service.delete(blogId(req.params.id))); },
  };
}
