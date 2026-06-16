package mx.ceti.neurodia.ui.paciente

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.github.mikephil.charting.components.XAxis
import com.github.mikephil.charting.data.*
import com.github.mikephil.charting.formatter.IndexAxisValueFormatter
import kotlinx.coroutines.launch
import mx.ceti.neurodia.R
import mx.ceti.neurodia.data.model.RegistroOut
import mx.ceti.neurodia.databinding.ActivityHistorialBinding
import mx.ceti.neurodia.util.BaseActivity

class HistorialActivity : BaseActivity() {

    private lateinit var b: ActivityHistorialBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityHistorialBinding.inflate(layoutInflater)
        setContentView(b.root)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        b.rvRegistros.layoutManager = LinearLayoutManager(this)
        cargarRegistros()

        b.srlRegistros.setOnRefreshListener { cargarRegistros() }
    }

    private fun cargarRegistros() {
        lifecycleScope.launch {
            b.srlRegistros.isRefreshing = true
            try {
                val resp = api.getRegistros(session.perfilId, 30)
                if (resp.isSuccessful) {
                    val lista = resp.body() ?: emptyList()
                    b.rvRegistros.adapter = RegistroAdapter(lista)
                    if (lista.isNotEmpty()) dibujarGrafica(lista)
                    b.tvVacio.visibility = if (lista.isEmpty()) View.VISIBLE else View.GONE
                } else {
                    toast("Error al cargar historial")
                }
            } catch (e: Exception) {
                toast("Sin conexión")
            } finally {
                b.srlRegistros.isRefreshing = false
            }
        }
    }

    private fun dibujarGrafica(registros: List<RegistroOut>) {
        val reversed = registros.reversed()   // más antiguo primero
        val entries  = reversed.mapIndexedNotNull { i, r ->
            r.glucosaValor?.let { Entry(i.toFloat(), it.toFloat()) }
        }
        val labels = reversed.map { it.fecha.takeLast(5) }  // MM-DD

        val dataSet = LineDataSet(entries, "Glucosa (mg/dL)").apply {
            color = getColor(R.color.teal_700)
            setCircleColor(getColor(R.color.teal_700))
            lineWidth = 2f
            circleRadius = 4f
            valueTextSize = 10f
        }

        b.lineChart.apply {
            data = LineData(dataSet)
            xAxis.apply {
                valueFormatter = IndexAxisValueFormatter(labels)
                position = XAxis.XAxisPosition.BOTTOM
                granularity = 1f
                labelRotationAngle = -45f
            }
            axisRight.isEnabled = false
            description.isEnabled = false
            legend.isEnabled = true
            animateX(500)
            invalidate()
        }
    }

    override fun onSupportNavigateUp(): Boolean { finish(); return true }
}

// ── Adapter ───────────────────────────────────

class RegistroAdapter(private val items: List<RegistroOut>) :
    RecyclerView.Adapter<RegistroAdapter.VH>() {

    inner class VH(view: View) : RecyclerView.ViewHolder(view) {
        val tvFecha:   TextView = view.findViewById(R.id.tvFecha)
        val tvGlucosa: TextView = view.findViewById(R.id.tvGlucosa)
        val tvDolor:   TextView = view.findViewById(R.id.tvDolor)
        val tvEstado:  TextView = view.findViewById(R.id.tvEstado)
        val tvSint:    TextView = view.findViewById(R.id.tvSintomas)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH =
        VH(LayoutInflater.from(parent.context).inflate(R.layout.item_registro, parent, false))

    override fun onBindViewHolder(h: VH, pos: Int) {
        val r = items[pos]
        h.tvFecha.text   = r.fecha
        h.tvGlucosa.text = r.glucosaValor?.let { "Glucosa: ${"%.0f".format(it)} mg/dL (${r.glucosaMomento})" }
                           ?: "Sin glucosa"
        h.tvDolor.text   = "Dolor: ${r.dolorIntensidad ?: "-"}/10"
        h.tvEstado.text  = r.estado.replaceFirstChar { it.uppercase() }
        h.tvSint.text    = if (r.sintomas.isEmpty()) "" else "Síntomas: ${r.sintomas.joinToString(", ")}"
        h.tvSint.visibility = if (r.sintomas.isEmpty()) View.GONE else View.VISIBLE
    }

    override fun getItemCount() = items.size
}
