const axios = require('axios');

async function publishToFacebookPage(pageAccessToken, pageId, message) {
  if (!pageAccessToken || !pageId) {
    throw new Error('pageAccessToken and pageId are required');
  }

  const url = `https://graph.facebook.com/${pageId}/feed`;
  try {
    const resp = await axios.post(url, null, {
      params: {
        message,
        access_token: pageAccessToken,
      },
      timeout: 10000,
    });
    return resp.data; // { id: "<post_id>" }
  } catch (err) {
    const msg = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
    throw new Error(`Facebook API error: ${msg}`);
  }
}

module.exports = { publishToFacebookPage };
