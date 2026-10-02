import ApiError from '../utils/ApiError.js';

function invalid() { throw new ApiError(400, 'INVALID_GITHUB_INPUT', 'Invalid GitHub parameter'); }
export function createGithubService({ baseUrl, timeoutMs, fetchImpl = fetch, log = () => {} }) {
  async function read(path, query, operation, signal) {
    const url = new URL(path, baseUrl);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    // One total deadline includes retries and response-body decoding.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const cancel = () => controller.abort();
    if (signal) {
      if (signal.aborted) cancel();
      signal.addEventListener('abort', cancel, { once: true });
    }
    const started = performance.now();
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        let response;
        try {
          response = await fetchImpl(url.href, { signal: controller.signal, redirect: 'error',
            headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
        } catch (error) {
          if (controller.signal.aborted) throw new ApiError(504, 'GITHUB_TIMEOUT', 'GitHub request timed out or cancelled');
          if (attempt === 0) continue;
          throw new ApiError(502, 'GITHUB_UNAVAILABLE', 'GitHub unavailable');
        }
        if (!response.ok) {
          // Do not consume or log provider error bodies, URLs or rate-limit metadata.
          if (response.body) await response.body.cancel();
          if ([502, 503, 504].includes(response.status) && attempt === 0) continue;
          if (response.status === 404) throw new ApiError(404, 'GITHUB_NOT_FOUND', 'GitHub resource not found');
          if ([403, 429].includes(response.status)) throw new ApiError(503, 'GITHUB_LIMITED', 'GitHub temporarily unavailable');
          throw new ApiError(502, 'GITHUB_UPSTREAM_ERROR', 'GitHub request failed');
        }
        const result = await response.json();
        if (operation === 'search' ? !result || !Array.isArray(result.items) || !Number.isInteger(result.total_count) || typeof result.incomplete_results !== 'boolean' : !Array.isArray(result)) {
          throw new ApiError(502, 'GITHUB_INVALID_RESPONSE', 'Invalid GitHub response');
        }
        log({ event: 'dependency', dependency: 'github', operation, outcome: 'ok', durationMs: Math.round(performance.now() - started) });
        return result;
      }
    } catch (error) {
      const failure = controller.signal.aborted ? new ApiError(504, 'GITHUB_TIMEOUT', 'GitHub request timed out or cancelled') :
        error instanceof ApiError ? error : new ApiError(502, 'GITHUB_INVALID_RESPONSE', 'Invalid GitHub response');
      log({ event: 'dependency', dependency: 'github', operation, outcome: 'failed', code: failure.code, durationMs: Math.round(performance.now() - started) });
      throw failure;
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', cancel);
    }
  }
  return {
    async getCommitsByWord(word, { page, perPage }, signal) {
      // Control characters and query quoting syntax cannot be search text.
      // eslint-disable-next-line no-control-regex
      if (typeof word !== 'string' || !word.trim() || word.length > 200 || /[\u0000-\u001f\u007f"\\]/.test(word)) invalid();
      return read('search/commits', { q: `"${word.trim()}"`, page, per_page: perPage }, 'search', signal);
    },
    async getCommitsByRepoAndOwner(repo, owner, { page, perPage }, signal) {
      if (typeof owner !== 'string' || !/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(owner) ||
          typeof repo !== 'string' || !/^[a-z\d_.-]{1,100}$/i.test(repo) || ['.', '..'].includes(repo)) invalid();
      return read(`repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits`,
        { page, per_page: perPage }, 'commits', signal);
    },
  };
}
