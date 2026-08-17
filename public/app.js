async function fetchDrafts(tenant){
  const res = await fetch(`/drafts?tenant=${encodeURIComponent(tenant)}`);
  if (!res.ok) return [];
  const j = await res.json();
  return j.drafts || [];
}

function renderDraft(d){
  const el = document.createElement('div');
  el.className = 'draft';
  el.innerHTML = `
    <div class="meta">id: ${d.id} • status: ${d.status} • created: ${new Date(d.created_at).toLocaleString()}</div>
    <pre>${escapeHtml(d.message)}</pre>
    <div>
      <button data-action="approve" data-id="${d.id}">Aprovar</button>
      <button data-action="reject" data-id="${d.id}">Rejeitar</button>
    </div>
  `;
  return el;
}

function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

async function refresh(){
  const tenant = document.getElementById('tenant').value || 'default';
  const list = document.getElementById('list');
  list.innerHTML = 'Carregando...';
  const drafts = await fetchDrafts(tenant);
  if (!drafts.length) { list.innerHTML = '<i>Nenhum rascunho</i>'; return; }
  list.innerHTML = '';
  for (const d of drafts){
    const el = renderDraft(d);
    list.appendChild(el);
  }
}

document.getElementById('refresh').addEventListener('click', refresh);

document.getElementById('list').addEventListener('click', async (e)=>{
  const btn = e.target.closest('button');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  const tenant = document.getElementById('tenant').value || 'default';
  if (action === 'approve'){
    await fetch(`/drafts/${id}/approve`, { method: 'POST', headers: { 'X-Tenant-Id': tenant }});
    await refresh();
  } else if (action === 'reject'){
    const reason = prompt('Motivo da rejeição (opcional)');
    await fetch(`/drafts/${id}/reject`, { method: 'POST', headers: { 'Content-Type':'application/json','X-Tenant-Id': tenant }, body: JSON.stringify({ reason })});
    await refresh();
  }
});

// auto refresh on load
refresh();
