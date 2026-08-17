const axios = require('axios');
const querystring = require('querystring');

const CLIENT_ID = process.env.X_CLIENT_ID;
const CLIENT_SECRET = process.env.X_CLIENT_SECRET;
const AUTH_URL = process.env.X_AUTH_URL || 'https://twitter.com/i/oauth2/authorize';
const TOKEN_URL = process.env.X_TOKEN_URL || 'https://api.twitter.com/2/oauth2/token';

function getAuthUrl(redirectUri, state) {
  if (!CLIENT_ID) throw new Error('X_CLIENT_ID not configured');
  const params = {
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    state,
    scope: 'tweet.read tweet.write users.read offline.access',
    code_challenge: process.env.X_CODE_CHALLENGE || '',
    code_challenge_method: process.env.X_CODE_CHALLENGE_METHOD || 'plain'
  };
  return `${AUTH_URL}?${querystring.stringify(params)}`;
}

async function exchangeCodeForAccessToken(code, redirectUri) {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('X_CLIENT_ID or X_CLIENT_SECRET not configured');
  const params = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  };
  const resp = await axios.post(TOKEN_URL, querystring.stringify(params), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 });
  return resp.data; // { access_token, refresh_token, expires_in }
}

module.exports = { getAuthUrl, exchangeCodeForAccessToken };
