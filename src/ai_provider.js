const aiClient = require('./ai_client');
const axios = require('axios');

const REAL_URL = process.env.REAL_AI_URL; // e.g. https://api.yourprovider.com/v1/generate
const REAL_KEY = process.env.REAL_AI_KEY;
const COST_PER_1K = Number(process.env.REAL_AI_COST_PER_1K || 0.1); // fallback cost per 1k tokens

async function callModel(model, prompt, opts = {}){
  if (!REAL_URL || !REAL_KEY) {
    return aiClient.callModel(model, prompt, opts);
  }
  try {
    const resp = await axios.post(REAL_URL, { model, prompt }, { headers: { Authorization: `Bearer ${REAL_KEY}`, 'Content-Type': 'application/json' }, timeout: 20000 });
    // expect { result, tokens } from provider; otherwise try to map
    const data = resp.data || {};
    const result = data.result || data.text || (data.choices && data.choices[0] && data.choices[0].text) || '';
    const tokens = data.tokens || (aiClient.estimateCost(model, prompt).tokens);
    const cost = (tokens/1000) * COST_PER_1K;
    return { result, tokens, cost: Number(cost.toFixed(6)) };
  } catch (e) {
    console.error('ai_provider call failed, falling back to local sim', e.message || e);
    return aiClient.callModel(model, prompt, opts);
  }
}

function estimateCost(model, prompt){
  if (!REAL_URL || !REAL_KEY) return aiClient.estimateCost(model, prompt);
  const est = aiClient.estimateCost(model, prompt);
  est.cost = Number(((est.tokens/1000) * COST_PER_1K).toFixed(6));
  return est;
}

module.exports = { callModel, estimateCost };
