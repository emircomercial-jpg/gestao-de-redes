const fs = require('fs');
const path = require('path');
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const FILE = path.join(DATA_DIR, 'alerts.json');

let store = { thresholds: {}, alerts: [] };
try { if (fs.existsSync(FILE)) store = JSON.parse(fs.readFileSync(FILE,'utf8')||'{}'); } catch (e) { store = { thresholds: {}, alerts: [] }; }

function persist(){ try{ fs.writeFileSync(FILE, JSON.stringify(store, null, 2)); } catch(e){ console.error('alerts persist error', e); } }

const DEFAULT_BUDGET = Number(process.env.ALERT_DEFAULT_BUDGET || 100); // default currency units per 24h

function getThreshold(tenant){ return store.thresholds[tenant] || DEFAULT_BUDGET; }
function setThreshold(tenant, amount){ store.thresholds[tenant] = amount; persist(); return amount; }

async function checkCost(tenant, analytics){
  const since = Date.now() - 24*60*60*1000;
  const costs = analytics.getCosts(tenant, since);
  const threshold = getThreshold(tenant);
  if (costs.total >= threshold){
    const alert = { id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, tenant, type: 'cost_threshold_exceeded', total: costs.total, threshold, ts: Date.now() };
    store.alerts.push(alert);
    // keep recent alerts
    if (store.alerts.length > 1000) store.alerts.splice(0, store.alerts.length - 1000);
    persist();
    return alert;
  }
  return null;
}

// Verifica se um custo adicional é aceitável sem ultrapassar o threshold
function canAcceptCost(tenant, additionalAmount, analytics){
  const since = Date.now() - 24*60*60*1000;
  const costs = analytics.getCosts(tenant, since);
  const threshold = getThreshold(tenant);
  const wouldTotal = costs.total + (additionalAmount || 0);
  return { allowed: wouldTotal < threshold, wouldTotal, threshold, current: costs.total };
}

// Fornece um modo simplificado de orçamento para seleção de modelos
function budgetMode(tenant, analytics){
  const since = Date.now() - 24*60*60*1000;
  const costs = analytics.getCosts(tenant, since);
  const threshold = getThreshold(tenant);
  const ratio = costs.total / Math.max(1, threshold);
  if (ratio >= 1) return { mode: 'blocked', ratio, threshold, current: costs.total };
  if (ratio >= 0.85) return { mode: 'restrict', ratio, threshold, current: costs.total };
  if (ratio >= 0.6) return { mode: 'throttle', ratio, threshold, current: costs.total };
  return { mode: 'normal', ratio, threshold, current: costs.total };
}

function listAlerts(tenant){ return store.alerts.filter(a => !tenant || a.tenant === tenant); }

module.exports = { getThreshold, setThreshold, checkCost, listAlerts, canAcceptCost, budgetMode };
