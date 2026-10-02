import { positiveInteger } from '../utils/index.js';

function pagination(req) {
  return { page: positiveInteger(req.query.page, 1, 1000),
    perPage: positiveInteger(req.query.per_page, 30, 100) };
}
/** GitHub payloads retain their existing search-object / commit-array success shapes. */
export default function createGithubController(service) {
  return {
    /** GET /api/github/getCommits/:word: public commit-message phrase search. */
    async getCommits(req, res) {
      res.json(await service.getCommitsByWord(req.params.word, pagination(req), req.dependencySignal));
    },
    /** GET /api/github/getCommitsByRepoAndOwner/:owner/:repo. */
    async getCommitsByRepoAndOwner(req, res) {
      res.json(await service.getCommitsByRepoAndOwner(req.params.repo, req.params.owner, pagination(req), req.dependencySignal));
    },
  };
}
