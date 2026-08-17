const axios = require('axios');

/**
 * Publish a tweet using X API v2. Expects a Bearer token with write permissions.
 */
async function publishToX(bearerToken, message) {
  if (!bearerToken) throw new Error('bearerToken required');
  const url = 'https://api.twitter.com/2/tweets';
  try {
    const resp = await axios.post(url, { text: message }, {
      headers: { Authorization: `Bearer ${bearerToken}`, 'Content-Type': 'application/json' },
      timeout: 10000
    });
    return resp.data; // { data: { id, text } }
  } catch (err) {
    const msg = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
    throw new Error(`X API error: ${msg}`);
  }
}

module.exports = { publishToX };
