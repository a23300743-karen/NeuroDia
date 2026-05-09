const API_BASE = "http://localhost:8000";
let currentUser = null;
let pacientesData = [];
let alertasData = [];

/* ── AUTH ── */
function getToken() {
  return localStorage.getItem("nd_token") || sessionStorage.getItem("nd_token");
}
function logout() {
  localStorage.clear(); sessionStorage.clear();
  window.location.href = "index.html";
}
async function authFetch(url, options = {}) {
  const token = getToken();
  if (!token) { window.location.href = "index.html"; return null; }
  const res = await fetch(url, {
    ...options,
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) }
  });
  if (res.status === 401) { window.location.href = "index.html"; return null; }
  return res;
}

/* ── NAVEGACIÓN ── */
const views = ['resumen', 'pacientes', 'detalle', 'alertas', 'alta'];
function showView(name) {
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.style.display = v === name ? 'block' : 'none';
  });
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navMap = { resumen: 'nav-dashboard', pacientes: 'nav-pacientes', alertas: 'nav-alertas', alta: 'nav-alta', detalle: 'nav-pacientes' };
  const navEl = document.getElementById(navMap[name]);
  if (navEl) navEl.classList.add('active');
  if (name === 'pacientes') renderTablaPacientes(pacientesData);
  if (name === 'alertas') renderAlertasView();
}

/* ── DASHBOARD KPIs ── */
async function loadDashboard() {
  const res = await authFetch(`${API_BASE}/medico/dashboard`);
  if (!res || !res.ok) return;
  const d = await res.json();
  document.getElementById("kpi-total").textContent   = d.total_pacientes;
  document.getElementById("kpi-activos").textContent = d.pacientes_activos;
  document.getElementById("kpi-alertas").textContent = d.alertas_pendientes;
  document.getElementById("kpi-sinreg").textContent  = d.sin_registro_7dias;
  if (d.alertas_pendientes > 0) {
    const nb = document.getElementById("nav-alert-count");
    nb.textContent = d.alertas_pendientes;
    nb.style.display = 'inline-flex';
  }
}

/* ── PACIENTES ── */
async function loadPacientes() {
  const res = await authFetch(`${API_BASE}/medico/pacientes`);
  if (!res || !res.ok) return;
  pacientesData = await res.json();
  renderResumenPacientes(pacientesData);
}

function renderResumenPacientes(data) {
  const el = document.getElementById("resumen-pacientes");
  if (!data.length) { el.innerHTML = '<p class="empty-state" style="padding:16px">Sin pacientes registrados.</p>'; return; }
  el.innerHTML = data.slice(0, 5).map(p => `
    <div class="resumen-row" onclick="verDetalle(${p.id})">
      <div class="res-avatar">${p.nombre[0]}${p.apellidos[0]}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13.5px;font-weight:500;color:var(--text)">${p.nombre} ${p.apellidos}</div>
        <div style="font-size:12px;color:var(--text-muted)">${p.tipo_diabetes || '—'} · HbA1c ${p.hba1c || '—'}%</div>
      </div>
      ${p.alertas_activas ? `<span class="badge-alerta">${p.alertas_activas}</span>` : ''}
      ${!p.verificado ? '<span class="badge-pend">Sin verificar</span>' : ''}
    </div>
  `).join('');
}

