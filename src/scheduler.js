// Agendador simples em memória. Em produção use BullMQ + Redis.
const jobs = new Map(); // jobId -> timeout
let nextId = 1;

function schedulePost(publishAt, fn) {
  const delay = Math.max(0, publishAt - Date.now());
  const id = `${Date.now()}-${nextId++}`;
  const timeout = setTimeout(async () => {
    try {
      await fn();
    } catch (err) {
      console.error('Scheduled job error', err);
    } finally {
      jobs.delete(id);
    }
  }, delay);
  jobs.set(id, { timeout, publishAt });
  return id;
}

function cancelJob(jobId) {
  const j = jobs.get(jobId);
  if (!j) return false;
  clearTimeout(j.timeout);
  jobs.delete(jobId);
  return true;
}

function listJobs() {
  return Array.from(jobs.entries()).map(([id, v]) => ({ id, publishAt: v.publishAt }));
}

module.exports = { schedulePost, cancelJob, listJobs };
