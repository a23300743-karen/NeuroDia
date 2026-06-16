const API_BASE = "https://choosing-radio-diabolic.ngrok-free.dev";
let currentUser = null;

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

/* ── STATS ── */
async function loadStats() {
  try {
    const res = await authFetch(`${API_BASE}/pacientes/${currentUser.perfil_id}/registros?limit=30`);
    if (!res || !res.ok) return;
    const data = await res.json();
    if (!data.length) return;
    const last = data[0];
    if (last.glucosa_valor) {
      document.getElementById("stat-glucosa").textContent = last.glucosa_valor;
      document.getElementById("stat-glucosa-sub").textContent = last.glucosa_momento || '';
    }
    if (last.dolor_intensidad !== null && last.dolor_intensidad !== undefined) {
      document.getElementById("stat-dolor").textContent = `${last.dolor_intensidad}/10`;
    }
    const thisMonth = data.filter(r => new Date(r.fecha).getMonth() === new Date().getMonth());
    document.getElementById("stat-registros").textContent = thisMonth.length;
  } catch(e) {
    const stored = JSON.parse(localStorage.getItem("nd_registros") || "[]");
    if (stored.length) {
      const last = stored[0];
      if (last.glucosa_valor) document.getElementById("stat-glucosa").textContent = last.glucosa_valor;
      if (last.dolor_intensidad != null) document.getElementById("stat-dolor").textContent = `${last.dolor_intensidad}/10`;
    }
  }
}

/* ── ALERTAS ── */
async function loadAlertas() {
  try {
    const res = await authFetch(`${API_BASE}/pacientes/${currentUser.perfil_id}/alertas`);
    if (!res || !res.ok) return;
    const alertas = await res.json();
    renderAlertas(alertas);
  } catch(e) {
    const stored = JSON.parse(localStorage.getItem("nd_alertas") || "[]");
    renderAlertas(stored);
  }
}

const alertaTipo = {
  glucosa_alta:    { icon: '🩸', label: 'Glucosa elevada', color: 'red' },
  glucosa_baja:    { icon: '⬇️', label: 'Glucosa baja', color: 'yellow' },
  dolor_severo:    { icon: '😣', label: 'Dolor severo', color: 'red' },
  baja_adherencia: { icon: '💊', label: 'Baja adherencia', color: 'yellow' },
  otro:            { icon: '📋', label: 'Aviso médico', color: 'blue' },
};

function renderAlertas(alertas) {
  const list = document.getElementById("alertas-list");
  const noResueltas = alertas.filter(a => !a.resuelta);
  if (noResueltas.length) {
    document.getElementById("alert-count").style.display = 'inline-flex';
    document.getElementById("alert-count").textContent = `${noResueltas.length} nueva${noResueltas.length > 1 ? 's' : ''}`;
  }
  if (!alertas.length) {
    list.innerHTML = `<div class="empty-state">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      <p>Sin alertas activas. ¡Sigue así!</p>
    </div>`;
    return;
  }
  list.innerHTML = alertas.slice(0, 5).map(a => {
    const t = alertaTipo[a.tipo] || alertaTipo.otro;
    const fecha = new Date(a.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `<div class="alert-item">
      <div class="alert-dot ${t.color}"></div>
      <div class="alert-body">
        <h5>${t.icon} ${t.label}${a.resuelta ? ' <span class="badge badge-ok" style="font-size:11px">Resuelta</span>' : ''}</h5>
        <p>${a.descripcion}</p>
        <div class="alert-time">${fecha}</div>
      </div>
    </div>`;
  }).join('');
}

/* ── PAIN SLIDER ── */
const painLabels = ['Sin dolor','Muy leve','Leve','Leve moderado','Moderado','Moderado','Moderado intenso','Intenso','Muy intenso','Severo','Insoportable'];
document.getElementById("dolor-slider").addEventListener("input", function() {
  const v = parseInt(this.value);
  document.getElementById("pain-display").textContent = v;
  document.getElementById("pain-label").textContent = painLabels[v];
  document.getElementById("dolor-loc-group").style.display = v > 0 ? 'block' : 'none';
});

/* ── FORM SUBMIT ── */
document.getElementById("registroForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  let valid = true;
  const glucosaVal = parseFloat(document.getElementById("glucosa-valor").value);
  const momento = document.getElementById("glucosa-momento").value;
  const dolor = parseInt(document.getElementById("dolor-slider").value);

  document.querySelectorAll(".field-error-msg").forEach(el => el.classList.remove("show"));
  document.querySelectorAll("input.has-error, select.has-error").forEach(el => el.classList.remove("has-error"));

  if (!glucosaVal || glucosaVal < 20 || glucosaVal > 600) {
    document.getElementById("err-glucosa").classList.add("show");
    document.getElementById("glucosa-valor").classList.add("has-error");
    valid = false;
  }
  if (!momento) {
    document.getElementById("err-momento").classList.add("show");
    document.getElementById("glucosa-momento").classList.add("has-error");
    valid = false;
  }
  if (!valid) return;

  const localizaciones = [...document.querySelectorAll(".chip-input[id^='loc-']:checked")].map(c => c.value);
  const sintomas = [...document.querySelectorAll(".chip-input[id^='s-']:checked")].map(c => c.value);
  const today = new Date().toISOString().split('T')[0];
  const payload = { fecha: today, glucosa_valor: glucosaVal, glucosa_momento: momento, dolor_intensidad: dolor, notas: document.getElementById("notas").value.trim() || null, localizaciones, sintomas };

  document.getElementById("btn-text").style.display = "none";
  document.getElementById("btn-loader").style.display = "flex";
  document.getElementById("submit-btn").disabled = true;

  try {
    const res = await authFetch(`${API_BASE}/pacientes/${currentUser.perfil_id}/registros`, { method: "POST", body: JSON.stringify(payload) });
    if (res && res.ok) {
      checkLocalAlerts(glucosaVal, dolor);
      document.getElementById("registroForm").style.display = "none";
      document.getElementById("form-success").classList.add("show");
      await loadStats();
      await loadAlertas();
    } else {
      const err = res ? await res.json() : {};
      showBannerAlert("error", "No se pudo guardar", err.detail || "Error al guardar. Intenta de nuevo.");
    }
  } catch(err) {
    saveLocalDemo(payload);
  } finally {
    document.getElementById("btn-text").style.display = "inline";
    document.getElementById("btn-loader").style.display = "none";
    document.getElementById("submit-btn").disabled = false;
  }
});

