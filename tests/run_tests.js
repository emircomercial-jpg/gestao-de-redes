async function run(){
  const base = 'http://localhost:3000';
  console.log('Dry-run test...');
  const r1 = await fetch(base + '/generate?dry=1', { method: 'POST', headers: {'Content-Type':'application/json','X-Tenant-Id':'test-tenant'}, body: JSON.stringify({ prompt: 'Hello world, this is a test to estimate cost', type: 'summary' }) });
  const j1 = await r1.json();
  console.log('dry:', j1);

  console.log('Real generation test...');
  const r2 = await fetch(base + '/generate', { method: 'POST', headers: {'Content-Type':'application/json','X-Tenant-Id':'test-tenant'}, body: JSON.stringify({ prompt: 'Hello world, this is a test to actually generate', type: 'summary' }) });
  const j2 = await r2.json();
  console.log('real:', j2);
}

run().catch(e=>{ console.error(e); process.exit(1); });
