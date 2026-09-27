const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '..', '..', 'data');
const CACHE_FILE = path.join(CACHE_DIR, 'cache.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours persistent cache

class PersistentCache {
  constructor() {
    this.memoryCache = new Map();
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      if (fs.existsSync(CACHE_FILE)) {
        const raw = fs.readFileSync(CACHE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        const now = Date.now();
        let loadedCount = 0;

        for (const [key, item] of Object.entries(parsed)) {
          if (item && item.timestamp && (now - item.timestamp < CACHE_TTL_MS)) {
            this.memoryCache.set(key, item);
            loadedCount++;
          }
        }
        console.log(`[PERSISTENT CACHE] Loaded ${loadedCount} valid entries from disk cache (${CACHE_FILE})`);
      }
    } catch (err) {
      console.warn(`[PERSISTENT CACHE] Could not load disk cache: ${err.message}`);
    }
  }

  saveToDisk() {
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      const obj = {};
      const now = Date.now();
      for (const [key, item] of this.memoryCache.entries()) {
        if (item && item.timestamp && (now - item.timestamp < CACHE_TTL_MS)) {
          obj[key] = item;
        }
      }
      fs.writeFileSync(CACHE_FILE, JSON.stringify(obj, null, 2), 'utf8');
    } catch (err) {
      console.warn(`[PERSISTENT CACHE] Could not save to disk: ${err.message}`);
    }
  }

  get(key) {
    const item = this.memoryCache.get(key);
    if (!item) return null;
    if (Date.now() - item.timestamp > CACHE_TTL_MS) {
      this.memoryCache.delete(key);
      return null;
    }
    return item.data;
  }

  has(key) {
    return this.get(key) !== null;
  }

  set(key, data) {
    this.memoryCache.set(key, {
      timestamp: Date.now(),
      data: data
    });
    // Async background save to prevent blocking
    setImmediate(() => this.saveToDisk());
  }

  delete(key) {
    this.memoryCache.delete(key);
    setImmediate(() => this.saveToDisk());
  }

  clear() {
    this.memoryCache.clear();
    setImmediate(() => this.saveToDisk());
  }
}

module.exports = new PersistentCache();
