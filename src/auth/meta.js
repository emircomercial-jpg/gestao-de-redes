const axios = require('axios');
const querystring = require('querystring');

const APP_ID = process.env.META_APP_ID;
const APP_SECRET = process.env.META_APP_SECRET;
const API_VERSION = process.env.META_API_VERSION || 'v16.0';

function getAuthUrl(redirectUri, state) {
  if (!APP_ID) throw new Error('META_APP_ID not configured');
  const params = {
    client_id: APP_ID,
    redirect_uri: redirectUri,
    state,
    scope: 'pages_manage_posts,pages_read_engagement,instagram_basic,pages_show_list'
  };
  return `https://www.facebook.com/${API_VERSION}/dialog/oauth?${querystring.stringify(params)}`;
}

async function exchangeCodeForUserToken(code, redirectUri) {
  if (!APP_ID || !APP_SECRET) throw new Error('META_APP_ID or META_APP_SECRET not configured');
  const url = `https://graph.facebook.com/${API_VERSION}/oauth/access_token`;
  const params = {
    client_id: APP_ID,
    redirect_uri: redirectUri,
    client_secret: APP_SECRET,
    code,
  };
  const resp = await axios.get(url, { params, timeout: 10000 });
  return resp.data; // { access_token, token_type, expires_in }
}

async function listPagesForUser(userAccessToken) {
  const url = `https://graph.facebook.com/${API_VERSION}/me/accounts`;
  const resp = await axios.get(url, { params: { access_token: userAccessToken }, timeout: 10000 });
  return resp.data.data; // array of pages { id, name, access_token }
}

module.exports = { getAuthUrl, exchangeCodeForUserToken, listPagesForUser };
