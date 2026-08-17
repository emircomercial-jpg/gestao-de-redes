const express = require('express');
require('dotenv').config();
const cache = require('./cache');
const rateLimiter = require('./rateLimiter');
const selectModel = require('./modelSelector');
const aiClient = require('./ai_client');
const aiProvider = require('./ai_provider');
const promptCompactor = require('./prompt_compactor');
const { getQueue, listJobs, removeJob } = require('./queue');
const db = require('./db');
const metaAuth = require('./auth/meta');
const linkedinAuth = require('./auth/linkedin');
const xAuth = require('./auth/x');
const path = require('path');
// servir arquivos estáticos da interface
const publicDir = path.join(__dirname, '..', 'public');
const drafts = require('./drafts');
const analytics = require('./analytics');
const alerts = require('./alerts');
const inflight = require('./inflight');
const alertsEmail = require('./alerts_email');
const client = require('prom-client');

// Prometheus metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register });
const httpHistogram = new client.Histogram({ name: 'http_request_duration_seconds', help: 'HTTP request duration in seconds', labelNames: ['method','path','status','tenant'], registers: [register], buckets: [0.01,0.05,0.1,0.3,0.5,1,2,5] });
const costCounter = new client.Counter({ name: 'ai_cost_total', help: 'Total AI cost', labelNames: ['tenant','model'], registers: [register] });
const alertsCounter = new client.Counter({ name: 'alerts_triggered_total', help: 'Number of alerts triggered', labelNames: ['tenant','type'], registers: [register] });

const app = express();
app.use(express.json());
app.use(express.static(publicDir));
const config = require('./config');

app.get('/', (req, res) => res.send('Social Automation Prototype running'));

// Middleware para medir latência
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const tenant = req.headers['x-tenant-id'] || 'default';
    analytics.recordLatency(tenant, req.path, ms);
    // observe Prometheus histogram (seconds)
    try { httpHistogram.labels(req.method, req.path, String(res.statusCode), tenant).observe(ms / 1000); } catch (e) { }
  });
  next();
});

