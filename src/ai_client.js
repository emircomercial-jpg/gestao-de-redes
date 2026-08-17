// Simulated AI client com estimativa de tokens/custos e chamada (mock)
const modelCostsPer1k = { 'small-model': 0.01, 'large-model': 0.1, 'vision-model': 0.2 };

function estimateTokens(prompt){
  // estimativa simples: 4 chars ~= 1 token
  const chars = String(prompt||'').length;
  return Math.max(1, Math.round(chars / 4));
}

function estimateCost(model, prompt){
  const tokens = estimateTokens(prompt);
  const costPer1k = modelCostsPer1k[model] || 0.01;
  const cost = (tokens / 1000) * costPer1k;
  return { tokens, cost };
}

async function callModel(model, prompt, opts = {}){
  // Simula latência de rede/IA
  const delay = Math.min(800, 50 + Math.round((String(prompt||'').length)/5));
  await new Promise(r => setTimeout(r, delay));
  // Simula resultado simples
  const r = `Simulated(${model}): ${String(prompt||'').slice(0,300)}`;
  const est = estimateCost(model, prompt);
  return { result: r, tokens: est.tokens, cost: Number(est.cost.toFixed(6)) };
}

module.exports = { estimateCost, callModel };
