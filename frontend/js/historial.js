const API_BASE = "http://localhost:8000";
let currentUser = null;
let glucosaChartInstance = null;
let dolorChartInstance = null;

/* ── AUTH ── */
function getToken() {
  return localStorage.getItem("nd_token") || sessionStorage.getItem("nd_token");
}

function logout() {
  localStorage.removeItem("nd_token"); localStorage.removeItem("nd_user");
  sessionStorage.removeItem("nd_token"); sessionStorage.removeItem("nd_user");
  window.location.href = "index.html";
}

async function authFetch(url, options = {}) {
  const token = getToken();
  if (!token) { window.location.href = "index.html"; return; }
  return fetch(url, {
    ...options,
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) }
  });
}

/* ── CARGAR HISTORIAL ── */
async function loadHistorial() {
  try {
    const res = await authFetch(`${API_BASE}/pacientes/${currentUser.perfil_id}/registros?limit=90`);
    if (!res || !res.ok) { renderHistorialEmpty(); return; }
    const data = await res.json();
    renderHistorialTable(data);
    renderGlucosaChart(data);
    renderDolorChart(data);
    updateStats(data);
  } catch(e) {
    // fallback a datos locales
    const stored = JSON.parse(localStorage.getItem("nd_registros") || "[]");
    renderHistorialTable(stored);
    renderGlucosaChart(stored);
    renderDolorChart(stored);
    updateStats(stored);
  }
}

function renderHistorialEmpty() {
  document.getElementById("history-tbody").innerHTML =
    `<tr><td colspan="6"><div class="empty-state">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <p>No hay registros todavía. ¡Empieza en Monitoreo Diario!</p>
    </div></td></tr>`;
  renderGlucosaChart([]);
  renderDolorChart([]);
}

function renderHistorialTable(data) {
  const tbody = document.getElementById("history-tbody");
  if (!data || !data.length) { renderHistorialEmpty(); return; }

  const momentoLabel = { ayunas: 'Ayunas', postprandial: 'Postprandial', nocturno: 'Nocturno' };
  const estadoBadge = {
    completo:   '<span class="badge badge-ok">Completo</span>',
    incompleto: '<span class="badge badge-warn">Incompleto</span>',
    pendiente:  '<span class="badge badge-muted">Pendiente</span>'
  };

  tbody.innerHTML = data.map(r => {
    const g = r.glucosa_valor ? `${r.glucosa_valor} <small>mg/dL</small>` : '—';
    const gClass = r.glucosa_valor > 180 ? 'color:var(--error)' : r.glucosa_valor < 70 ? 'color:var(--warning)' : '';
    const d = r.dolor_intensidad !== null && r.dolor_intensidad !== undefined ? r.dolor_intensidad : '—';
    const dClass = r.dolor_intensidad >= 7 ? 'color:var(--error)' : r.dolor_intensidad >= 4 ? 'color:var(--warning)' : '';
    const fecha = new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' });
    const sintomas = r.sintomas && r.sintomas.length ? r.sintomas.join(', ') : '—';
    return `<tr>
      <td>${fecha}</td>
      <td style="${gClass}">${g}</td>
      <td>${momentoLabel[r.glucosa_momento] || '—'}</td>
      <td style="${dClass}">${d !== '—' ? d + '/10' : '—'}</td>
      <td style="font-size:12px;color:var(--text-muted);max-width:160px">${sintomas}</td>
      <td>${estadoBadge[r.estado] || ''}</td>
    </tr>`;
  }).join('');

  const thisMonth = data.filter(r => new Date(r.fecha).getMonth() === new Date().getMonth());
  document.getElementById("stat-registros").textContent = thisMonth.length;
}

function updateStats(data) {
  if (!data || !data.length) return;
  const last = data[0];
  if (last.glucosa_valor) {
    document.getElementById("stat-glucosa").textContent = `${last.glucosa_valor}`;
    document.getElementById("stat-glucosa-sub").textContent = last.glucosa_momento || '';
  }
  if (last.dolor_intensidad !== null && last.dolor_intensidad !== undefined) {
    document.getElementById("stat-dolor").textContent = `${last.dolor_intensidad}/10`;
  }
}

/* ── CHARTS ── */
function renderGlucosaChart(data) {
  const ctx = document.getElementById('glucosaChart').getContext('2d');
  if (glucosaChartInstance) glucosaChartInstance.destroy();

  const recent = [...(data || [])].reverse().slice(-14);
  const labels = recent.map(r => new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }));
  const values = recent.map(r => r.glucosa_valor || null);

  glucosaChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels.length ? labels : ['Sin datos'],
      datasets: [{
        label: 'Glucosa (mg/dL)',
        data: values.length ? values : [null],
        borderColor: '#706fa1', backgroundColor: 'rgba(112,111,161,.1)',
        tension: 0.4, fill: true, pointRadius: 4, pointBackgroundColor: '#4a4888',
        spanGaps: true
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#8a8aaa' } },
        y: { grid: { color: '#f0eff9' }, ticks: { font: { size: 11 }, color: '#8a8aaa' }, suggestedMin: 60, suggestedMax: 200 }
      }
    }
  });
}

function renderDolorChart(data) {
  const ctx = document.getElementById('dolorChart').getContext('2d');
  if (dolorChartInstance) dolorChartInstance.destroy();

  const recent = [...(data || [])].reverse().slice(-14);
  const labels = recent.map(r => new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }));
  const values = recent.map(r => r.dolor_intensidad !== null && r.dolor_intensidad !== undefined ? r.dolor_intensidad : null);

  dolorChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['Sin datos'],
      datasets: [{
        label: 'Dolor',
        data: values.length ? values : [null],
        backgroundColor: values.map(v => v >= 7 ? 'rgba(163,45,45,.5)' : v >= 4 ? 'rgba(212,160,23,.5)' : 'rgba(45,110,69,.4)'),
        borderRadius: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#8a8aaa' } },
        y: { min: 0, max: 10, grid: { color: '#f0eff9' }, ticks: { font: { size: 11 }, color: '#8a8aaa' } }
      }
    }
  });
}

/* ── TABS ── */
function switchHist(tab, btn) {
  document.querySelectorAll(".hist-tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".hist-panel").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById(`hist-${tab}`).classList.add("active");
}

/* ── START ── */
(async function() {
  const stored = localStorage.getItem("nd_user") || sessionStorage.getItem("nd_user");
  if (stored) {
    currentUser = JSON.parse(stored);
    const iniciales = `${currentUser.nombre?.[0] || ''}${currentUser.apellidos?.[0] || ''}`.toUpperCase();
    document.getElementById("sidebar-avatar").textContent = iniciales || '--';
    document.getElementById("sidebar-nombre").textContent = `${currentUser.nombre} ${currentUser.apellidos || ''}`.trim();
  } else {
    document.getElementById("sidebar-nombre").textContent = "Paciente";
  }

  if (getToken() && currentUser) {
    await loadHistorial();
  } else {
    const local = JSON.parse(localStorage.getItem("nd_registros") || "[]");
    renderHistorialTable(local);
    renderGlucosaChart(local);
    renderDolorChart(local);
    updateStats(local);
  }
})();