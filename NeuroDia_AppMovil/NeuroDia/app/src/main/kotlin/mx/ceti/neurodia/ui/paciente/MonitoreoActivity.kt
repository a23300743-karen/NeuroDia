package mx.ceti.neurodia.ui.paciente

import android.os.Bundle
import android.view.View
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import mx.ceti.neurodia.data.model.RegistroIn
import mx.ceti.neurodia.databinding.ActivityMonitoreoBinding
import mx.ceti.neurodia.util.BaseActivity
import mx.ceti.neurodia.util.errorMessage

class MonitoreoActivity : BaseActivity() {

    private lateinit var b: ActivityMonitoreoBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityMonitoreoBinding.inflate(layoutInflater)
        setContentView(b.root)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        b.btnGuardar.setOnClickListener { guardarRegistro() }
    }

    private fun guardarRegistro() {
        val glucosaStr = b.etGlucosa.text.toString().trim()
        val dolorStr   = b.etDolor.text.toString().trim()
        val notas      = b.etNotas.text.toString().trim().ifEmpty { null }

        if (glucosaStr.isEmpty() || dolorStr.isEmpty()) {
            toast("Glucosa e intensidad de dolor son requeridos"); return
        }

        val glucosa = glucosaStr.toDoubleOrNull()
            ?: run { toast("Glucosa inválida"); return }
        val dolor   = dolorStr.toIntOrNull()
            ?: run { toast("Dolor debe ser un número del 0 al 10"); return }

        if (dolor !in 0..10) {
            toast("El dolor debe estar entre 0 y 10"); return
        }

        // Momento de glucosa
        val momento = when (b.rgMomento.checkedRadioButtonId) {
            b.rbAyunas.id       -> "ayunas"
            b.rbPostprandial.id -> "postprandial"
            b.rbNocturno.id     -> "nocturno"
            else -> { toast("Selecciona el momento de glucosa"); return }
        }

        // Localizaciones de dolor (checkboxes)
        val localizaciones = mutableListOf<String>()
        if (b.cbPies.isChecked)      localizaciones.add("pies")
        if (b.cbManos.isChecked)     localizaciones.add("manos")
        if (b.cbPiernas.isChecked)   localizaciones.add("piernas")
        if (b.cbBrazos.isChecked)    localizaciones.add("brazos")
        if (b.cbEspalda.isChecked)   localizaciones.add("espalda")
        if (b.cbCabeza.isChecked)    localizaciones.add("cabeza")

        // Síntomas (checkboxes)
        val sintomas = mutableListOf<String>()
        if (b.cbEntumecimiento.isChecked) sintomas.add("entumecimiento")
        if (b.cbHormigueo.isChecked)      sintomas.add("hormigueo")
        if (b.cbQuemazon.isChecked)       sintomas.add("quemazón")
        if (b.cbDebilidad.isChecked)      sintomas.add("debilidad muscular")
        if (b.cbMareos.isChecked)         sintomas.add("mareos")

        val registro = RegistroIn(
            glucosaValor     = glucosa,
            glucosaMomento   = momento,
            dolorIntensidad  = dolor,
            notas            = notas,
            localizaciones   = localizaciones,
            sintomas         = sintomas
        )

        setLoading(true)
        lifecycleScope.launch {
            try {
                val resp = api.createRegistro(session.perfilId, registro)
                if (resp.isSuccessful) {
                    toastLong("✓ Registro guardado correctamente")
                    finish()
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

    private fun setLoading(loading: Boolean) {
        b.progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        b.btnGuardar.isEnabled   = !loading
    }

    override fun onSupportNavigateUp(): Boolean { finish(); return true }
}
