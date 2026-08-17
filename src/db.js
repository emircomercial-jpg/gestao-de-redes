const path = require('path');
const fs = require('fs');
let Database = null;
try {
  Database = require('better-sqlite3');
} catch (e) {
  Database = null;
}

const DB_DIR = path.resolve(__dirname, '..', 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
const DB_PATH = path.join(DB_DIR, 'app.db');

if (Database) {
  const db = new Database(DB_PATH);
  function init() {
    db.prepare(`CREATE TABLE IF NOT EXISTS credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant TEXT NOT NULL,
      platform TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`).run();
  }

  function saveCredentials(tenant, platform, data) {
    const stmt = db.prepare('INSERT INTO credentials (tenant, platform, data, created_at) VALUES (?, ?, ?, ?)');
    const info = stmt.run(tenant, platform, JSON.stringify(data), Date.now());
    return info.lastInsertRowid;
  }

  function getCredentials(tenant, platform) {
    const stmt = db.prepare('SELECT * FROM credentials WHERE tenant = ? AND platform = ? ORDER BY created_at DESC LIMIT 1');
    const row = stmt.get(tenant, platform);
    if (!row) return null;
    return { id: row.id, tenant: row.tenant, platform: row.platform, data: JSON.parse(row.data), created_at: row.created_at };
  }

  function listCredentials(tenant) {
    const stmt = db.prepare('SELECT * FROM credentials WHERE tenant = ? ORDER BY created_at DESC');
    const rows = stmt.all(tenant);
    return rows.map(r => ({ id: r.id, tenant: r.tenant, platform: r.platform, data: JSON.parse(r.data), created_at: r.created_at }));
  }

  init();
  module.exports = { saveCredentials, getCredentials, listCredentials };
} else {
  // Fallback to JSON file storage if better-sqlite3 is not available
  const FILE = path.join(DB_DIR, 'credentials.json');
  let store = { credentials: [] };
  if (fs.existsSync(FILE)) {
    try { store = JSON.parse(fs.readFileSync(FILE, 'utf8') || '{}'); } catch (e) { store = { credentials: [] }; }
  }

  function persist() {
    fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
  }

  function saveCredentials(tenant, platform, data) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    store.credentials.unshift({ id, tenant, platform, data, created_at: Date.now() });
    persist();
    return id;
  }

  function getCredentials(tenant, platform) {
    const row = store.credentials.find(r => r.tenant === tenant && r.platform === platform);
    if (!row) return null;
    return { id: row.id, tenant: row.tenant, platform: row.platform, data: row.data, created_at: row.created_at };
  }

  function listCredentials(tenant) {
    return store.credentials.filter(r => r.tenant === tenant).map(r => ({ id: r.id, tenant: r.tenant, platform: r.platform, data: r.data, created_at: r.created_at }));
  }

  module.exports = { saveCredentials, getCredentials, listCredentials };
}
