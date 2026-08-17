const axios = require('axios');

/**
 * Publish a text post on LinkedIn using the UGC API.
 * authorUrn should be like 'urn:li:person:xxxxxxxx' or organization URN.
 */
async function publishToLinkedIn(accessToken, authorUrn, message) {
  if (!accessToken || !authorUrn) throw new Error('accessToken and authorUrn required');
  const url = 'https://api.linkedin.com/v2/ugcPosts';
  const body = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: message },
        shareMediaCategory: 'NONE'
      }
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
  };
  try {
    const resp = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      timeout: 10000
    });
    return resp.data;
  } catch (err) {
    const msg = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
    throw new Error(`LinkedIn API error: ${msg}`);
  }
}

module.exports = { publishToLinkedIn };
