// Utils and stuff

const hashCode = (url) => {
  var hash = 0, i, chr;
  if (url.length === 0) return hash;
  for (i = 0; i < url.length; i++) {
      chr   = url.charCodeAt(i);
      hash  = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

const validateUrl = (original_url) => {
  let hostname;
  try {
    hostname = new URL(original_url).hostname;
  } catch {
    hostname = null;
  }
  return hostname ? hostname : null;
}

module.exports = {
  hashCode,
  validateUrl
};