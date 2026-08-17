const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DRAFTS_FILE = path.join(DATA_DIR, 'drafts.json');

let store = { drafts: [] };
try {
  if (fs.existsSync(DRAFTS_FILE)) store = JSON.parse(fs.readFileSync(DRAFTS_FILE, 'utf8') || '{}');
} catch (e) { store = { drafts: [] }; }

function persist() {
  fs.writeFileSync(DRAFTS_FILE, JSON.stringify(store, null, 2));
}

function createDraft(tenant, platform, message, model) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
  const draft = { id, tenant, platform, message, model, status: 'pending_review', created_at: Date.now() };
  store.drafts.unshift(draft);
  persist();
  return draft;
}

function listDrafts(tenant) {
  return store.drafts.filter(d => d.tenant === tenant);
}

function getDraft(id) {
  return store.drafts.find(d => d.id === id) || null;
}

function updateDraft(id, patch) {
  const idx = store.drafts.findIndex(d => d.id === id);
  if (idx === -1) return null;
  store.drafts[idx] = Object.assign({}, store.drafts[idx], patch);
  persist();
  return store.drafts[idx];
}

module.exports = { createDraft, listDrafts, getDraft, updateDraft };
