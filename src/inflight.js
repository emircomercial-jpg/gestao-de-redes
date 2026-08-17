// Simple in-flight deduplication to avoid duplicate model calls
const map = new Map(); // key -> Promise

function wrap(key, promiseFactory) {
  if (map.has(key)) return map.get(key);
  const p = (async () => {
    try {
      return await promiseFactory();
    } finally {
      // cleanup after completion
      map.delete(key);
    }
  })();
  map.set(key, p);
  return p;
}

module.exports = { wrap };
