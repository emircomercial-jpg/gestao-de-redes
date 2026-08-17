const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const FILE = path.join(DATA_DIR, 'analytics.json');

let store = { events: [] };
try { if (fs.existsSync(FILE)) store = JSON.parse(fs.readFileSync(FILE,'utf8')||'{}'); } catch (e) { store = { events: [] }; }

function persist() { try { fs.writeFileSync(FILE, JSON.stringify(store, null, 2)); } catch (e) { console.error('analytics persist error', e); } }

function recordEvent(tenant, type, payload) {
  const ev = { id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, tenant, type, payload: payload||null, ts: Date.now() };
  store.events.push(ev);
  // keep file size reasonable: trim old events beyond 20000
  if (store.events.length > 20000) store.events.splice(0, store.events.length - 20000);
  persist();
  return ev;
}

function recordLatency(tenant, endpoint, ms) {
  return recordEvent(tenant, 'latency', { endpoint, ms });
}

function recordCost(tenant, model, cost) {
  return recordEvent(tenant, 'cost', { model, cost });
}

function getSummary(tenant) {
  const events = store.events.filter(e => e.tenant === tenant);
  const byType = {};
  for (const e of events) byType[e.type] = (byType[e.type]||0)+1;
  return { tenant, total: events.length, byType };
}

function getCosts(tenant, sinceTs = 0) {
  const evs = store.events.filter(e => e.tenant === tenant && e.type === 'cost' && e.ts >= sinceTs);
  const total = evs.reduce((s, e) => s + (e.payload && e.payload.cost ? e.payload.cost : 0), 0);
  const byModel = {};
  for (const e of evs) {
    const m = e.payload && e.payload.model ? e.payload.model : 'unknown';
    byModel[m] = (byModel[m]||0) + (e.payload.cost||0);
  }
  return { tenant, total, byModel, count: evs.length };
}

function getLatencies(tenant, sinceTs = 0) {
  const evs = store.events.filter(e => e.tenant === tenant && e.type === 'latency' && e.ts >= sinceTs);
  if (!evs.length) return { tenant, count: 0 };
  const vals = evs.map(e => e.payload.ms || 0);
  const sum = vals.reduce((a,b)=>a+b,0);
  const avg = sum / vals.length;
  const max = Math.max(...vals);
  return { tenant, count: vals.length, avg, max };
}

module.exports = { recordEvent, getSummary, recordLatency, recordCost, getCosts, getLatencies };
