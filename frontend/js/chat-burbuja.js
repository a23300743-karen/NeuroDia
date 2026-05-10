/* ════════════════════════════════════════════
   NeuroDia — chat-burbuja.js
   Burbuja de chat flotante para páginas del paciente
   Incluir al final de perfil.html, monitoreo.html, historial.html
════════════════════════════════════════════ */

(function() {
  const API_BASE = "http://localhost:8000";
  let ws = null;
  let mensajes = [];
  let abierto = false;
  let noLeidos = 0;
  let currentUser = null;
  let horarioInfo = null;

  function getToken() {
    return localStorage.getItem("nd_token") || sessionStorage.getItem("nd_token");
  }

  // ── Inyectar HTML del chat ──────────────────
  function injectHTML() {
    const el = document.createElement('div');
    el.innerHTML = `
      <!-- Burbuja -->
      <button id="chat-bubble" onclick="toggleChat()" aria-label="Abrir chat con mi médico">
        <svg id="chat-icon-open" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <svg id="chat-icon-close" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
        <span id="chat-badge" style="display:none"></span>
      </button>

      <!-- Ventana de chat -->
      <div id="chat-window" style="display:none">
        <div id="chat-header">
          <div style="display:flex;align-items:center;gap:10px">
            <div id="chat-header-avatar">Dr</div>
            <div>
              <div id="chat-header-nombre" style="font-size:13.5px;font-weight:600;color:var(--p1)">Mi médico</div>
              <div id="chat-header-status" style="font-size:11px;color:var(--text-muted)">Cargando...</div>
            </div>
          </div>
          <button onclick="toggleChat()" style="background:none;border:none;cursor:pointer;color:var(--text-muted);padding:4px">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Banner fuera de horario -->
        <div id="chat-horario-banner" style="display:none">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span id="chat-horario-texto">Tu médico no está disponible ahora. Tu mensaje llegará mañana.</span>
        </div>

        <div id="chat-mensajes"></div>

        <div id="chat-input-wrap">
          <input type="text" id="chat-input" placeholder="Escribe un mensaje..." maxlength="500"
            onkeydown="if(event.key==='Enter')sendMessage()">
          <button id="chat-send" onclick="sendMessage()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(el);
  }

  // ── Estilos ─────────────────────────────────
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #chat-bubble {
        position: fixed; bottom: 28px; right: 28px; z-index: 9999;
        width: 56px; height: 56px; border-radius: 50%;
        background: var(--p2, #4a4888); color: white;
        border: none; cursor: pointer; box-shadow: 0 4px 20px rgba(74,72,136,.4);
        display: flex; align-items: center; justify-content: center;
        transition: transform 150ms ease, box-shadow 150ms ease;
      }
      #chat-bubble:hover { transform: scale(1.08); box-shadow: 0 6px 24px rgba(74,72,136,.5); }
      #chat-badge {
        position: absolute; top: -4px; right: -4px;
        background: #a32d2d; color: white; font-size: 10px; font-weight: 700;
        width: 20px; height: 20px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        border: 2px solid white;
      }
      #chat-window {
        position: fixed; bottom: 96px; right: 28px; z-index: 9998;
        width: 340px; height: 480px;
        background: white; border-radius: 16px;
        box-shadow: 0 8px 40px rgba(45,44,94,.18);
        display: flex; flex-direction: column; overflow: hidden;
        border: 1px solid #e0dff0;
        animation: chatSlideUp .2s ease;
      }
      @keyframes chatSlideUp {
        from { opacity:0; transform: translateY(16px) scale(.97); }
        to   { opacity:1; transform: translateY(0) scale(1); }
      }
      #chat-header {
        padding: 14px 16px; background: var(--p8, #f8f7fd);
        border-bottom: 1px solid #e0dff0;
        display: flex; align-items: center; justify-content: space-between;
        flex-shrink: 0;
      }
      #chat-header-avatar {
        width: 36px; height: 36px; border-radius: 50%;
        background: var(--p3, #706fa1); color: white;
        display: flex; align-items: center; justify-content: center;
        font-size: 12px; font-weight: 600; flex-shrink: 0;
      }
      #chat-horario-banner {
        background: #fff8e6; border-bottom: 1px solid rgba(122,88,0,.15);
        padding: 8px 14px; font-size: 12px; color: #7a5800;
        display: flex; align-items: center; gap: 6px; flex-shrink: 0;
      }
      #chat-mensajes {
        flex: 1; overflow-y: auto; padding: 14px 12px;
        display: flex; flex-direction: column; gap: 8px;
        scroll-behavior: smooth;
      }
      .chat-msg {
        max-width: 80%; padding: 8px 12px; border-radius: 12px;
        font-size: 13px; line-height: 1.45; word-break: break-word;
      }
      .chat-msg.mio {
        background: var(--p2, #4a4888); color: white;
        align-self: flex-end; border-bottom-right-radius: 4px;
      }
      .chat-msg.suyo {
        background: #f0eff9; color: #1a1a2e;
        align-self: flex-start; border-bottom-left-radius: 4px;
      }
      .chat-msg-time {
        font-size: 10px; opacity: .6; margin-top: 3px; display: block;
      }
      .chat-msg.mio .chat-msg-time { text-align: right; }
      .chat-empty {
        text-align: center; color: #8a8aaa; font-size: 13px;
        padding: 40px 20px; flex: 1; display: flex;
        flex-direction: column; align-items: center; justify-content: center; gap: 8px;
      }
      #chat-input-wrap {
        padding: 10px 12px; border-top: 1px solid #e0dff0;
        display: flex; gap: 8px; align-items: center; flex-shrink: 0;
      }
      #chat-input {
        flex: 1; height: 38px; padding: 0 12px;
        border: 1px solid #e0dff0; border-radius: 20px;
        font-family: inherit; font-size: 13px; color: #1a1a2e;
        background: #f8f7fd; outline: none;
        transition: border-color 150ms;
      }
      #chat-input:focus { border-color: #706fa1; background: white; }
      #chat-send {
        width: 38px; height: 38px; border-radius: 50%;
        background: var(--p2, #4a4888); color: white;
        border: none; cursor: pointer; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        transition: background 150ms;
      }
      #chat-send:hover { background: var(--p1, #2d2c5e); }
      .chat-separator {
        text-align: center; font-size: 11px; color: #8a8aaa;
        padding: 4px 0; position: relative;
      }
      @media (max-width: 400px) {
        #chat-window { width: calc(100vw - 24px); right: 12px; bottom: 84px; }
        #chat-bubble { right: 16px; bottom: 20px; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Conectar WebSocket ──────────────────────
  function connectWS() {
    const token = getToken();
    if (!token || !currentUser) return;

    const wsUrl = `ws://localhost:8000/ws/chat/${currentUser.id}?token=${token}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => console.log("[Chat] WS conectado");

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.confirmado || msg.emisor === 'medico') {
        appendMessage(msg);
        if (!abierto && msg.emisor === 'medico') {
          noLeidos++;
          updateBadge();
        }
      }
    };

    ws.onclose = () => {
      // Reconectar en 3 segundos
      setTimeout(() => { if (getToken()) connectWS(); }, 3000);
    };

    ws.onerror = () => ws.close();
  }

  // ── Cargar historial ────────────────────────
  async function loadMensajes() {
    const token = getToken();
    if (!token || !currentUser?.perfil_id) return;

    try {
      const res = await fetch(`${API_BASE}/chat/${currentUser.perfil_id}/mensajes?limit=50`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      mensajes = data;
      renderMensajes();
    } catch(e) {}
  }

  async function loadHorario() {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/chat/paciente/horario`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return;
      horarioInfo = await res.json();
      updateHorarioBanner();
      if (horarioInfo.medico_nombre) {
        document.getElementById("chat-header-nombre").textContent = horarioInfo.medico_nombre;
        document.getElementById("chat-header-avatar").textContent =
          horarioInfo.medico_nombre.split(" ").map(w => w[0]).slice(1, 3).join("").toUpperCase() || "Dr";
      }
    } catch(e) {}
  }

  function updateHorarioBanner() {
    if (!horarioInfo) return;
    const banner = document.getElementById("chat-horario-banner");
    const status = document.getElementById("chat-header-status");
    if (horarioInfo.disponible) {
      banner.style.display = 'none';
      status.textContent = '🟢 Disponible ahora';
      status.style.color = '#2d6e45';
    } else {
      banner.style.display = 'flex';
      const dias = horarioInfo.horario?.map(h => `${h.dia} ${h.hora_inicio}–${h.hora_fin}`).join(', ') || '';
      document.getElementById("chat-horario-texto").textContent =
        `Fuera de horario. Tu mensaje se entregará. ${dias ? 'Horario: ' + dias : ''}`;
      status.textContent = '🔴 Fuera de horario';
      status.style.color = '#a32d2d';
    }
  }

  // ── Render ──────────────────────────────────
  function renderMensajes() {
    const el = document.getElementById("chat-mensajes");
    if (!mensajes.length) {
      el.innerHTML = `<div class="chat-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".3"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span>Aún no hay mensajes.<br>Escribe a tu médico.</span>
      </div>`;
      return;
    }
    el.innerHTML = '';
    let lastDate = null;
    mensajes.forEach(m => {
      const fecha = new Date(m.created_at);
      const fechaStr = fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
      if (fechaStr !== lastDate) {
        const sep = document.createElement('div');
        sep.className = 'chat-separator';
        sep.textContent = fechaStr;
        el.appendChild(sep);
        lastDate = fechaStr;
      }
      el.appendChild(createBubble(m));
    });
    el.scrollTop = el.scrollHeight;
  }

  function appendMessage(msg) {
    const el = document.getElementById("chat-mensajes");
    const empty = el.querySelector('.chat-empty');
    if (empty) empty.remove();
    mensajes.push(msg);
    el.appendChild(createBubble(msg));
    el.scrollTop = el.scrollHeight;
  }

  function createBubble(msg) {
    const esMio = msg.emisor === 'paciente';
    const div = document.createElement('div');
    div.className = `chat-msg ${esMio ? 'mio' : 'suyo'}`;
    const hora = new Date(msg.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `${escapeHtml(msg.contenido)}<span class="chat-msg-time">${hora}${msg.fuera_horario ? ' · fuera de horario' : ''}</span>`;
    return div;
  }

  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function updateBadge() {
    const badge = document.getElementById("chat-badge");
    if (noLeidos > 0) {
      badge.textContent = noLeidos > 9 ? '9+' : noLeidos;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  // ── Enviar mensaje ──────────────────────────
  window.sendMessage = function() {
    const input = document.getElementById("chat-input");
    const contenido = input.value.trim();
    if (!contenido || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ contenido }));
    input.value = '';
    input.focus();
  };

  // ── Toggle chat ─────────────────────────────
  window.toggleChat = function() {
    abierto = !abierto;
    document.getElementById("chat-window").style.display = abierto ? 'flex' : 'none';
    document.getElementById("chat-icon-open").style.display = abierto ? 'none' : 'block';
    document.getElementById("chat-icon-close").style.display = abierto ? 'block' : 'none';
    if (abierto) {
      noLeidos = 0;
      updateBadge();
      loadHorario();
      setTimeout(() => {
        const el = document.getElementById("chat-mensajes");
        if (el) el.scrollTop = el.scrollHeight;
        document.getElementById("chat-input")?.focus();
      }, 50);
    }
  };

  // ── Init ────────────────────────────────────
  function init() {
    const stored = localStorage.getItem("nd_user") || sessionStorage.getItem("nd_user");
    if (!stored || !getToken()) return;
    currentUser = JSON.parse(stored);
    if (currentUser.rol !== 'paciente') return; // Solo para pacientes

    injectStyles();
    injectHTML();
    loadMensajes();
    loadHorario();
    connectWS();

    // Actualizar horario cada minuto
    setInterval(loadHorario, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();