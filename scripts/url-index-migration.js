import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { isRequiredUrlIndex, readUrlIndexes, requireUrlIndexes } from '../db.js';
import { preflight } from './url-preflight.js';

const definitions = [
  { field: 'short_url', name: 'unique_short_code' },
  { field: 'original_url', name: 'unique_original_url' },
];
function failure(code) { const error = new Error('URL index migration could not be completed'); error.code = code; return error; }

/** Explicit operator operation. Default is read-only; no record updates or index drops. */
export async function migrateUrlIndexes(collection, { apply = false } = {}) {
  if (typeof apply !== 'boolean') throw failure('INVALID_MIGRATION_ARGUMENTS');
  const report = await preflight(collection);
  const indexes = await readUrlIndexes(collection);
  const pending = definitions.filter(({ field }) => !indexes.some(index => isRequiredUrlIndex(index, field)));
  const dataConflict = !!(report.invalidRecords || report.duplicateCodeGroups || report.duplicateOriginalGroups);
  // Existing field/name conflicts need an operator decision; never replace an index implicitly.
  const indexConflict = pending.some(({ field, name }) => indexes.some(index =>
    index.name === name || (Object.keys(index.key).length === 1 && index.key[field] !== undefined)));
  const blockedBy = dataConflict ? 'URL_MIGRATION_DATA_CONFLICT' : indexConflict ? 'URL_MIGRATION_INDEX_CONFLICT' : null;
  const plan = { ...report, pendingIndexes: pending.map(index => index.name), blockedBy, createdIndexes: [] };
  if (!apply) return { ...plan, mode: 'dry-run' };
  if (blockedBy) throw failure(blockedBy);
  const createdIndexes = [];
  try {
    for (const { field, name } of pending) {
      await collection.createIndex({ [field]: 1 }, { unique: true, name, collation: { locale: 'simple' }, maxTimeMS: 30000 });
      createdIndexes.push(name);
    }
    await requireUrlIndexes(collection);
    return { ...plan, mode: 'apply', requiredIndexesPresent: true, createdIndexes };
  } catch {
    const error = failure('URL_INDEX_BUILD_FAILED');
    error.createdIndexes = createdIndexes;
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length === 1 && args[0] !== '--apply')) throw failure('INVALID_MIGRATION_ARGUMENTS');
    // No dotenv, target fallback or startup integration. Credentials stay out of arguments/output.
    if (!/^mongodb(?:\+srv)?:\/\//.test(process.env.MIGRATION_MONGODB_URI || '') ||
        !/^[a-z\d_-]{1,63}$/i.test(process.env.MIGRATION_DB_NAME || '')) throw failure('MIGRATION_TARGET_REQUIRED');
    await mongoose.connect(process.env.MIGRATION_MONGODB_URI, { dbName: process.env.MIGRATION_DB_NAME,
      autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000, socketTimeoutMS: 35000 });
    const report = await migrateUrlIndexes(mongoose.connection.db.collection('urlmodels'), { apply: args[0] === '--apply' });
    console.log(JSON.stringify(report));
    if (report.blockedBy) process.exitCode = 2;
  } catch (error) {
    const allowed = ['INVALID_MIGRATION_ARGUMENTS', 'MIGRATION_TARGET_REQUIRED', 'URL_MIGRATION_DATA_CONFLICT', 'URL_MIGRATION_INDEX_CONFLICT', 'URL_INDEX_BUILD_FAILED'];
    console.error(JSON.stringify({ error: 'URL index migration failed', code: allowed.includes(error.code) ? error.code : 'MIGRATION_FAILED',
      createdIndexes: Array.isArray(error.createdIndexes) ? error.createdIndexes.filter(name => definitions.some(index => index.name === name)) : [] }));
    process.exitCode = ['URL_MIGRATION_DATA_CONFLICT', 'URL_MIGRATION_INDEX_CONFLICT'].includes(error.code) ? 2 : 1;
  } finally {
    try { await mongoose.disconnect(); }
    catch { console.error(JSON.stringify({ error: 'URL index migration disconnect failed', code: 'MIGRATION_DISCONNECT_FAILED' })); process.exitCode = 1; }
  }
}
