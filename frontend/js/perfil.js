const API_BASE = "http://localhost:8000";
let currentUser = null;
let perfilData = null;
let snapshots = {}; // guardar valores originales para cancelar

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
  return fetch(url, {
    ...options,
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) }
  });
}

/* ── TOGGLE EDICIÓN ── */
function toggleEdit(section) {
  const form = document.getElementById(`form-${section}`);
  const actions = document.getElementById(`actions-${section}`);
  const btn = document.getElementById(`btn-edit-${section}`);
  const isEditing = btn.textContent.trim() === 'Cancelar';

  if (isEditing) {
    cancelEdit(section);
    return;
  }

  // Solo permitir editar si el perfil está verificado
  if (!perfilData?.verificado) {
    showAlert("Tu perfil aún no ha sido verificado por tu médico. Una vez verificado podrás editar tus datos.", "error");
    return;
  }

  // Guardar snapshot
  snapshots[section] = {};
  form.querySelectorAll('input, select').forEach(el => {
    if (el.id) snapshots[section][el.id] = el.value;
  });

  form.querySelectorAll('input:not([type="checkbox"]), select').forEach(el => el.disabled = false);
  actions.style.display = 'flex';
  btn.textContent = 'Cancelar';
}

function cancelEdit(section) {
  const form = document.getElementById(`form-${section}`);
  const actions = document.getElementById(`actions-${section}`);
  const btn = document.getElementById(`btn-edit-${section}`);

  // Restaurar valores
  if (snapshots[section]) {
    Object.entries(snapshots[section]).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    });
  }
  form.querySelectorAll('input, select').forEach(el => el.disabled = true);
  actions.style.display = 'none';
  btn.textContent = 'Editar';
  hideAlerts();
}

/* ── GUARDAR SECCIONES ── */
async function savePersonal() {
  const payload = {
    nombre:           document.getElementById("p-nombre").value.trim(),
    apellidos:        document.getElementById("p-apellidos").value.trim(),
    fecha_nacimiento: document.getElementById("p-nacimiento").value || null,
    sexo:             document.getElementById("p-sexo").value || null,
    curp:             document.getElementById("p-curp").value.trim().toUpperCase() || null,
    telefono:         document.getElementById("p-telefono").value.trim() || null,
  };
  await savePerfil(payload, 'personal');
}

async function saveClinicos() {
  const payload = {
    tipo_diabetes:     document.getElementById("p-diabetes").value || null,
    anios_diagnostico: parseInt(document.getElementById("p-anios").value) || null,
    hba1c:             parseFloat(document.getElementById("p-hba1c").value) || null,
    grupo_estudio:     document.getElementById("p-grupo").value.trim() || null,
  };
  await savePerfil(payload, 'clinico');
}

async function savePerfil(payload, section) {
  const btn = document.querySelector(`#actions-${section} .btn-save`);
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const res = await authFetch(`${API_BASE}/pacientes/${currentUser.perfil_id}/perfil`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });

  btn.disabled = false;
  btn.textContent = 'Guardar cambios';

  if (res && res.ok) {
    perfilData = await res.json();
    fillForm(perfilData);
    cancelEdit(section);
    showSuccess("Cambios guardados correctamente.");
  } else {
    const err = res ? await res.json() : {};
    showAlert(err.detail || "Error al guardar. Intenta de nuevo.", "error");
  }
}

/* ── CARGAR Y LLENAR ── */
async function loadPerfil() {
  document.getElementById("loading-state").style.display = 'flex';
  document.getElementById("perfil-content").style.display = 'none';

  const res = await authFetch(`${API_BASE}/pacientes/${currentUser.perfil_id}/perfil`);
  if (!res || !res.ok) {
    document.getElementById("loading-state").style.display = 'none';
    showAlert("No se pudo cargar tu perfil.", "error");
    return;
  }
  perfilData = await res.json();
  fillForm(perfilData);

  // Estado verificado
  const estadoEl = document.getElementById("estado-aprobacion");
  if (perfilData.verificado) {
    estadoEl.className = 'badge-status badge-approved';
    estadoEl.textContent = 'Perfil verificado';
    // Mostrar aviso de que puede editar
    document.getElementById("verif-banner").style.display = 'none';
  } else {
    estadoEl.className = 'badge-status badge-pending';
    estadoEl.textContent = 'Pendiente de verificación';
    document.getElementById("verif-banner").style.display = 'flex';
  }

  // Stats
  loadStats();

  document.getElementById("loading-state").style.display = 'none';
  document.getElementById("perfil-content").style.display = 'block';
}

function fillForm(data) {
  // Hero
  const nombre = `${data.nombre || ''} ${data.apellidos || ''}`.trim();
  document.getElementById("hero-nombre").textContent = nombre || '—';
  document.getElementById("hero-email").textContent = currentUser.email || '—';
  const iniciales = `${data.nombre?.[0] || ''}${data.apellidos?.[0] || ''}`.toUpperCase();
  document.getElementById("hero-avatar").textContent = iniciales || '--';
  document.getElementById("sidebar-avatar").textContent = iniciales || '--';
  document.getElementById("sidebar-nombre").textContent = nombre;

  // Tags
  const tags = [];
  if (data.tipo_diabetes) tags.push({ tipo_1: 'Diabetes Tipo I', tipo_2: 'Diabetes Tipo II', gestacional: 'Gestacional', otro: 'Otro' }[data.tipo_diabetes] || data.tipo_diabetes);
  if (data.grupo_estudio) tags.push(data.grupo_estudio);
  if (data.consentimiento) tags.push('Consentimiento firmado');
  document.getElementById("hero-tags").innerHTML = tags.map(t => `<span class="hero-tag">${t}</span>`).join('');

  // Stat boxes
  document.getElementById("stat-hba1c").textContent = data.hba1c ? data.hba1c + '%' : '—';
  document.getElementById("stat-anios").textContent = data.anios_diagnostico ?? '—';

  // Datos personales
  setVal("p-nombre",     data.nombre);
  setVal("p-apellidos",  data.apellidos);
  setVal("p-nacimiento", data.fecha_nacimiento);
  setVal("p-sexo",       data.sexo);
  setVal("p-curp",       data.curp);
  setVal("p-telefono",   data.telefono);

  // Datos clínicos
  setVal("p-diabetes",   data.tipo_diabetes);
  setVal("p-anios",      data.anios_diagnostico);
  setVal("p-hba1c",      data.hba1c);
  setVal("p-grupo",      data.grupo_estudio);
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el && val !== null && val !== undefined) el.value = val;
}

