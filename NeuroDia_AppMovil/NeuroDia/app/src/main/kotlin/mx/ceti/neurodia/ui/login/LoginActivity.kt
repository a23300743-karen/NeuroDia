package mx.ceti.neurodia.ui.login

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import mx.ceti.neurodia.databinding.ActivityLoginBinding
import mx.ceti.neurodia.ui.medico.DashboardMedicoActivity
import mx.ceti.neurodia.ui.paciente.PacienteHomeActivity
import mx.ceti.neurodia.util.BaseActivity
import mx.ceti.neurodia.util.errorMessage

class LoginActivity : BaseActivity() {

    private lateinit var b: ActivityLoginBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Si ya hay sesión activa, ir directo a la pantalla correcta
        if (session.isLoggedIn) navigate()

        b = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(b.root)

        b.btnLogin.setOnClickListener { doLogin() }
        b.btnRegistro.setOnClickListener { doRegister() }
    }

    private fun doLogin() {
        val email    = b.etEmail.text.toString().trim()
        val password = b.etPassword.text.toString()
        val rol      = if (b.rbMedico.isChecked) "medico" else "paciente"

        if (email.isEmpty() || password.isEmpty()) {
            toast("Completa todos los campos"); return
        }

        setLoading(true)
        lifecycleScope.launch {
            try {
                val resp = api.login(
                    mx.ceti.neurodia.data.model.LoginRequest(email, password, rol)
                )
                if (resp.isSuccessful) {
                    val body = resp.body()!!
                    session.saveFromToken(
                        token     = body.accessToken,
                        userId    = body.user.id,
                        perfilId  = body.user.perfilId,
                        rol       = body.user.rol,
                        nombre    = body.user.nombre,
                        apellidos = body.user.apellidos,
                        email     = body.user.email
                    )
                    navigate()
                } else {
                    toast(resp.errorBody().errorMessage())
                }
            } catch (e: Exception) {
                toast("Sin conexión: ${e.message}")
            } finally {
                setLoading(false)
            }
        }
    }

    private fun doRegister() {
        val email     = b.etEmail.text.toString().trim()
        val password  = b.etPassword.text.toString()
        val nombre    = b.etNombre.text.toString().trim()
        val apellidos = b.etApellidos.text.toString().trim()
        val rol       = if (b.rbMedico.isChecked) "medico" else "paciente"

        if (listOf(email, password, nombre, apellidos).any { it.isEmpty() }) {
            toast("Completa todos los campos"); return
        }
        if (password.length < 8) {
            toast("La contraseña debe tener al menos 8 caracteres"); return
        }

        setLoading(true)
        lifecycleScope.launch {
            try {
                val resp = api.register(
                    mx.ceti.neurodia.data.model.RegisterRequest(
                        email, password, rol, nombre, apellidos
                    )
                )
                if (resp.isSuccessful) {
                    val body = resp.body()!!
                    session.saveFromToken(
                        token     = body.accessToken,
                        userId    = body.user.id,
                        perfilId  = body.user.perfilId,
                        rol       = body.user.rol,
                        nombre    = body.user.nombre,
                        apellidos = body.user.apellidos,
                        email     = body.user.email
                    )
                    navigate()
                } else {
                    toast(resp.errorBody().errorMessage())
                }
            } catch (e: Exception) {
                toast("Sin conexión: ${e.message}")
            } finally {
                setLoading(false)
            }
        }
    }

    private fun navigate() {
        val dest = if (session.esMedico) DashboardMedicoActivity::class.java
                   else                  PacienteHomeActivity::class.java
        startActivity(Intent(this, dest))
        finish()
    }

    private fun setLoading(loading: Boolean) {
        b.progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        b.btnLogin.isEnabled    = !loading
        b.btnRegistro.isEnabled = !loading
    }
}
