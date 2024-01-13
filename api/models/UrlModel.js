const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const urlShortenerSchema = new Schema(
    {
      original_url: String,
      short_url: Number,
      creation_date: Date
    }
  );
const UrlModel = mongoose.model('UrlModel', urlShortenerSchema );

module.exports = UrlModel;