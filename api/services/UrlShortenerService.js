const UrlModel = require('../models/UrlModel');
const { hashCode, validateUrl } = require('../utils');

module.exports = {
 getShortUrl: async (original_url) => {
  const isValidUrl = validateUrl(original_url);
  if (!isValidUrl) {
    return null;
  }
  const hash = hashCode(original_url);
  let url = await UrlModel.findOne({ short_url: hash });
  if (!url) {
   return null;
  }
  return url;
 },
 createNewShortUrl: async (original_url) => {
  const isValidUrl = validateUrl(original_url);
  if (!isValidUrl) {
    return null;
  }
  let url = await UrlModel.findOne({ original_url });
  if (url) {
    return url;
  }
  const hash = hashCode(original_url);
  url = await UrlModel.create({
    original_url,
    short_url: hash,
    creation_date: new Date()
  });
  return url;
 },
 deleteShortUrl: async (short_url) => {
  const deletedUrl = await UrlModel.findOneAndDelete({ short_url });
  return deletedUrl;
 },
};