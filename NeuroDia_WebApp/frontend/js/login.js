/**
 * NeuroDia — login.js
 * Maneja: navegación de tabs, validación de formularios,
 * llamadas al API FastAPI, y feedback de UI.
 */

const API_BASE = window.location.origin;

/* ══════════════════════════════════════════════
   TABS
══════════════════════════════════════════════ */
function switchTab(tab) {
  // Tabs
  document.querySelectorAll(".tab").forEach(t => {
    t.classList.toggle("active", t.id === `tab-${tab}`);
    t.setAttribute("aria-selected", t.id === `tab-${tab}`);
  });
  // Panels
  document.querySelectorAll(".form-card").forEach(p => {
    p.classList.toggle("active", p.id === `form-${tab}`);
  });
  clearAlerts();
}

/* ══════════════════════════════════════════════
   SELECTOR DE ROL (login)
══════════════════════════════════════════════ */
function selectRole(btn) {
  document.querySelectorAll(".role-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("login-role").value = btn.dataset.role;
}

/* ══════════════════════════════════════════════
   TOGGLE CONTRASEÑA
══════════════════════════════════════════════ */
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  const isHidden = input.type === "password";
  input.type = isHidden ? "text" : "password";
  btn.innerHTML = isHidden
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
         <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
         <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
         <line x1="1" y1="1" x2="23" y2="23"/>
       </svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
         <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
         <circle cx="12" cy="12" r="3"/>
       </svg>`;
}

/* ══════════════════════════════════════════════
   VALIDACIONES
══════════════════════════════════════════════ */
function showError(fieldId, msg) {
  const el = document.getElementById(fieldId);
  if (el) el.textContent = msg;
  // Marcar input con error
  const inputId = fieldId.replace("err-", "");
  const input = document.getElementById(inputId);
  if (input) input.classList.add("error");
}

function clearErrors() {
  document.querySelectorAll(".field-error").forEach(e => e.textContent = "");
  document.querySelectorAll("input, select").forEach(i => {
    i.classList.remove("error", "success");
  });
}

function clearAlerts() {
  ["login-error","login-success","reg-error","reg-success"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
}

function showAlert(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.display = "flex";
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateLoginForm() {
  let valid = true;
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  if (!email) {
    showError("err-login-email", "El correo es obligatorio.");
    valid = false;
  } else if (!validateEmail(email)) {
    showError("err-login-email", "Ingresa un correo válido.");
    valid = false;
  }

  if (!password) {
    showError("err-login-password", "La contraseña es obligatoria.");
    valid = false;
  }

  return valid;
}

function validateRegistroForm() {
  let valid = true;

  const nombre = document.getElementById("reg-nombre").value.trim();
  const apellidos = document.getElementById("reg-apellidos").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const password2 = document.getElementById("reg-password2").value;
  const rol = document.getElementById("reg-rol").value;
  const terms = document.getElementById("reg-terms").checked;
  const cedulaEl = document.getElementById("reg-cedula");
  const cedula = cedulaEl ? cedulaEl.value.trim() : "";

  if (!nombre) { showError("err-reg-nombre", "El nombre es obligatorio."); valid = false; }
  if (!apellidos) { showError("err-reg-apellidos", "Los apellidos son obligatorios."); valid = false; }

  if (!email) {
    showError("err-reg-email", "El correo es obligatorio."); valid = false;
  } else if (!validateEmail(email)) {
    showError("err-reg-email", "Ingresa un correo válido."); valid = false;
  }

  if (!password) {
    showError("err-reg-password", "La contraseña es obligatoria."); valid = false;
  } else if (password.length < 8) {
    showError("err-reg-password", "Mínimo 8 caracteres."); valid = false;
  }

  if (!password2) {
    showError("err-reg-password2", "Confirma tu contraseña."); valid = false;
  } else if (password !== password2) {
    showError("err-reg-password2", "Las contraseñas no coinciden."); valid = false;
  }

  if (!rol) { showError("err-reg-rol", "Selecciona un rol."); valid = false; }

  if (!terms) { showError("err-reg-terms", "Debes aceptar los términos."); valid = false; }

  return valid;
}

/* ══════════════════════════════════════════════
   ESTADO DE BOTÓN (loading)
══════════════════════════════════════════════ */
function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.querySelector(".btn-text").style.display = loading ? "none" : "inline";
  btn.querySelector(".btn-loader").style.display = loading ? "flex" : "none";
}

/* ══════════════════════════════════════════════
   LOGIN — submit
══════════════════════════════════════════════ */
document.getElementById("loginForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  clearErrors();
  clearAlerts();

  if (!validateLoginForm()) return;

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const role = document.getElementById("login-role").value;
  const remember = document.getElementById("remember").checked;

  setLoading("login-btn", true);

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role })
    });

    const data = await res.json();

    if (res.ok) {
      // Guardar token
      const storage = remember ? localStorage : sessionStorage;
      storage.setItem("nd_token", data.access_token);
      storage.setItem("nd_user", JSON.stringify(data.user));

      showAlert("login-success", `Bienvenido, ${data.user.nombre}. Redirigiendo...`);

      // Redirigir según rol
      setTimeout(() => {
        // Obtenemos el rol del objeto user que devuelve tu API (main.py)
        const rol = data.user.rol; 

        if (rol === 'paciente') {
            window.location.href = "perfil.html"; 
        } else if (rol === 'medico') {
            alert("El panel de médico está en desarrollo.");
            window.location.href = "dashboard_medico.html";
        } else {
            window.location.href = "index.html";
        }
    }, 1200);

    } else {
      showAlert("login-error", data.detail || "Credenciales incorrectas. Intenta de nuevo.");
    }

  } catch (err) {
    showAlert("login-error", "No se pudo conectar con el servidor. Verifica tu conexión.");
    console.error("Login error:", err);
  } finally {
    setLoading("login-btn", false);
  }
});

/* ══════════════════════════════════════════════
   REGISTRO — submit
══════════════════════════════════════════════ */
document.getElementById("registroForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  clearErrors();
  clearAlerts();

  if (!validateRegistroForm()) return;

  const nombre = document.getElementById("reg-nombre").value.trim();
  const apellidos = document.getElementById("reg-apellidos").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const rol = document.getElementById("reg-rol").value;
  const cedula = document.getElementById("reg-cedula").value.trim();

  setLoading("reg-btn", true);

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, apellidos, email, password, rol, cedula })
    });

    const data = await res.json();

    if (res.ok) {
      showAlert("reg-success", "Cuenta creada exitosamente. Redirigiendo al inicio de sesión...");
      document.getElementById("registroForm").reset();

      setTimeout(() => switchTab("login"), 2000);

    } else {
      // Manejar errores de validación de FastAPI (422)
      if (res.status === 422 && data.detail) {
        data.detail.forEach(err => {
          const field = err.loc[err.loc.length - 1];
          showError(`err-reg-${field}`, err.msg);
        });
      } else {
        showAlert("reg-error", data.detail || "Error al crear la cuenta. Intenta de nuevo.");
      }
    }

  } catch (err) {
    showAlert("reg-error", "No se pudo conectar con el servidor. Verifica tu conexión.");
    console.error("Register error:", err);
  } finally {
    setLoading("reg-btn", false);
  }
});

/* ══════════════════════════════════════════════
   INIT — verificar si ya hay sesión activa
══════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("nd_token") || sessionStorage.getItem("nd_token");
    const userJson = localStorage.getItem("nd_user") || sessionStorage.getItem("nd_user");

    // SOLO redirigir si el usuario ya está logueado y está viendo la raíz o el index
    const isLoginPage = window.location.pathname.endsWith("index.html") || window.location.pathname === "/";
    
    if (token && userJson && isLoginPage) {
        const user = JSON.parse(userJson);
        if (user.rol === 'paciente') {
            window.location.href = "perfil.html";
        } else if (user.rol === 'medico') {
            // window.location.href = "perfil_medico.html";
        }
    }
});
