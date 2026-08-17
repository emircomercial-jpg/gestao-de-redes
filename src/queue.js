const { Queue, Worker, QueueScheduler } = (() => {
  try {
    return require('bullmq');
  } catch (e) {
    return null;
  }
})();
const fs = require('fs');
const path = require('path');

const IORedis = (() => {
  try {
    return require('ioredis');
  } catch (e) {
    return null;
  }
})();

class InMemoryQueue {
  constructor() {
    this.jobs = new Map();
  }
  async add(name, data, opts = {}) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
    const delay = opts.delay || 0;
    const publishAt = Date.now() + delay;
    const timeout = setTimeout(async () => {
      // naive in-memory processing via require of worker
      try {
        const worker = require('./worker');
        if (worker && typeof worker.processJob === 'function') {
          await worker.processJob({ name, data });
        }
      } catch (err) {
        console.error('InMemoryQueue process error', err);
      } finally {
        this.jobs.delete(id);
        persistJobs(this);
      }
    }, delay);
    this.jobs.set(id, { name, data, timeout, publishAt });
    persistJobs(this);
    return { id };
  }
}

let queueInstance = null;

function getQueue() {
  if (queueInstance) return queueInstance;
  const redisUrl = process.env.REDIS_URL;
  if (Queue && IORedis && redisUrl) {
    const connection = new IORedis(redisUrl);
    const q = new Queue('publish-queue', { connection });
    // create scheduler to handle delayed jobs
    new QueueScheduler('publish-queue', { connection });
    queueInstance = q;
    return q;
  }
  queueInstance = new InMemoryQueue();
  // load persisted jobs if any
  loadPersistedJobs(queueInstance);
  return queueInstance;
}

// Persistência simples em arquivo para jobs quando usando fallback em memória
const JOBS_FILE = path.join(__dirname, '..', 'data', 'jobs.json');
function loadPersistedJobs(inMemoryQueue) {
  try {
    if (!fs.existsSync(JOBS_FILE)) return;
    const raw = fs.readFileSync(JOBS_FILE, 'utf8');
    const arr = JSON.parse(raw || '[]');
    for (const j of arr) {
      const { id, name, data, publishAt } = j;
      const delay = Math.max(0, publishAt - Date.now());
      const timeout = setTimeout(async () => {
        try {
          const worker = require('./worker');
          if (worker && typeof worker.processJob === 'function') {
            await worker.processJob({ name, data });
          }
        } catch (err) {
          console.error('InMemoryQueue process error', err);
        } finally {
          inMemoryQueue.jobs.delete(id);
          persistJobs(inMemoryQueue);
        }
      }, delay);
      inMemoryQueue.jobs.set(id, { name, data, timeout, publishAt });
    }
  } catch (e) {
    console.error('Failed to load persisted jobs', e);
  }
}

function persistJobs(inMemoryQueue) {
  try {
    const arr = Array.from((inMemoryQueue || queueInstance)?.jobs?.entries() || []).map(([id, v]) => ({ id, name: v.name, data: v.data, publishAt: v.publishAt }));
    fs.writeFileSync(JOBS_FILE, JSON.stringify(arr, null, 2));
  } catch (e) {
    console.error('Failed to persist jobs', e);
  }
}

async function listJobs() {
  const q = getQueue();
  // BullMQ Queue has getJobs method
  if (q && typeof q.getJobs === 'function') {
    const jobs = await q.getJobs(['waiting', 'delayed', 'active', 'completed', 'failed']);
    return jobs.map(j => ({ id: j.id, name: j.name, data: j.data, state: j.state, timestamp: j.timestamp }));
  }
  // In-memory fallback
  if (q && q.jobs) {
    return Array.from(q.jobs.entries()).map(([id, v]) => ({ id, name: v.name, data: v.data, state: 'scheduled', publishAt: v.publishAt || null }));
  }
  return [];
}

async function removeJob(jobId) {
  const q = getQueue();
  if (q && typeof q.getJob === 'function') {
    const job = await q.getJob(jobId);
    if (!job) return false;
    await job.remove();
    return true;
  }
  // in-memory
  if (q && q.jobs && q.jobs.has(jobId)) {
    const j = q.jobs.get(jobId);
    clearTimeout(j.timeout);
    q.jobs.delete(jobId);
    return true;
  }
  return false;
}

module.exports = { getQueue, listJobs, removeJob };
