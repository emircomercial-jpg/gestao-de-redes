const axios = require('axios');
const querystring = require('querystring');

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const API_VERSION = process.env.LINKEDIN_API_VERSION || 'v2';

function getAuthUrl(redirectUri, state) {
  if (!CLIENT_ID) throw new Error('LINKEDIN_CLIENT_ID not configured');
  const params = {
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    state,
    scope: 'r_liteprofile w_member_social w_organization_social rw_organization_admin',
  };
  return `https://www.linkedin.com/oauth/v2/authorization?${querystring.stringify(params)}`;
}

async function exchangeCodeForAccessToken(code, redirectUri) {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET not configured');
  const url = `https://www.linkedin.com/oauth/v2/accessToken`;
  const params = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  };
  const resp = await axios.post(url, querystring.stringify(params), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 });
  return resp.data; // { access_token, expires_in }
}

module.exports = { getAuthUrl, exchangeCodeForAccessToken };
