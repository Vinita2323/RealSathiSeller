// Simple module-level cache for page-level GET data (banners, categories, listings, etc).
// Module state survives route navigation inside the SPA (only reset on a real
// browser refresh), so a page can render instantly from the last-known data
// instead of showing an empty/loading state on every visit.
const cache = new Map();

export const getCachedData = (key) => cache.get(key)?.data;

export const setCachedData = (key, data) => {
  cache.set(key, { data, timestamp: Date.now() });
};

export const isCacheStale = (key, ttlMs) => {
  const entry = cache.get(key);
  if (!entry) return true;
  return Date.now() - entry.timestamp > ttlMs;
};
