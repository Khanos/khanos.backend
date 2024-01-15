const decodeUri = (req, _, next) => {
  decodeURIComponent(req.path);
  next();
};

module.exports = decodeUri;