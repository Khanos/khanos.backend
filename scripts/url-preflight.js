import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { requireUrlIndexes } from '../db.js';
import { validateUrl } from '../api/utils/index.js';

/** Read-only: output counts only, never URLs, codes, identifiers or credentials. */
export async function preflight(collection) {
  const report = { records: 0, invalidRecords: 0, duplicateCodeGroups: 0, duplicateOriginalGroups: 0, requiredIndexesPresent: false };
  try { await requireUrlIndexes(collection); report.requiredIndexesPresent = true; }
  catch (error) {
    if (error.code !== 26 && !error.message.startsWith('Required URL uniqueness')) throw error;
  }
  for await (const record of collection.find({}, { projection: { original_url: 1, short_url: 1, creation_date: 1 }, maxTimeMS: 30000 })) {
    report.records++;
    if (!(record._id instanceof mongoose.Types.ObjectId) || !validateUrl(record.original_url) || !Number.isSafeInteger(record.short_url) || record.short_url < 0 ||
        !(record.creation_date instanceof Date) || Number.isNaN(record.creation_date.getTime())) report.invalidRecords++;
  }
  for (const [field, name] of [['short_url', 'duplicateCodeGroups'], ['original_url', 'duplicateOriginalGroups']]) {
    const groups = await collection.aggregate([
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }, { $count: 'groups' },
    ], { allowDiskUse: true, maxTimeMS: 30000, collation: { locale: 'simple' } }).toArray();
    report[name] = groups.length ? groups[0].groups : 0;
  }
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    // Explicit target only. No default, dotenv, auto-index creation or data writes.
    if (!process.env.PREFLIGHT_MONGODB_URI || !process.env.PREFLIGHT_DB_NAME) throw new Error();
    await mongoose.connect(process.env.PREFLIGHT_MONGODB_URI, {
      dbName: process.env.PREFLIGHT_DB_NAME, autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000, socketTimeoutMS: 10000,
    });
    const report = await preflight(mongoose.connection.db.collection('urlmodels'));
    console.log(JSON.stringify(report));
    if (report.invalidRecords || report.duplicateCodeGroups || report.duplicateOriginalGroups) process.exitCode = 2;
  } catch {
    console.error('URL preflight failed; target and credentials were not logged');
    process.exitCode = 1;
  } finally {
    try { await mongoose.disconnect(); }
    catch { console.error('URL preflight disconnect failed'); process.exitCode = 1; }
  }
}