async function loadStats() {
  try {
    const res = await authFetch(`${API_BASE}/pacientes/${currentUser.perfil_id}/registros?limit=90`);
    if (!res || !res.ok) return;
    const data = await res.json();
    document.getElementById("stat-registros").textContent = data.length;
    const thisMonth = data.filter(r => new Date(r.fecha).getMonth() === new Date().getMonth());
    const adherencia = data.length ? Math.round((thisMonth.length / 30) * 100) + '%' : '—';
    document.getElementById("stat-adherencia").textContent = adherencia;
  } catch(e) {}
}

/* ── COMORBILIDADES ── */
async function loadComorbilidades() {
  const res = await authFetch(`${API_BASE}/pacientes/${currentUser.perfil_id}/comorbilidades`);
  if (!res || !res.ok) return;
  const data = await res.json();
  renderComorbilidades(data);
}

function renderComorbilidades(data) {
  const el = document.getElementById("comorbilidades-list");
  if (!data.length) { el.innerHTML = '<p class="empty-state">Sin comorbilidades registradas.</p>'; return; }
  el.innerHTML = data.map(c => `
    <div class="list-item-row">
      <div class="item-label">${c.nombre}</div>
      <button class="item-delete" onclick="deleteComorbilidad(${c.id})" title="Eliminar">×</button>
    </div>
  `).join('');
}

function toggleAddComorbilidad() {
  const el = document.getElementById("add-comorbilidad-form");
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function addComorbilidad() {
  const nombre = document.getElementById("nueva-comorbilidad").value.trim();
  if (!nombre) return;
  const res = await authFetch(`${API_BASE}/pacientes/${currentUser.perfil_id}/comorbilidades`, {
    method: 'POST', body: JSON.stringify({ nombre })
  });
  if (res && res.ok) {
    document.getElementById("nueva-comorbilidad").value = '';
    toggleAddComorbilidad();
    await loadComorbilidades();
  }
}

async function deleteComorbilidad(id) {
  const res = await authFetch(`${API_BASE}/comorbilidades/${id}`, { method: 'DELETE' });
  if (res && res.ok) await loadComorbilidades();
}

/* ── MEDICAMENTOS ── */
async function loadMedicamentos() {
  const res = await authFetch(`${API_BASE}/pacientes/${currentUser.perfil_id}/medicamentos`);
  if (!res || !res.ok) return;
  const data = await res.json();
  renderMedicamentos(data);
}

function renderMedicamentos(data) {
  const el = document.getElementById("medicamentos-list");
  if (!data.length) { el.innerHTML = '<p class="empty-state">Sin medicamentos registrados.</p>'; return; }
  el.innerHTML = data.map(m => `
    <div class="list-item-row">
      <div>
        <div class="item-label">${m.nombre}</div>
        <div class="item-sub">${[m.dosis, m.frecuencia].filter(Boolean).join(' · ')}</div>
      </div>
      <button class="item-delete" onclick="deleteMedicamento(${m.id})" title="Eliminar">×</button>
    </div>
  `).join('');
}

function toggleAddMedicamento() {
  const el = document.getElementById("add-med-form");
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function addMedicamento() {
  const nombre = document.getElementById("med-nombre").value.trim();
  if (!nombre) return;
  const payload = {
    nombre,
    dosis:      document.getElementById("med-dosis").value.trim() || null,
    frecuencia: document.getElementById("med-frecuencia").value.trim() || null,
  };
  const res = await authFetch(`${API_BASE}/pacientes/${currentUser.perfil_id}/medicamentos`, {
    method: 'POST', body: JSON.stringify(payload)
  });
  if (res && res.ok) {
    document.getElementById("med-nombre").value = '';
    document.getElementById("med-dosis").value = '';
    document.getElementById("med-frecuencia").value = '';
    toggleAddMedicamento();
    await loadMedicamentos();
  }
}

async function deleteMedicamento(id) {
  const res = await authFetch(`${API_BASE}/medicamentos/${id}`, { method: 'DELETE' });
  if (res && res.ok) await loadMedicamentos();
}

/* ── ALERTAS UI ── */
function showAlert(msg, type = 'error') {
  const el = document.getElementById("page-alert");
  el.textContent = msg;
  el.style.display = 'block';
  el.className = type === 'error' ? 'page-alert' : 'page-alert page-alert-success';
  setTimeout(() => el.style.display = 'none', 5000);
}
function showSuccess(msg) { showAlert(msg, 'success'); }
function hideAlerts() {
  document.getElementById("page-alert").style.display = 'none';
  document.getElementById("page-success").style.display = 'none';
}

/* ── INIT ── */
document.addEventListener("DOMContentLoaded", async () => {
  const stored = localStorage.getItem("nd_user") || sessionStorage.getItem("nd_user");
  if (!stored) { window.location.href = "index.html"; return; }
  currentUser = JSON.parse(stored);

  await loadPerfil();
  await loadComorbilidades();
  await loadMedicamentos();
});