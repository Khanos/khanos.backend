import ApiError from './ApiError.js';

// Retained only to characterize legacy collisions. New allocation never uses this hash.
export const hashCode = (url) => {
  let hash = 0;
  for (let i = 0; i < url.length; i++) hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
  return Math.abs(hash % 10000);
};
export const validateUrl = (value) => {
  // Reject whitespace/control bytes rather than silently normalizing identity.
  // eslint-disable-next-line no-control-regex
  if (typeof value !== 'string' || value.length > 2048 || /[\s\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && url.hostname ? url.hostname : null;
  } catch {
    return null;
  }
};
export function shortCode(value) {
  // All nonnegative, safe integer legacy codes remain addressable, including 0.
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,15})$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new ApiError(400, 'INVALID_CODE', 'Invalid short code');
  }
  return Number(value);
}
export function positiveInteger(value, fallback, max) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max) {
    throw new ApiError(400, 'INVALID_PAGINATION', 'Invalid pagination');
  }
  return Number(value);
}
