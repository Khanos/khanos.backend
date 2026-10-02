import { AsyncLocalStorage } from 'node:async_hooks';

export const requestContext = new AsyncLocalStorage();
// A strict allowlist prevents exception text, raw paths, headers and URLs from escaping.
const fields = ['event', 'requestId', 'method', 'route', 'status', 'durationMs',
  'dependency', 'operation', 'outcome', 'code'];
export function createLogger(sink = console.log) {
  return (record) => {
    const safe = { requestId: requestContext.getStore(), ...record };
    sink(JSON.stringify(Object.fromEntries(
      fields.filter(key => safe[key] !== undefined).map(key => [key, safe[key]])
    )));
  };
}
