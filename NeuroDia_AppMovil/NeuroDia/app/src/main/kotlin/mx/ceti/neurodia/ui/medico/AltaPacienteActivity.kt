package mx.ceti.neurodia.ui.medico

import android.os.Bundle
import android.view.View
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import mx.ceti.neurodia.data.model.AltaPacienteIn
import mx.ceti.neurodia.data.model.VincularPacienteIn
import mx.ceti.neurodia.databinding.ActivityAltaPacienteBinding
import mx.ceti.neurodia.util.BaseActivity
import mx.ceti.neurodia.util.errorMessage

class AltaPacienteActivity : BaseActivity() {

    private lateinit var b: ActivityAltaPacienteBinding
    private val modoVincular get() = intent.getStringExtra("modo") == "vincular"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityAltaPacienteBinding.inflate(layoutInflater)
        setContentView(b.root)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        if (modoVincular) {
            title = "Vincular paciente existente"
            b.layoutPassword.visibility = View.GONE
            b.layoutNombreApellidos.visibility = View.GONE
            b.btnBuscar.visibility = View.VISIBLE
            b.btnBuscar.setOnClickListener { buscarPaciente() }
        } else {
            title = "Dar de alta paciente"
            b.btnBuscar.visibility = View.GONE
        }

        b.btnGuardar.setOnClickListener {
            if (modoVincular) vincular() else altaNuevo()
        }
    }

    private fun buscarPaciente() {
        val email = b.etEmail.text.toString().trim()
        if (email.isEmpty()) { toast("Ingresa el email"); return }
        setLoading(true)
        lifecycleScope.launch {
            try {
                val resp = api.buscarPaciente(email)
                if (resp.isSuccessful) {
                    val p = resp.body()!!
                    b.etNombre.setText(p.nombre)
                    b.etApellidos.setText(p.apellidos)
                    p.hba1c?.let { b.etHba1c.setText(it.toString()) }
                    p.aniosDiagnostico?.let { b.etAnios.setText(it.toString()) }
                    p.grupoEstudio?.let { b.etGrupo.setText(it) }
                    b.cbConsentimiento.isChecked = p.consentimiento
                    toast(if (p.yaAsignado) "Ya es tu paciente" else "Paciente encontrado")
                } else {
                    toast(resp.errorBody().errorMessage())
                }
            } catch (e: Exception) { toast("Sin conexión") }
            finally { setLoading(false) }
        }
    }

    private fun altaNuevo() {
        val email     = b.etEmail.text.toString().trim()
        val password  = b.etPassword.text.toString()
        val nombre    = b.etNombre.text.toString().trim()
        val apellidos = b.etApellidos.text.toString().trim()

        if (listOf(email, password, nombre, apellidos).any { it.isEmpty() }) {
            toast("Completa los campos requeridos"); return
        }
        if (password.length < 8) { toast("Contraseña mínimo 8 caracteres"); return }

        val tipos = listOf("tipo_1","tipo_2","gestacional","otro")
        setLoading(true)
        lifecycleScope.launch {
            try {
                val resp = api.altaPaciente(AltaPacienteIn(
                    email             = email,
                    password          = password,
                    nombre            = nombre,
                    apellidos         = apellidos,
                    tipoDiabetes      = tipos[b.spinnerTipo.selectedItemPosition],
                    aniosDiagnostico  = b.etAnios.text.toString().toIntOrNull(),
                    hba1c             = b.etHba1c.text.toString().toDoubleOrNull(),
                    grupoEstudio      = b.etGrupo.text.toString().trim().ifEmpty { null },
                    consentimiento    = b.cbConsentimiento.isChecked
                ))
                if (resp.isSuccessful) { toast("Paciente dado de alta"); finish() }
                else toast(resp.errorBody().errorMessage())
            } catch (e: Exception) { toast("Sin conexión") }
            finally { setLoading(false) }
        }
    }

    private fun vincular() {
        val email = b.etEmail.text.toString().trim()
        if (email.isEmpty()) { toast("Ingresa el email"); return }
        val tipos = listOf("tipo_1","tipo_2","gestacional","otro")
        setLoading(true)
        lifecycleScope.launch {
            try {
                val resp = api.vincularPaciente(VincularPacienteIn(
                    email             = email,
                    tipoDiabetes      = tipos[b.spinnerTipo.selectedItemPosition],
                    aniosDiagnostico  = b.etAnios.text.toString().toIntOrNull(),
                    hba1c             = b.etHba1c.text.toString().toDoubleOrNull(),
                    grupoEstudio      = b.etGrupo.text.toString().trim().ifEmpty { null },
                    consentimiento    = b.cbConsentimiento.isChecked
                ))
                if (resp.isSuccessful) { toast("Paciente vinculado"); finish() }
                else toast(resp.errorBody().errorMessage())
            } catch (e: Exception) { toast("Sin conexión") }
            finally { setLoading(false) }
        }
    }

    private fun setLoading(l: Boolean) {
        b.progressBar.visibility = if (l) View.VISIBLE else View.GONE
        b.btnGuardar.isEnabled   = !l
        b.btnBuscar.isEnabled    = !l
    }

    override fun onSupportNavigateUp(): Boolean { finish(); return true }
}
