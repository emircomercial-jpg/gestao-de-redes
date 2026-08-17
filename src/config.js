const fs = require('fs');
const path = require('path');
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const FILE = path.join(DATA_DIR, 'config.json');

const defaults = {
  compact: {
    maxChars: Number(process.env.COMPACT_MAX_CHARS || 1200),
    summaryThreshold: Number(process.env.COMPACT_SUMMARY_THRESHOLD || 3000),
    keywordsLimit: Number(process.env.COMPACT_KEYWORDS_LIMIT || 40)
  }
};

let store = {};
try { if (fs.existsSync(FILE)) store = JSON.parse(fs.readFileSync(FILE,'utf8')||'{}'); } catch (e){ store = {}; }

function persist(){ try { fs.writeFileSync(FILE, JSON.stringify(store, null, 2)); } catch(e){ console.error('config persist error', e); } }

function getCompactConfig(tenant){
  const base = Object.assign({}, defaults.compact, (store.compact||{}));
  if (tenant && store.tenants && store.tenants[tenant] && store.tenants[tenant].compact) {
    return Object.assign({}, base, store.tenants[tenant].compact);
  }
  return base;
}

function setCompactConfig(obj, tenant){
  if (!tenant){
    store.compact = Object.assign({}, getCompactConfig(), obj);
  } else {
    store.tenants = store.tenants || {};
    store.tenants[tenant] = store.tenants[tenant] || {};
    store.tenants[tenant].compact = Object.assign({}, getCompactConfig(), obj);
  }
  persist();
  return getCompactConfig(tenant);
}

module.exports = { getCompactConfig, setCompactConfig };