function renderTablaPacientes(data) {
  const tbody = document.getElementById("tbody-pacientes");
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state" style="padding:40px;text-align:center">Sin pacientes. <a href="#" onclick="showView('alta');return false" style="color:var(--p2)">Dar de alta el primero</a></div></td></tr>`;
    return;
  }
  const diabLabel = { tipo_1: 'Tipo I', tipo_2: 'Tipo II', gestacional: 'Gestacional', otro: 'Otro' };
  tbody.innerHTML = data.map(p => {
    const glucosa = p.ultima_glucosa ? `${p.ultima_glucosa} mg/dL` : '—';
    const gColor = p.ultima_glucosa > 180 ? 'color:var(--error)' : p.ultima_glucosa < 70 ? 'color:var(--warning)' : '';
    const estado = p.verificado
      ? '<span class="badge badge-ok">Verificado</span>'
      : '<span class="badge badge-warn">Pendiente</span>';
    return `<tr onclick="verDetalle(${p.id})" style="cursor:pointer">
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="res-avatar sm">${p.nombre[0]}${p.apellidos[0]}</div>
          <div>
            <div style="font-weight:500">${p.nombre} ${p.apellidos}</div>
            <div style="font-size:11px;color:var(--text-muted)">${p.anios_diagnostico ? p.anios_diagnostico + ' años diag.' : ''}</div>
          </div>
        </div>
      </td>
      <td>${diabLabel[p.tipo_diabetes] || '—'}</td>
      <td>${p.hba1c ? p.hba1c + '%' : '—'}</td>
      <td style="${gColor}">${glucosa}</td>
      <td>${p.alertas_activas ? `<span class="badge badge-error">${p.alertas_activas}</span>` : '<span style="color:var(--text-muted);font-size:12px">—</span>'}</td>
      <td>${estado}</td>
      <td><button class="btn-edit" onclick="event.stopPropagation();verDetalle(${p.id})">Ver →</button></td>
    </tr>`;
  }).join('');
}

function filterPacientes(q) {
  const filtered = pacientesData.filter(p =>
    `${p.nombre} ${p.apellidos}`.toLowerCase().includes(q.toLowerCase())
  );
  renderTablaPacientes(filtered);
}

