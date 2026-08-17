async function fetchMetrics(tenant){
  const res = await fetch('/metrics?tenant=' + encodeURIComponent(tenant));
  return await res.json();
}

function drawCost(data){
  const ctx = document.getElementById('costChart').getContext('2d');
  if (window.costChart) window.costChart.destroy();
  const labels = data.costs.byModel ? Object.keys(data.costs.byModel) : [];
  const vals = labels.map(k => data.costs.byModel[k]);
  window.costChart = new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label: 'Cost', data: vals }] } });
}

function drawLat(data){
  const ctx = document.getElementById('latChart').getContext('2d');
  if (window.latChart) window.latChart.destroy();
  const labels = Object.keys(data.latencies.avgByPath || {});
  const vals = labels.map(k => data.latencies.avgByPath[k]);
  window.latChart = new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label: 'Avg ms', data: vals }] } });
}

async function refresh(){
  const tenant = document.getElementById('tenant').value || 'default';
  const data = await fetchMetrics(tenant);
  drawCost(data);
  drawLat(data);
  document.getElementById('alerts').innerText = JSON.stringify(data.recentAlerts, null, 2);
}

document.getElementById('refresh').addEventListener('click', refresh);
window.addEventListener('load', refresh);
