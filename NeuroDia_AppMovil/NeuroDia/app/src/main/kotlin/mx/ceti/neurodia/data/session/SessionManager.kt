package mx.ceti.neurodia.data.session

import android.content.Context
import android.content.SharedPreferences

class SessionManager(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("neurodia_prefs", Context.MODE_PRIVATE)

    var token: String?
        get() = prefs.getString(KEY_TOKEN, null)
        set(v) = prefs.edit().putString(KEY_TOKEN, v).apply()

    var userId: Int
        get() = prefs.getInt(KEY_USER_ID, -1)
        set(v) = prefs.edit().putInt(KEY_USER_ID, v).apply()

    var perfilId: Int
        get() = prefs.getInt(KEY_PERFIL_ID, -1)
        set(v) = prefs.edit().putInt(KEY_PERFIL_ID, v).apply()

    var rol: String?
        get() = prefs.getString(KEY_ROL, null)
        set(v) = prefs.edit().putString(KEY_ROL, v).apply()

    var nombre: String?
        get() = prefs.getString(KEY_NOMBRE, null)
        set(v) = prefs.edit().putString(KEY_NOMBRE, v).apply()

    var apellidos: String?
        get() = prefs.getString(KEY_APELLIDOS, null)
        set(v) = prefs.edit().putString(KEY_APELLIDOS, v).apply()

    var email: String?
        get() = prefs.getString(KEY_EMAIL, null)
        set(v) = prefs.edit().putString(KEY_EMAIL, v).apply()

    val isLoggedIn get() = token != null && userId > 0

    val esMedico get() = rol == "medico"
    val esPaciente get() = rol == "paciente"

    fun saveFromToken(
        token: String, userId: Int, perfilId: Int,
        rol: String, nombre: String, apellidos: String, email: String
    ) {
        prefs.edit()
            .putString(KEY_TOKEN, token)
            .putInt(KEY_USER_ID, userId)
            .putInt(KEY_PERFIL_ID, perfilId)
            .putString(KEY_ROL, rol)
            .putString(KEY_NOMBRE, nombre)
            .putString(KEY_APELLIDOS, apellidos)
            .putString(KEY_EMAIL, email)
            .apply()
    }

    fun logout() {
        prefs.edit().clear().apply()
    }

    companion object {
        private const val KEY_TOKEN     = "token"
        private const val KEY_USER_ID   = "user_id"
        private const val KEY_PERFIL_ID = "perfil_id"
        private const val KEY_ROL       = "rol"
        private const val KEY_NOMBRE    = "nombre"
        private const val KEY_APELLIDOS = "apellidos"
        private const val KEY_EMAIL     = "email"
    }
}