/* ── DETALLE PACIENTE ── */
async function verDetalle(pacienteId) {
  showView('detalle');
  document.getElementById("detalle-nombre").textContent = "Cargando...";
  document.getElementById("detalle-tbody").innerHTML = '<tr><td colspan="6" style="padding:20px;text-align:center;color:var(--text-muted)">Cargando...</td></tr>';

  const res = await authFetch(`${API_BASE}/medico/pacientes/${pacienteId}/detalle`);
  if (!res || !res.ok) return;
  const { paciente, registros, alertas } = await res.json();

  document.getElementById("detalle-nombre").textContent = `${paciente.nombre} ${paciente.apellidos}`;
  document.getElementById("detalle-subtitulo").textContent = `${paciente.tipo_diabetes || '—'} · ${paciente.anios_diagnostico ? paciente.anios_diagnostico + ' años' : ''} · Grupo: ${paciente.grupo_estudio || '—'}`;

  // Acciones
  const accionesEl = document.getElementById("detalle-acciones");
  accionesEl.innerHTML = paciente.verificado
    ? '<span class="badge-status badge-approved">✓ Verificado</span>'
    : `<button class="btn-primary-purple" onclick="verificarPaciente(${paciente.id})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        Verificar perfil
       </button>`;

  // Info clínica
  document.getElementById("detalle-info").innerHTML = `
    <div class="info-grid">
      <div class="info-item"><span class="info-label">HbA1c</span><span class="info-val">${paciente.hba1c ? paciente.hba1c + '%' : '—'}</span></div>
      <div class="info-item"><span class="info-label">Diagnóstico</span><span class="info-val">${paciente.anios_diagnostico ? paciente.anios_diagnostico + ' años' : '—'}</span></div>
      <div class="info-item"><span class="info-label">Consentimiento</span><span class="info-val">${paciente.consentimiento ? '✅ Firmado' : '⏳ Pendiente'}</span></div>
      <div class="info-item"><span class="info-label">Grupo</span><span class="info-val">${paciente.grupo_estudio || '—'}</span></div>
    </div>
    ${paciente.comorbilidades.length ? `<div style="margin-top:14px"><div class="info-label" style="margin-bottom:6px">Comorbilidades</div><div class="pill-group">${paciente.comorbilidades.map(c => `<span class="pill active">${c}</span>`).join('')}</div></div>` : ''}
    ${paciente.medicamentos.length ? `<div style="margin-top:14px"><div class="info-label" style="margin-bottom:6px">Medicamentos</div>${paciente.medicamentos.map(m => `<div class="list-item-row"><div><div class="item-label">${m.nombre}</div><div class="item-sub">${m.dosis || ''}</div></div></div>`).join('')}</div>` : ''}
  `;

  // Tabla registros
  const momentoLabel = { ayunas: 'Ayunas', postprandial: 'Postprandial', nocturno: 'Nocturno' };
  document.getElementById("detalle-tbody").innerHTML = registros.length
    ? registros.map(r => {
        const g = r.glucosa_valor ? `${r.glucosa_valor} mg/dL` : '—';
        const gC = r.glucosa_valor > 180 ? 'color:var(--error)' : r.glucosa_valor < 70 ? 'color:var(--warning)' : '';
        const d = r.dolor_intensidad !== null ? r.dolor_intensidad : '—';
        const dC = r.dolor_intensidad >= 7 ? 'color:var(--error)' : r.dolor_intensidad >= 4 ? 'color:var(--warning)' : '';
        const fecha = new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' });
        const estadoBadge = { completo: 'badge-ok', incompleto: 'badge-warn', pendiente: 'badge-muted' };
        return `<tr>
          <td>${fecha}</td>
          <td style="${gC}">${g}</td>
          <td>${momentoLabel[r.glucosa_momento] || '—'}</td>
          <td style="${dC}">${d !== '—' ? d + '/10' : '—'}</td>
          <td style="font-size:12px;color:var(--text-muted)">${(r.sintomas || []).join(', ') || '—'}</td>
          <td><span class="badge ${estadoBadge[r.estado] || ''}">${r.estado}</span></td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">Sin registros todavía.</td></tr>';

  // Alertas del paciente
  const alertasEl = document.getElementById("detalle-alertas-list");
  const alertaTipo = {
    glucosa_alta: { icon: '🩸', color: 'red' }, glucosa_baja: { icon: '⬇️', color: 'yellow' },
    dolor_severo: { icon: '😣', color: 'red' }, baja_adherencia: { icon: '💊', color: 'yellow' },
    otro: { icon: '📋', color: 'blue' }
  };
  alertasEl.innerHTML = alertas.length
    ? alertas.map(a => {
        const t = alertaTipo[a.tipo] || alertaTipo.otro;
        const fecha = new Date(a.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        return `<div class="alert-item-med ${a.resuelta ? 'resuelta' : ''}">
          <span style="font-size:18px">${t.icon}</span>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:500">${a.descripcion}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${fecha}</div>
          </div>
          ${!a.resuelta ? `<button class="btn-resolver" onclick="resolverAlerta(${a.id}, this)">Resolver</button>` : '<span class="badge badge-ok" style="font-size:11px">Resuelta</span>'}
        </div>`;
      }).join('')
    : '<p class="empty-state">Sin alertas registradas.</p>';
}

async function verificarPaciente(id) {
  const res = await authFetch(`${API_BASE}/medico/pacientes/${id}/verificar`, { method: 'PATCH' });
  if (res && res.ok) {
    document.getElementById("detalle-acciones").innerHTML = '<span class="badge-status badge-approved">✓ Verificado</span>';
    // actualizar lista local
    const p = pacientesData.find(x => x.id === id);
    if (p) p.verificado = true;
  }
}

async function resolverAlerta(id, btn) {
  const res = await authFetch(`${API_BASE}/alertas/${id}/resolver`, { method: 'PATCH' });
  if (res && res.ok) {
    btn.closest('.alert-item-med').classList.add('resuelta');
    btn.replaceWith(Object.assign(document.createElement('span'), {
      className: 'badge badge-ok', style: 'font-size:11px', textContent: 'Resuelta'
    }));
    await loadDashboard();
  }
}

/* ── ALERTAS ── */
async function loadAlertas() {
  const res = await authFetch(`${API_BASE}/medico/alertas`);
  if (!res || !res.ok) return;
  alertasData = await res.json();
  renderResumenAlertas(alertasData);
}

function renderResumenAlertas(alertas) {
  const el = document.getElementById("resumen-alertas");
  if (!alertas.length) { el.innerHTML = '<p class="empty-state" style="padding:16px">Sin alertas pendientes. ¡Todo en orden!</p>'; return; }
  const alertaTipo = {
    glucosa_alta: '🩸', glucosa_baja: '⬇️', dolor_severo: '😣', baja_adherencia: '💊', otro: '📋'
  };
  el.innerHTML = alertas.slice(0, 6).map(a => `
    <div class="alert-item-med" style="padding:10px 16px">
      <span style="font-size:16px">${alertaTipo[a.tipo] || '📋'}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.descripcion}</div>
        <div style="font-size:11px;color:var(--text-muted)">${new Date(a.created_at).toLocaleDateString('es-MX', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
      </div>
      <button class="btn-resolver" onclick="resolverAlertaYRefrescar(${a.id}, this)">Resolver</button>
    </div>
  `).join('');
}

async function resolverAlertaYRefrescar(id, btn) {
  const res = await authFetch(`${API_BASE}/alertas/${id}/resolver`, { method: 'PATCH' });
  if (res && res.ok) {
    btn.closest('.alert-item-med').style.opacity = '0.4';
    btn.disabled = true;
    btn.textContent = '✓';
    await loadDashboard();
    await loadAlertas();
  }
}

function renderAlertasView() {
  const el = document.getElementById("alertas-contenido");
  if (!alertasData.length) {
    el.innerHTML = '<div class="empty-state" style="padding:40px;text-align:center"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="margin-bottom:10px;opacity:.3"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><p>Sin alertas pendientes. ¡Todo en orden!</p></div>';
    return;
  }
  const alertaTipo = { glucosa_alta: '🩸', glucosa_baja: '⬇️', dolor_severo: '😣', baja_adherencia: '💊', otro: '📋' };
  el.innerHTML = alertasData.map(a => `
    <div class="alert-item-med" style="padding:14px 20px;border-bottom:1px solid var(--border)" id="alerta-row-${a.id}">
      <span style="font-size:20px">${alertaTipo[a.tipo] || '📋'}</span>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:500;color:var(--text)">${a.descripcion}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${new Date(a.created_at).toLocaleDateString('es-MX', {weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
      </div>
      <button class="btn-resolver" onclick="resolverAlertaYRefrescar(${a.id}, this)">Marcar resuelta</button>
    </div>
  `).join('');
}

/* ── VINCULAR PACIENTE ── */
document.getElementById("alta-form").addEventListener("submit", async function(e) {
  e.preventDefault();
  document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
  document.getElementById("alta-error").style.display = 'none';

  const email = document.getElementById("alta-email").value.trim();
  if (!email) {
    document.getElementById("err-alta-email").textContent = "Ingresa el correo del paciente.";
    return;
  }

  const btn = document.getElementById("alta-btn");
  btn.disabled = true;
  document.getElementById("alta-btn-text").style.display = "none";
  document.getElementById("alta-btn-loader").style.display = "inline";

  try {
    const res = await authFetch(`${API_BASE}/medico/vincular-paciente`, { method: 'POST', body: JSON.stringify({ email }) });
    if (res && res.ok) {
      const paciente = await res.json();
      document.getElementById("alta-success-nombre").textContent = `${paciente.nombre} ${paciente.apellidos}`;
      document.getElementById("alta-form").style.display = "none";
      document.getElementById("alta-success").style.display = "block";
      await loadPacientes();
      await loadDashboard();
    } else {
      const err = res ? await res.json() : {};
      document.getElementById("alta-error").textContent = err.detail || "Error al vincular. Intenta de nuevo.";
      document.getElementById("alta-error").style.display = "block";
    }
  } finally {
    btn.disabled = false;
    document.getElementById("alta-btn-text").style.display = "inline";
    document.getElementById("alta-btn-loader").style.display = "none";
  }
});

function resetAltaForm() {
  document.getElementById("alta-form").reset();
  document.getElementById("alta-form").style.display = "block";
  document.getElementById("alta-success").style.display = "none";
}

/* ── INIT ── */
(async function() {
  const stored = localStorage.getItem("nd_user") || sessionStorage.getItem("nd_user");
  if (!stored) { window.location.href = "index.html"; return; }
  currentUser = JSON.parse(stored);
  if (currentUser.rol !== 'medico') { window.location.href = "perfil.html"; return; }

  const iniciales = `${currentUser.nombre?.[0] || ''}${currentUser.apellidos?.[0] || ''}`.toUpperCase();
  document.getElementById("sidebar-avatar").textContent = iniciales || 'Dr';
  document.getElementById("sidebar-nombre").textContent = `Dr. ${currentUser.nombre}`;
  document.getElementById("medico-nombre").textContent = currentUser.apellidos || currentUser.nombre;
  document.getElementById("fecha-hoy").textContent = new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  await Promise.all([loadDashboard(), loadPacientes(), loadAlertas()]);
})();