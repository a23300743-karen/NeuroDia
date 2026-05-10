/* ════════════════════════════════════════════
   NeuroDia — chat-medico.js
   Chat del médico: conversaciones múltiples
════════════════════════════════════════════ */

const ChatMedico = (function() {
  const API_BASE = "http://localhost:8000";
  let ws = null;
  let pacienteActivo = null;
  let conversaciones = [];
  let mensajesCache = {}; // {paciente_id: [...mensajes]}

  function getToken() {
    return localStorage.getItem("nd_token") || sessionStorage.getItem("nd_token");
  }

  // ── WebSocket ───────────────────────────────
  function conectar(currentUser) {
    if (!currentUser) return;
    const token = getToken();
    const wsUrl = `ws://localhost:8000/ws/chat/${currentUser.id}?token=${token}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => console.log("[ChatMedico] WS conectado");

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      const pid = msg.paciente_id;
      if (!pid) return;

      // Guardar en cache
      if (!mensajesCache[pid]) mensajesCache[pid] = [];
      if (!mensajesCache[pid].find(m => m.id === msg.id)) {
        mensajesCache[pid].push(msg);
      }

      // Si es la conversación activa, renderizar
      if (pacienteActivo === pid) {
        appendMsgToPanel(msg);
      } else if (msg.emisor === 'paciente') {
        // Badge en lista de conversaciones
        const conv = conversaciones.find(c => c.paciente_id === pid);
        if (conv) {
          conv.no_leidos = (conv.no_leidos || 0) + 1;
          conv.ultimo_mensaje = msg.contenido;
          conv.ultimo_at = msg.created_at;
          conv.ultimo_emisor = 'paciente';
          renderConversaciones();
        }
      }
    };

    ws.onclose = () => setTimeout(() => conectar(currentUser), 3000);
    ws.onerror = () => ws.close();
  }

  // ── Cargar conversaciones ───────────────────
  async function cargarConversaciones() {
    const token = getToken();
    try {
      const res = await fetch(`${API_BASE}/chat/medico/conversaciones`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return;
      conversaciones = await res.json();
      renderConversaciones();
      // Notificar al dashboard
      const total = conversaciones.reduce((s, c) => s + c.no_leidos, 0);
      const badge = document.getElementById("nav-chat-count");
      if (badge) {
        badge.textContent = total;
        badge.style.display = total > 0 ? 'inline-flex' : 'none';
      }
    } catch(e) {}
  }

  function renderConversaciones() {
    const el = document.getElementById("chat-conv-list");
    if (!el) return;

    if (!conversaciones.length) {
      el.innerHTML = `<div style="padding:24px;text-align:center;color:#8a8aaa;font-size:13px">
        Sin conversaciones todavía.<br>Los pacientes pueden escribirte desde la app.
      </div>`;
      return;
    }

    el.innerHTML = conversaciones.map(c => {
      const activo = pacienteActivo === c.paciente_id ? 'chat-conv-item--activo' : '';
      const hora = c.ultimo_at
        ? new Date(c.ultimo_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
        : '';
      const preview = c.ultimo_mensaje
        ? (c.ultimo_emisor === 'medico' ? 'Tú: ' : '') + c.ultimo_mensaje.substring(0, 40)
        : 'Sin mensajes aún';
      return `
        <div class="chat-conv-item ${activo}" onclick="ChatMedico.abrirConversacion(${c.paciente_id})">
          <div class="chat-conv-avatar">${c.iniciales}</div>
          <div class="chat-conv-info">
            <div class="chat-conv-nombre">${c.nombre}</div>
            <div class="chat-conv-preview">${preview}</div>
          </div>
          <div class="chat-conv-meta">
            ${hora ? `<div class="chat-conv-hora">${hora}</div>` : ''}
            ${c.no_leidos > 0 ? `<div class="chat-conv-badge">${c.no_leidos}</div>` : ''}
          </div>
        </div>`;
    }).join('');
  }

  // ── Abrir conversación ──────────────────────
  async function abrirConversacion(pacienteId) {
    pacienteActivo = pacienteId;
    const conv = conversaciones.find(c => c.paciente_id === pacienteId);
    if (conv) conv.no_leidos = 0;
    renderConversaciones();

    // Mostrar panel derecho
    document.getElementById("chat-panel-empty").style.display = 'none';
    document.getElementById("chat-panel-activo").style.display = 'flex';

    // Header
    if (conv) {
      document.getElementById("chat-panel-nombre").textContent = conv.nombre;
      document.getElementById("chat-panel-avatar").textContent = conv.iniciales;
    }

    // Cargar mensajes si no están en cache
    if (!mensajesCache[pacienteId]) {
      await cargarMensajes(pacienteId);
    } else {
      renderMensajesPanel(mensajesCache[pacienteId]);
    }

    document.getElementById("chat-msg-input")?.focus();
  }

  async function cargarMensajes(pacienteId) {
    const token = getToken();
    try {
      const res = await fetch(`${API_BASE}/chat/${pacienteId}/mensajes?limit=50`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      mensajesCache[pacienteId] = data;
      renderMensajesPanel(data);
    } catch(e) {}
  }

  function renderMensajesPanel(msgs) {
    const el = document.getElementById("chat-panel-mensajes");
    if (!el) return;
    if (!msgs.length) {
      el.innerHTML = `<div style="text-align:center;padding:32px;color:#8a8aaa;font-size:13px">
        Sin mensajes todavía. ¡Di hola!
      </div>`;
      return;
    }
    el.innerHTML = '';
    let lastDate = null;
    msgs.forEach(m => {
      const fecha = new Date(m.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
      if (fecha !== lastDate) {
        const sep = document.createElement('div');
        sep.style.cssText = 'text-align:center;font-size:11px;color:#8a8aaa;padding:6px 0;';
        sep.textContent = fecha;
        el.appendChild(sep);
        lastDate = fecha;
      }
      el.appendChild(createBubble(m));
    });
    el.scrollTop = el.scrollHeight;
  }

  function appendMsgToPanel(msg) {
    const el = document.getElementById("chat-panel-mensajes");
    if (!el) return;
    const empty = el.querySelector('[style*="text-align:center"]');
    if (empty && el.children.length === 1) empty.remove();
    el.appendChild(createBubble(msg));
    el.scrollTop = el.scrollHeight;
  }

  function createBubble(msg) {
    const esMio = msg.emisor === 'medico';
    const div = document.createElement('div');
    div.style.cssText = `
      max-width:75%; padding:9px 13px; border-radius:12px;
      font-size:13px; line-height:1.45; word-break:break-word;
      margin-bottom:4px;
      align-self:${esMio ? 'flex-end' : 'flex-start'};
      background:${esMio ? 'var(--p2,#4a4888)' : '#f0eff9'};
      color:${esMio ? 'white' : '#1a1a2e'};
      border-bottom-${esMio ? 'right' : 'left'}-radius:4px;
    `;
    const hora = new Date(msg.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `${escapeHtml(msg.contenido)}<span style="font-size:10px;opacity:.6;margin-top:3px;display:block;text-align:${esMio?'right':'left'}">${hora}</span>`;
    return div;
  }

  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Enviar mensaje (médico) ─────────────────
  function enviar() {
    const input = document.getElementById("chat-msg-input");
    const contenido = input?.value.trim();
    if (!contenido || !pacienteActivo || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ contenido, paciente_id: pacienteActivo }));
    input.value = '';
    input.focus();
  }

  // ── Horario modal ───────────────────────────
  const DIAS = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
  const DIAS_LABEL = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

  async function abrirHorario() {
    document.getElementById("modal-horario").style.display = 'flex';
    const token = getToken();
    try {
      const res = await fetch(`${API_BASE}/medico/horario`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const horarios = res.ok ? await res.json() : [];
      const map = {};
      horarios.forEach(h => map[h.dia] = h);

      document.getElementById("horario-form-body").innerHTML = DIAS.map((dia, i) => {
        const h = map[dia] || { hora_inicio: '08:00', hora_fin: '18:00', activo: false };
        return `
          <div class="horario-row" id="hrow-${dia}">
            <label class="horario-check">
              <input type="checkbox" id="h-activo-${dia}" ${h.activo ? 'checked' : ''}
                onchange="ChatMedico.toggleDia('${dia}')">
              <span>${DIAS_LABEL[i]}</span>
            </label>
            <div class="horario-times" id="htimes-${dia}" style="${h.activo ? '' : 'opacity:.4;pointer-events:none'}">
              <input type="time" id="h-inicio-${dia}" value="${h.hora_inicio}">
              <span style="font-size:12px;color:#8a8aaa">a</span>
              <input type="time" id="h-fin-${dia}" value="${h.hora_fin}">
            </div>
          </div>`;
      }).join('');
    } catch(e) {}
  }

  function toggleDia(dia) {
    const activo = document.getElementById(`h-activo-${dia}`).checked;
    const times = document.getElementById(`htimes-${dia}`);
    times.style.opacity = activo ? '1' : '.4';
    times.style.pointerEvents = activo ? 'auto' : 'none';
  }

  async function guardarHorario() {
    const token = getToken();
    const horarios = DIAS.map(dia => ({
      dia,
      hora_inicio: document.getElementById(`h-inicio-${dia}`).value || '08:00',
      hora_fin:    document.getElementById(`h-fin-${dia}`).value || '18:00',
      activo:      document.getElementById(`h-activo-${dia}`).checked,
    }));

    const btn = document.getElementById("horario-save-btn");
    btn.disabled = true; btn.textContent = 'Guardando...';

    try {
      const res = await fetch(`${API_BASE}/medico/horario`, {
        method: 'POST',
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ horarios })
      });
      if (res.ok) {
        cerrarHorario();
      }
    } finally {
      btn.disabled = false; btn.textContent = 'Guardar horario';
    }
  }

  function cerrarHorario() {
    document.getElementById("modal-horario").style.display = 'none';
  }

  return { conectar, cargarConversaciones, abrirConversacion, enviar, abrirHorario, cerrarHorario, guardarHorario, toggleDia };
})();