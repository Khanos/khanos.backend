import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/url-index-migration.js', import.meta.url));
it.each([{ args: [] }, { args: ['--apply'] }])('requires an explicit migration target instead of application DB settings %#', ({ args }) => {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 10000,
    env: { PATH: process.env.PATH, NODE_ENV: 'production', CONNECTION_URL: 'mongodb://127.0.0.1:1/unused', DB_NAME: 'unused' } });
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(JSON.parse(result.stderr)).toMatchObject({ code: 'MIGRATION_TARGET_REQUIRED', createdIndexes: [] });
});
it('rejects unrecognized arguments before connecting', () => {
  const result = spawnSync(process.execPath, [script, '--apply', '--force'], { encoding: 'utf8', timeout: 10000, env: { PATH: process.env.PATH } });
  expect(result.status).toBe(1);
  expect(JSON.parse(result.stderr).code).toBe('INVALID_MIGRATION_ARGUMENTS');
});