function saveLocalDemo(payload) {
  const stored = JSON.parse(localStorage.getItem("nd_registros") || "[]");
  stored.unshift({ ...payload, id: Date.now(), estado: 'completo' });
  localStorage.setItem("nd_registros", JSON.stringify(stored.slice(0, 30)));
  checkLocalAlerts(payload.glucosa_valor, payload.dolor_intensidad);
  document.getElementById("registroForm").style.display = "none";
  document.getElementById("form-success").classList.add("show");
}

function checkLocalAlerts(glucosa, dolor) {
  const alerts = [];
  if (glucosa > 250) alerts.push({ type: 'error', title: '🚨 Glucosa muy elevada', msg: `Tu glucosa de ${glucosa} mg/dL supera el umbral seguro (>250). Contacta a tu médico.` });
  else if (glucosa > 180) alerts.push({ type: 'warning', title: '⚠️ Glucosa elevada', msg: `Tu glucosa de ${glucosa} mg/dL está sobre el rango normal (>180). Monitorea con atención.` });
  else if (glucosa < 70) alerts.push({ type: 'error', title: '⬇️ Glucosa baja (hipoglucemia)', msg: `Tu glucosa de ${glucosa} mg/dL está por debajo del rango mínimo. Consume algo con azúcar.` });
  if (dolor >= 8) alerts.push({ type: 'error', title: '😣 Dolor severo reportado', msg: `Registraste un dolor de ${dolor}/10. Tu médico será notificado.` });
  if (alerts.length) {
    const first = alerts[0];
    showBannerAlert(first.type === 'error' ? 'error' : 'warning', first.title, first.msg);
    const storedAlerts = JSON.parse(localStorage.getItem("nd_alertas") || "[]");
    alerts.forEach(a => storedAlerts.unshift({ tipo: a.type === 'error' && a.title.includes('Glucosa') ? 'glucosa_alta' : a.type === 'error' ? 'dolor_severo' : 'glucosa_alta', descripcion: a.msg, resuelta: false, created_at: new Date().toISOString() }));
    localStorage.setItem("nd_alertas", JSON.stringify(storedAlerts.slice(0, 20)));
    renderAlertas(storedAlerts);
  }
}

function showBannerAlert(type, title, msg) {
  const banner = document.getElementById("alert-banner");
  document.getElementById("alert-banner-title").textContent = title;
  document.getElementById("alert-banner-msg").textContent = msg;
  banner.className = `alert-banner show${type === 'warning' ? ' warning' : ''}`;
  banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetForm() {
  document.getElementById("registroForm").reset();
  document.getElementById("registroForm").style.display = "block";
  document.getElementById("form-success").classList.remove("show");
  document.getElementById("pain-display").textContent = "0";
  document.getElementById("pain-label").textContent = "Sin dolor";
  document.getElementById("dolor-loc-group").style.display = "none";
}

/* ── START ── */
(async function() {
  const now = new Date();
  document.getElementById("fecha-hoy").textContent = now.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById("registro-fecha-badge").textContent = now.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

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
    await loadStats();
    await loadAlertas();
  } else {
    renderAlertas(JSON.parse(localStorage.getItem("nd_alertas") || "[]"));
  }
})();