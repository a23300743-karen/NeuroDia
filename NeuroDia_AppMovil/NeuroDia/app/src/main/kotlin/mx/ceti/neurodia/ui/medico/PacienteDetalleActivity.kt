package mx.ceti.neurodia.ui.medico

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.lifecycle.lifecycleScope
import com.github.mikephil.charting.components.XAxis
import com.github.mikephil.charting.data.*
import com.github.mikephil.charting.formatter.IndexAxisValueFormatter
import kotlinx.coroutines.launch
import mx.ceti.neurodia.R
import mx.ceti.neurodia.databinding.ActivityPacienteDetalleBinding
import mx.ceti.neurodia.util.BaseActivity

class PacienteDetalleActivity : BaseActivity() {

    private lateinit var b: ActivityPacienteDetalleBinding
    private var pacienteId = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityPacienteDetalleBinding.inflate(layoutInflater)
        setContentView(b.root)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        pacienteId = intent.getIntExtra("paciente_id", 0)
        val nombre = intent.getStringExtra("nombre") ?: "Paciente"
        title = nombre

        b.btnVerificar.setOnClickListener { verificar() }
        b.btnChat.setOnClickListener {
            startActivity(
                Intent(this, ChatMedicoActivity::class.java)
                    .putExtra("paciente_id", pacienteId)
                    .putExtra("nombre", nombre)
            )
        }

        cargar()
    }

    private fun cargar() {
        b.progressBar.visibility = View.VISIBLE
        lifecycleScope.launch {
            try {
                val resp = api.getPacienteDetalle(pacienteId)
                if (resp.isSuccessful) {
                    val det = resp.body()!!
                    val p = det.paciente

                    b.tvNombreCompleto.text = "${p.nombre} ${p.apellidos}"
                    b.tvDiabetes.text = "Tipo: ${p.tipoDiabetes ?: "—"}"
                    b.tvHba1c.text    = "HbA1c: ${p.hba1c ?: "—"}%"
                    b.tvAnios.text    = "Años dx: ${p.aniosDiagnostico ?: "—"}"
                    b.tvGrupo.text    = "Grupo: ${p.grupoEstudio ?: "—"}"
                    b.tvComorbilidades.text = "Comorbilidades: ${p.comorbilidades.joinToString(", ").ifEmpty { "Ninguna" }}"
                    b.tvMedicamentos.text   = "Medicamentos: ${p.medicamentos.joinToString(", ") { it.nombre }.ifEmpty { "Ninguno" }}"
                    b.tvVerificado.text     = if (p.verificado) "✓ Verificado" else "Pendiente de verificación"
                    b.tvConsentimiento.text = if (p.consentimiento) "✓ Consentimiento otorgado" else "Sin consentimiento"

                    b.btnVerificar.visibility = if (p.verificado) View.GONE else View.VISIBLE

                    // Alertas recientes
                    val alertas = det.alertas.take(3)
                    b.tvAlertas.text = if (alertas.isEmpty()) "Sin alertas recientes"
                    else alertas.joinToString("\n") { "• ${it.tipo}: ${it.descripcion.take(60)}" }

                    // Gráfica de glucosa
                    val registros = det.registros.filter { it.glucosaValor != null }.reversed()
                    if (registros.isNotEmpty()) {
                        val entries = registros.mapIndexed { i, r -> Entry(i.toFloat(), r.glucosaValor!!.toFloat()) }
                        val labels  = registros.map { it.fecha.takeLast(5) }
                        val ds = LineDataSet(entries, "Glucosa mg/dL").apply {
                            color = getColor(R.color.teal_700)
                            setCircleColor(getColor(R.color.teal_700))
                            lineWidth = 2f; circleRadius = 3f
                        }
                        b.lineChart.apply {
                            data = LineData(ds)
                            xAxis.apply {
                                valueFormatter = IndexAxisValueFormatter(labels)
                                position = XAxis.XAxisPosition.BOTTOM
                                granularity = 1f
                                labelRotationAngle = -45f
                            }
                            axisRight.isEnabled = false
                            description.isEnabled = false
                            animateX(400)
                            invalidate()
                        }
                    }
                } else {
                    toast("Error al cargar detalle")
                }
            } catch (e: Exception) {
                toast("Sin conexión: ${e.message}")
            } finally {
                b.progressBar.visibility = View.GONE
            }
        }
    }

    private fun verificar() {
        lifecycleScope.launch {
            try {
                val r = api.verificarPaciente(pacienteId)
                if (r.isSuccessful) { toast("Paciente verificado"); cargar() }
            } catch (_: Exception) { toast("Error al verificar") }
        }
    }

    override fun onSupportNavigateUp(): Boolean { finish(); return true }
}
