async function cargarDatosClinicos() {
    const token = localStorage.getItem("nd_token") || sessionStorage.getItem("nd_token");
    
    try {
        const res = await fetch("http://127.0.0.1:8000/auth/me", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        
        // Aquí llenarías los inputs de "Datos personales" y "Datos clínicos"
        if (document.getElementById("p-nombre")) {
            document.getElementById("p-nombre").value = data.nombre;
            document.getElementById("p-apellidos").value = data.apellidos;
            // ... llenar los demás
        }
    } catch (err) {
        console.error("Error al obtener datos clínicos:", err);
    }
}

document.addEventListener("DOMContentLoaded", cargarDatosClinicos);