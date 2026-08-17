const { getQueue } = require('./queue');
const { publishToFacebookPage } = require('./connectors/facebook');
const { publishToLinkedIn } = require('./connectors/linkedin');
const { publishToX } = require('./connectors/x');

async function processJob(job) {
  // job may be BullMQ Job object or our in-memory wrapper
  const payload = job.data || job;
  if (payload.name === 'publish') {
    const { tenant, platform, credentials, message } = payload.data || payload;
    try {
      if (platform === 'facebook') {
        const res = await publishToFacebookPage(credentials.pageAccessToken, credentials.pageId, message);
        console.log('Published to Facebook:', res);
      } else if (platform === 'linkedin') {
        // credentials: { accessToken, authorUrn }
        const res = await publishToLinkedIn(credentials.accessToken, credentials.authorUrn, message);
        console.log('Published to LinkedIn:', res);
      } else if (platform === 'x' || platform === 'twitter') {
        // credentials: { bearerToken }
        const res = await publishToX(credentials.bearerToken, message);
        console.log('Published to X:', res);
      } else {
        console.log('Unsupported platform in worker', platform);
      }
    } catch (err) {
      console.error('Publish job failed', err);
    }
  } else {
    console.log('Unknown job type', payload.name || '(no name)');
  }
}

// If connected to Redis/BullMQ we start a Worker to process jobs
(function startWorkerIfPossible() {
  let BullWorker = null;
  try {
    BullWorker = require('bullmq').Worker;
  } catch (e) {
    BullWorker = null;
  }
  const redisUrl = process.env.REDIS_URL;
  if (BullWorker && redisUrl) {
    const IORedis = require('ioredis');
    const connection = new IORedis(redisUrl);
    const w = new BullWorker('publish-queue', async job => {
      await processJob(job);
    }, { connection });
    w.on('completed', j => console.log('Job completed', j.id));
    w.on('failed', (j, err) => console.error('Job failed', j.id, err));
    console.log('BullMQ worker started');
  } else {
    console.log('BullMQ not available or REDIS_URL not set — worker not started (using in-memory fallback)');
  }
})();

module.exports = { processJob };
