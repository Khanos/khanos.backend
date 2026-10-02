import mongoose from 'mongoose';
import UrlModel from './api/models/UrlModel.js';

export async function requireUrlIndexes(collection) {
  const indexes = await collection.indexes();
  for (const field of ['short_url', 'original_url']) {
    if (!indexes.some(index => index.unique === true && !index.sparse && !index.partialFilterExpression &&
        (!index.collation || index.collation.locale === 'simple') && Object.keys(index.key).length === 1 && index.key[field] === 1)) {
      throw new Error('Required URL uniqueness indexes are missing; run the documented preflight/migration');
    }
  }
}
const mongoDB = {
  async connect(config) {
    await mongoose.connect(config.connectionUrl, { dbName: config.databaseName,
      autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000, socketTimeoutMS: 10000 });
    await requireUrlIndexes(UrlModel.collection);
  },
  async disconnect() { await mongoose.connection.close(); },
  isReady() { return mongoose.connection.readyState === 1; },
};
export default mongoDB;
