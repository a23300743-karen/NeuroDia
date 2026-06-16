// frontend/js/auth.js

document.addEventListener("DOMContentLoaded", () => {
    // 1. Verificar sesión
    const token = localStorage.getItem("nd_token") || sessionStorage.getItem("nd_token");
    const userJson = localStorage.getItem("nd_user") || sessionStorage.getItem("nd_user");
    const user = userJson ? JSON.parse(userJson) : null;

    if (!token || !user) {
        window.location.href = "index.html";
        return;
    }

    // 2. Llenar los datos (Usando los IDs REALES de tu perfil.html)
    const sidebarNombre = document.getElementById("sidebar-nombre");
    const sidebarAvatar = document.getElementById("sidebar-avatar");
    const heroNombre = document.getElementById("hero-nombre");
    const heroEmail = document.getElementById("hero-email");
    const heroAvatar = document.getElementById("hero-avatar");

    // Llenar textos
    if (sidebarNombre) sidebarNombre.textContent = `${user.nombre} ${user.apellidos}`;
    if (heroNombre) heroNombre.textContent = `${user.nombre} ${user.apellidos}`;
    if (heroEmail) heroEmail.textContent = user.email;

    // Generar iniciales para los avatares
    const iniciales = (user.nombre[0] + user.apellidos[0]).toUpperCase();
    if (sidebarAvatar) sidebarAvatar.textContent = iniciales;
    if (heroAvatar) heroAvatar.textContent = iniciales;

    // 3. ¡DESBLOQUEAR LA PANTALLA!
    // Esto quita el mensaje de "Cargando perfil..." y muestra la página
    const loadingState = document.getElementById("loading-state");
    const perfilContent = document.getElementById("perfil-content");

    if (loadingState) loadingState.style.display = "none";
    if (perfilContent) perfilContent.style.display = "block";
});

// Función global para cerrar sesión
function logout() {
    localStorage.removeItem("nd_token");
    localStorage.removeItem("nd_user");
    sessionStorage.removeItem("nd_token");
    sessionStorage.removeItem("nd_user");
    window.location.href = "index.html";
}