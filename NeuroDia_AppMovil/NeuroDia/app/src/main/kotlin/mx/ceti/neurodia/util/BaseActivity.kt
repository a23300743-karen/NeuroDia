package mx.ceti.neurodia.util

import android.content.Context
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import mx.ceti.neurodia.NeuroDiaApp
import mx.ceti.neurodia.data.network.ApiService
import mx.ceti.neurodia.data.session.SessionManager

abstract class BaseActivity : AppCompatActivity() {

    protected val app get() = application as NeuroDiaApp
    protected val session: SessionManager get() = app.session
    protected val api: ApiService get() = app.api

    fun toast(msg: String) =
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()

    fun toastLong(msg: String) =
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
}

// Extension para parsear errores de Retrofit
fun okhttp3.ResponseBody?.errorMessage(): String {
    return try {
        this?.string()?.let {
            // Intentar extraer "detail" del JSON de error FastAPI
            val regex = """"detail"\s*:\s*"([^"]+)"""".toRegex()
            regex.find(it)?.groupValues?.get(1) ?: it
        } ?: "Error desconocido"
    } catch (e: Exception) {
        "Error de red"
    }
}
