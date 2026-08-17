// Heurística extrativa para compactar prompts e reduzir tokens
const aiProvider = require('./ai_provider');

const STOPWORDS = new Set((
  'a,à,ao,aos,às,com,da,de,do,dos,em,por,para,os,as,um,uma,uns,umas,que,e,ou,mas,se,como,é,está,foi,ser,são'
).split(','));

function normalizeText(s){
  return String(s||'').replace(/\s+/g,' ').trim();
}

function tokenizeWords(s){
  return normalizeText(s).toLowerCase().replace(/[^\p{L}\d\s]+/gu,'').split(/\s+/).filter(Boolean);
}

function topKeywords(text, maxKeywords=20){
  const words = tokenizeWords(text);
  const freq = Object.create(null);
  for (const w of words) if (!STOPWORDS.has(w)) freq[w] = (freq[w]||0) + 1;
  const entries = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,maxKeywords);
  return new Set(entries.map(e=>e[0]));
}

function splitSentences(text){
  // simple sentence splitter
  return normalizeText(text).split(/(?<=[.!?])\s+/);
}

function scoreSentence(sent, keywords){
  const ws = tokenizeWords(sent);
  let score = 0;
  for (const w of ws) if (keywords.has(w)) score++;
  // favor medium-length sentences
  score += Math.min(5, Math.max(0, Math.floor(ws.length/10)));
  return score;
}

function compact(prompt, maxChars=2000){
  if (!prompt) return '';
  const s = normalizeText(prompt);
  if (s.length <= maxChars) return s;
  const keywords = topKeywords(s, 40);
  const sentences = splitSentences(s);
  const scored = sentences.map(sent => ({ sent, score: scoreSentence(sent, keywords) }));
  scored.sort((a,b)=>b.score - a.score);
  const out = [];
  let len = 0;
  for (const item of scored){
    if (item.score <= 0) break;
    if (len + item.sent.length + 1 > maxChars) continue;
    out.push(item.sent);
    len += item.sent.length + 1;
    if (len >= maxChars) break;
  }
  if (!out.length){
    // fallback: truncate
    return s.slice(0, maxChars) + '...';
  }
  return out.join(' ');
}

const config = require('./config');

async function compactAsync(prompt, tenant){
  const s = normalizeText(prompt);
  const conf = config.getCompactConfig(tenant);
  const THRESHOLD = Number(conf.summaryThreshold || 3000);
  if (s.length < THRESHOLD) return compact(s, conf.maxChars);
  // Try model-based summarization if enabled
  if (process.env.USE_MODEL_SUMMARY === '1'){
    try {
      const summaryPrompt = `Resuma de forma concisa e preservando o significado:\n\n${s}`;
      const call = await aiProvider.callModel('small-model', summaryPrompt, { summary: true, tenant });
      const out = normalizeText(call.result || '');
      if (out.length > 20) return compact(out, conf.maxChars);
    } catch (e) {
      // fall back to extractive
    }
  }
  return compact(s, conf.maxChars);
}

module.exports = { compact, compactAsync };
