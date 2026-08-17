const assert = require('assert');
const fb = require('../src/connectors/facebook');
const li = require('../src/connectors/linkedin');
const x = require('../src/connectors/x');

async function run(){
  console.log('Connector tests...');
  try {
    // Functions should reject when required params are missing
    await assert.rejects(() => fb.publishToFacebookPage(null, null, 'hi'), /required/);
    await assert.rejects(() => li.publishToLinkedIn(null, null, 'hi'), /required/);
    await assert.rejects(() => x.publishToX(null, 'hi'), /required/);
    console.log('connectors: ok');
  } catch (e) {
    console.error('connectors tests failed', e);
    process.exit(1);
  }
}

run();
