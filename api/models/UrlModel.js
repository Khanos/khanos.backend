import mongoose from 'mongoose';

const { Schema } = mongoose;

const urlShortenerSchema = new Schema(
  {
    original_url: String,
    short_url: Number,
    creation_date: Date,
  }
);

const UrlModel = mongoose.model('UrlModel', urlShortenerSchema);

export default UrlModel;