import mongoose from 'mongoose';
import { validateUrl } from '../utils/index.js';

const urlShortenerSchema = new mongoose.Schema({
  original_url: { type: String, required: true, maxlength: 2048, validate: validateUrl },
  short_url: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  creation_date: { type: Date, required: true, default: Date.now },
}, { autoIndex: false, autoCreate: false, bufferCommands: false });
// Declared for isolated tests and explicit migration only. Startup never builds indexes.
urlShortenerSchema.index({ short_url: 1 }, { unique: true, name: 'unique_short_code', collation: { locale: 'simple' } });
urlShortenerSchema.index({ original_url: 1 }, { unique: true, name: 'unique_original_url', collation: { locale: 'simple' } });
export default mongoose.model('UrlModel', urlShortenerSchema);
