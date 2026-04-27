// frontend/js/auth.js

document.addEventListener("DOMContentLoaded", () => {
    // 1. Verificar si hay un token y datos de usuario
    const token = localStorage.getItem("nd_token") || sessionStorage.getItem("nd_token");
    const userJson = localStorage.getItem("nd_user") || sessionStorage.getItem("nd_user");
    const user = userJson ? JSON.parse(userJson) : null;

    if (!token || !user) {
        window.location.href = "index.html";
        return;
    }

    // 2. Llenar los datos del Sidebar
    // Asegúrate de que en tus HTML el sidebar tenga estos IDs
    const nameElement = document.getElementById("user-name-display"); // Ajusta el ID según tu HTML
    const roleElement = document.getElementById("user-role-display");
    const avatarElement = document.getElementById("user-avatar");

    if (nameElement) nameElement.textContent = `${user.nombre} ${user.apellidos}`;
    if (roleElement) roleElement.textContent = user.rol === 'paciente' ? 'Paciente' : 'Médico';
    
    // Generar iniciales para el avatar
    if (avatarElement) {
        avatarElement.textContent = (user.nombre[0] + user.apellidos[0]).toUpperCase();
    }
});

// Función global para cerrar sesión
function logout() {
    localStorage.removeItem("nd_token");
    localStorage.removeItem("nd_user");
    window.location.href = "index.html";
}