// Endpoint para gerar conteúdo (simulado)
app.post('/generate', async (req, res) => {
  const tenant = req.headers['x-tenant-id'] || 'default';
  const { prompt, type } = req.body || {};
  const dry = req.query.dry === '1' || req.headers['x-dry-run'] === '1' || req.headers['x-dry-run'] === 'true';

  if (!rateLimiter.take(tenant, 1)) {
    return res.status(429).json({ error: 'Rate limit exceeded for tenant' });
  }

  // compact prompt to save tokens (may summarize asynchronously)
  const compactPrompt = await promptCompactor.compactAsync(prompt);
  const cacheKey = `gen:${tenant}:${type}:${String(compactPrompt).slice(0,200)}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ cached: true, result: cached });

  // budget-aware model selection
  const promptLength = String(compactPrompt || '').length;
  const bmode = alerts.budgetMode(tenant, analytics);
  if (bmode.mode === 'blocked') return res.status(402).json({ error: 'Daily budget exhausted for tenant' });
  const model = selectModel(type, { tenant, promptLength, budgetStatus: bmode });

  // Estimate cost and try cheaper alternative if needed
  const modelCosts = { 'small-model': 0.01, 'large-model': 0.1, 'vision-model': 0.2 };
  const estimated = modelCosts[model] || 0.01;
  const budgetCheck = alerts.canAcceptCost(tenant, estimated, analytics);
  let finalModel = model;
  if (!budgetCheck.allowed) {
    // try falling back to cheapest model
    finalModel = 'small-model';
  }

  // Use in-flight dedupe to avoid duplicate model calls
  try {
    // estimate cost before executing (use provider estimator)
    const est = aiProvider.estimateCost(finalModel, compactPrompt);
    if (dry) {
      return res.json({ dry: true, model: finalModel, estimated: est });
    }

    const result = await inflight.wrap(cacheKey, async () => {
      const call = await aiProvider.callModel(finalModel, compactPrompt, { tenant });
      // registra custo real após execução
      analytics.recordCost(tenant, finalModel, call.cost);
      costCounter.labels(tenant, finalModel).inc(call.cost);
      const alert = await alerts.checkCost(tenant, analytics);
      if (alert) {
        console.warn('ALERT:', alert);
        alertsCounter.labels(tenant, alert.type).inc(1);
        alertsEmail.sendAlertEmail(tenant, alert).then(info => { if (info) console.log('Alert email sent'); });
      }
      // cache por 10 minutos
      cache.set(cacheKey, call.result, 600);
      return { model: finalModel, result: call.result, tokens: call.tokens, cost: call.cost };
    });
    return res.json({ cached: false, model: result.model, result: result.result, tokens: result.tokens, cost: result.cost });
  } catch (err) {
    console.error('generate failed', err);
    return res.status(500).json({ error: 'generation failed' });
  }
});

// Metrics endpoint (summary, costs last 24h, latency)
app.get('/metrics', (req, res) => {
  const tenant = req.query.tenant || req.headers['x-tenant-id'] || 'default';
  const since = Date.now() - 24*60*60*1000;
  const summary = analytics.getSummary(tenant);
  const costs = analytics.getCosts(tenant, since);
  const lat = analytics.getLatencies(tenant, since);
  const threshold = alerts.getThreshold(tenant);
  const recentAlerts = alerts.listAlerts(tenant);
  return res.json({ summary, costs, latencies: lat, threshold, recentAlerts });
});

// Config endpoints for compacting
app.get('/config/compact', (req, res) => {
  const tenant = req.query.tenant || req.headers['x-tenant-id'];
  return res.json({ compact: config.getCompactConfig(tenant) });
});

app.post('/config/compact', (req, res) => {
  const tenant = req.query.tenant || req.body.tenant || req.headers['x-tenant-id'];
  const body = req.body || {};
  const updated = config.setCompactConfig(body, tenant);
  return res.json({ compact: updated });
});

// Prometheus scrape endpoint
app.get('/prometheus', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const body = await register.metrics();
    res.send(body);
  } catch (e) {
    res.status(500).send('metrics error');
  }
});

// Convenience route to open admin page
app.get('/admin', (req, res) => res.sendFile(path.join(publicDir, 'admin.html')));

// Error handler for malformed JSON bodies
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    console.warn('Malformed JSON body:', err.message);
    return res.status(400).json({ error: 'invalid_json', message: err.message });
  }
  next(err);
});

// Threshold management
app.get('/alerts/threshold', (req, res) => {
  const tenant = req.query.tenant || req.headers['x-tenant-id'] || 'default';
  return res.json({ tenant, threshold: alerts.getThreshold(tenant) });
});

app.post('/alerts/threshold', (req, res) => {
  const tenant = req.body.tenant || req.headers['x-tenant-id'] || 'default';
  const amount = Number(req.body.amount);
  if (isNaN(amount) || amount < 0) return res.status(400).json({ error: 'invalid amount' });
  const v = alerts.setThreshold(tenant, amount);
  return res.json({ tenant, threshold: v });
});

// Endpoint para agendar uma publicação (usa BullMQ/Redis se configurado, fallback em memória)
app.post('/schedule', async (req, res) => {
  const tenant = req.headers['x-tenant-id'] || 'default';
  if (!rateLimiter.take(tenant, 1)) {
    return res.status(429).json({ error: 'Rate limit exceeded for tenant' });
  }

  const { platform, credentials, message, publishAt } = req.body || {};
  if (!platform || !message) return res.status(400).json({ error: 'platform and message are required' });

  // calcula delay em ms
  let delay = 0;
  if (publishAt) {
    const ts = typeof publishAt === 'number' ? publishAt : Date.parse(publishAt);
    if (isNaN(ts)) return res.status(400).json({ error: 'invalid publishAt' });
    delay = Math.max(0, ts - Date.now());
  }

  const queue = getQueue();
  try {
    const job = await queue.add('publish', { tenant, platform, credentials, message }, { delay });
    return res.json({ queued: true, jobId: job.id || job });
  } catch (err) {
    console.error('Failed to enqueue job', err);
    return res.status(500).json({ error: 'failed to enqueue job' });
  }
});

// Listar jobs na fila
app.get('/jobs', async (req, res) => {
  try {
    const jobs = await listJobs();
    return res.json({ jobs });
  } catch (err) {
    console.error('Failed to list jobs', err);
    return res.status(500).json({ error: 'failed to list jobs' });
  }
});

// Cancelar job por id
app.post('/cancel', async (req, res) => {
  const { jobId } = req.body || {};
  if (!jobId) return res.status(400).json({ error: 'jobId required' });
  try {
    const ok = await removeJob(jobId);
    if (!ok) return res.status(404).json({ error: 'job not found or could not be removed' });
    return res.json({ cancelled: true, jobId });
  } catch (err) {
    console.error('Failed to cancel job', err);
    return res.status(500).json({ error: 'failed to cancel job' });
  }
});

// Iniciar OAuth Meta — redireciona o usuário para autorizar
const oauthStates = new Map();
app.get('/auth/meta', (req, res) => {
  const tenant = req.query.tenant || 'default';
  const redirectUri = process.env.META_REDIRECT_URI;
  if (!redirectUri) return res.status(500).send('META_REDIRECT_URI not configured');
  const state = `${tenant}:${Math.random().toString(36).slice(2,12)}`;
  oauthStates.set(state, { tenant, created: Date.now() });
  try {
    const url = metaAuth.getAuthUrl(redirectUri, state);
    return res.redirect(url);
  } catch (err) {
    console.error('Failed to build Meta auth URL', err);
    return res.status(500).send('failed to build auth url');
  }
});

// Callback OAuth Meta — troca código por token e armazena credenciais
app.get('/auth/meta/callback', async (req, res) => {
  const { code, state } = req.query || {};
  if (!state || !oauthStates.has(state)) return res.status(400).send('invalid or missing state');
  const { tenant } = oauthStates.get(state);
  oauthStates.delete(state);
  const redirectUri = process.env.META_REDIRECT_URI;
  try {
    const tokenResp = await metaAuth.exchangeCodeForUserToken(code, redirectUri);
    // tokenResp has access_token for user
    const userToken = tokenResp.access_token;
    // list pages and store them
    const pages = await metaAuth.listPagesForUser(userToken);
    // store credentials: user token and pages list
    const savedId = db.saveCredentials(tenant, 'meta', { userToken, pages, tokenResp });
    return res.send(`Authorization successful. Credentials saved id=${savedId}`);
  } catch (err) {
    console.error('Meta OAuth callback failed', err);
    return res.status(500).send('oauth exchange failed');
  }
});

// Listar credenciais armazenadas para um tenant
app.get('/credentials', (req, res) => {
  const tenant = req.query.tenant || 'default';
  try {
    const creds = db.listCredentials(tenant);
    return res.json({ creds });
  } catch (err) {
    console.error('Failed to list credentials', err);
    return res.status(500).json({ error: 'failed to list credentials' });
  }
});

// Admin: add credentials (protected by ADMIN_TOKEN)
app.post('/credentials', (req, res) => {
  const adminToken = process.env.ADMIN_TOKEN || null;
  const provided = req.headers['x-admin-token'] || req.body.adminToken;
  if (!adminToken || adminToken !== provided) return res.status(403).json({ error: 'forbidden' });
  const { tenant, platform, data } = req.body || {};
  if (!tenant || !platform || !data) return res.status(400).json({ error: 'tenant, platform, data required' });
  try {
    const id = db.saveCredentials(tenant, platform, data);
    return res.json({ saved: true, id });
  } catch (e) {
    console.error('Failed to save credentials', e);
    return res.status(500).json({ error: 'failed to save credentials' });
  }
});

// --- Drafts (Geração com revisão humana) ---
app.post('/drafts', async (req, res) => {
  const tenant = req.headers['x-tenant-id'] || 'default';
  if (!rateLimiter.take(tenant, 1)) return res.status(429).json({ error: 'Rate limit exceeded for tenant' });
  const { platform, prompt, type } = req.body || {};
  if (!platform || !prompt) return res.status(400).json({ error: 'platform and prompt required' });
  const model = selectModel(type || 'summary');
  // Simula geração (substituir por integração real com IA)
  const generated = `Draft by ${model}: ${prompt.slice(0,1000)}`;
  const draft = drafts.createDraft(tenant, platform, generated, model);
  return res.json({ draft });
});

app.get('/drafts', (req, res) => {
  const tenant = req.query.tenant || req.headers['x-tenant-id'] || 'default';
  const list = drafts.listDrafts(tenant);
  return res.json({ drafts: list });
});

app.get('/drafts/:id', (req, res) => {
  const d = drafts.getDraft(req.params.id);
  if (!d) return res.status(404).json({ error: 'not found' });
  return res.json({ draft: d });
});

app.post('/drafts/:id/approve', async (req, res) => {
  const tenant = req.headers['x-tenant-id'] || 'default';
  const d = drafts.getDraft(req.params.id);
  if (!d) return res.status(404).json({ error: 'not found' });
  if (d.tenant !== tenant) return res.status(403).json({ error: 'forbidden' });
  drafts.updateDraft(d.id, { status: 'approved', approved_at: Date.now() });
  // enqueue publish job immediately
  const queue = getQueue();
  await queue.add('publish', { tenant, platform: d.platform, credentials: null, message: d.message }, {});
  return res.json({ approved: true, draft: d });
});

app.post('/drafts/:id/reject', (req, res) => {
  const tenant = req.headers['x-tenant-id'] || 'default';
  const { reason } = req.body || {};
  const d = drafts.getDraft(req.params.id);
  if (!d) return res.status(404).json({ error: 'not found' });
  if (d.tenant !== tenant) return res.status(403).json({ error: 'forbidden' });
  drafts.updateDraft(d.id, { status: 'rejected', rejected_at: Date.now(), reject_reason: reason || null });
  return res.json({ rejected: true, draft: d });
});

// Analytics endpoints
app.post('/analytics/event', (req, res) => {
  const tenant = req.headers['x-tenant-id'] || req.body.tenant || 'default';
  const { type, payload } = req.body || {};
  if (!type) return res.status(400).json({ error: 'type is required' });
  const ev = analytics.recordEvent(tenant, type, payload);
  return res.json({ recorded: true, event: ev });
});

app.get('/analytics/summary', (req, res) => {
  const tenant = req.query.tenant || req.headers['x-tenant-id'] || 'default';
  const summary = analytics.getSummary(tenant);
  return res.json({ summary });
});

// OAuth LinkedIn
app.get('/auth/linkedin', (req, res) => {
  const tenant = req.query.tenant || 'default';
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
  if (!redirectUri) return res.status(500).send('LINKEDIN_REDIRECT_URI not configured');
  const state = `${tenant}:${Math.random().toString(36).slice(2,12)}`;
  oauthStates.set(state, { tenant, created: Date.now() });
  try {
    const url = linkedinAuth.getAuthUrl(redirectUri, state);
    return res.redirect(url);
  } catch (err) {
    console.error('Failed to build LinkedIn auth URL', err);
    return res.status(500).send('failed to build auth url');
  }
});

app.get('/auth/linkedin/callback', async (req, res) => {
  const { code, state } = req.query || {};
  if (!state || !oauthStates.has(state)) return res.status(400).send('invalid or missing state');
  const { tenant } = oauthStates.get(state);
  oauthStates.delete(state);
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
  try {
    const tokenResp = await linkedinAuth.exchangeCodeForAccessToken(code, redirectUri);
    const savedId = db.saveCredentials(tenant, 'linkedin', { tokenResp });
    return res.send(`LinkedIn authorization successful. Credentials saved id=${savedId}`);
  } catch (err) {
    console.error('LinkedIn OAuth callback failed', err);
    return res.status(500).send('oauth exchange failed');
  }
});

// OAuth X (Twitter)
app.get('/auth/x', (req, res) => {
  const tenant = req.query.tenant || 'default';
  const redirectUri = process.env.X_REDIRECT_URI;
  if (!redirectUri) return res.status(500).send('X_REDIRECT_URI not configured');
  const state = `${tenant}:${Math.random().toString(36).slice(2,12)}`;
  oauthStates.set(state, { tenant, created: Date.now() });
  try {
    const url = xAuth.getAuthUrl(redirectUri, state);
    return res.redirect(url);
  } catch (err) {
    console.error('Failed to build X auth URL', err);
    return res.status(500).send('failed to build auth url');
  }
});

app.get('/auth/x/callback', async (req, res) => {
  const { code, state } = req.query || {};
  if (!state || !oauthStates.has(state)) return res.status(400).send('invalid or missing state');
  const { tenant } = oauthStates.get(state);
  oauthStates.delete(state);
  const redirectUri = process.env.X_REDIRECT_URI;
  try {
    const tokenResp = await xAuth.exchangeCodeForAccessToken(code, redirectUri);
    const savedId = db.saveCredentials(tenant, 'x', { tokenResp });
    return res.send(`X authorization successful. Credentials saved id=${savedId}`);
  } catch (err) {
    console.error('X OAuth callback failed', err);
    return res.status(500).send('oauth exchange failed');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
