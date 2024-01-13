const decodeUri = (req, _, next) => {
  decodeURIComponent(req.path);
  next();
};

export default decodeUri;