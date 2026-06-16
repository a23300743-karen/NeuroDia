package mx.ceti.neurodia.ui.paciente

import android.os.Bundle
import android.view.View
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import mx.ceti.neurodia.data.model.PerfilUpdate
import mx.ceti.neurodia.databinding.ActivityPerfilBinding
import mx.ceti.neurodia.util.BaseActivity
import mx.ceti.neurodia.util.errorMessage

class PerfilActivity : BaseActivity() {

    private lateinit var b: ActivityPerfilBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityPerfilBinding.inflate(layoutInflater)
        setContentView(b.root)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        cargarPerfil()
        b.btnGuardar.setOnClickListener { guardarPerfil() }
    }

    private fun cargarPerfil() {
        setLoading(true)
        lifecycleScope.launch {
            try {
                val resp = api.getPerfil(session.perfilId)
                if (resp.isSuccessful) {
                    val p = resp.body()!!
                    b.etNombre.setText(p.nombre)
                    b.etApellidos.setText(p.apellidos)
                    b.etFechaNac.setText(p.fechaNacimiento ?: "")
                    b.etCurp.setText(p.curp ?: "")
                    b.etTelefono.setText(p.telefono ?: "")
                    b.etHba1c.setText(p.hba1c?.toString() ?: "")
                    b.etAniosDiag.setText(p.aniosDiagnostico?.toString() ?: "")
                    b.etGrupo.setText(p.grupoEstudio ?: "")

                    // Tipo de diabetes spinner
                    val tipos = listOf("tipo_1","tipo_2","gestacional","otro")
                    val idx = tipos.indexOf(p.tipoDiabetes)
                    if (idx >= 0) b.spinnerTipo.setSelection(idx)

                    // Sexo
                    val sexos = listOf("masculino","femenino","otro")
                    val sidx = sexos.indexOf(p.sexo)
                    if (sidx >= 0) b.spinnerSexo.setSelection(sidx)

                    b.cbConsentimiento.isChecked = p.consentimiento
                    b.tvVerificado.text = if (p.verificado) "✓ Verificado" else "Pendiente de verificación"
                }
            } catch (e: Exception) {
                toast("Sin conexión")
            } finally {
                setLoading(false)
            }
        }
    }

    private fun guardarPerfil() {
        val tipos = listOf("tipo_1","tipo_2","gestacional","otro")
        val sexos = listOf("masculino","femenino","otro")

        val update = PerfilUpdate(
            nombre            = b.etNombre.text.toString().trim().ifEmpty { null },
            apellidos         = b.etApellidos.text.toString().trim().ifEmpty { null },
            fechaNacimiento   = b.etFechaNac.text.toString().trim().ifEmpty { null },
            curp              = b.etCurp.text.toString().trim().uppercase().ifEmpty { null },
            telefono          = b.etTelefono.text.toString().trim().ifEmpty { null },
            tipoDiabetes      = tipos[b.spinnerTipo.selectedItemPosition],
            sexo              = sexos[b.spinnerSexo.selectedItemPosition],
            hba1c             = b.etHba1c.text.toString().toDoubleOrNull(),
            aniosDiagnostico  = b.etAniosDiag.text.toString().toIntOrNull(),
            grupoEstudio      = b.etGrupo.text.toString().trim().ifEmpty { null }
        )

        setLoading(true)
        lifecycleScope.launch {
            try {
                val resp = api.updatePerfil(session.perfilId, update)
                if (resp.isSuccessful) {
                    toast("Perfil actualizado")
                    // Actualizar nombre en sesión
                    resp.body()?.let {
                        session.nombre    = it.nombre
                        session.apellidos = it.apellidos
                    }
                } else {
                    toast(resp.errorBody().errorMessage())
                }
            } catch (e: Exception) {
                toast("Sin conexión")
            } finally {
                setLoading(false)
            }
        }
    }

    private fun setLoading(loading: Boolean) {
        b.progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        b.btnGuardar.isEnabled   = !loading
    }

    override fun onSupportNavigateUp(): Boolean { finish(); return true }
}
