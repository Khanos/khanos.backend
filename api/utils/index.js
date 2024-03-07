// Utils and stuff

const hashCode = (url) => {
  let hash = 0;
  if (url.length === 0) {
    return hash;
  }
  for (let i = 0; i < url.length; i++) {
    let char = url.charCodeAt(i);
    hash = ((hash<<5)-hash)+char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash % 10000);
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