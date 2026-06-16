package mx.ceti.neurodia.ui.paciente

import android.os.Bundle
import android.view.*
import android.widget.TextView
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import kotlinx.coroutines.launch
import mx.ceti.neurodia.R
import mx.ceti.neurodia.data.model.AlertaOut
import mx.ceti.neurodia.databinding.ActivityAlertasPacienteBinding
import mx.ceti.neurodia.util.BaseActivity

class AlertasPacienteActivity : BaseActivity() {

    private lateinit var b: ActivityAlertasPacienteBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityAlertasPacienteBinding.inflate(layoutInflater)
        setContentView(b.root)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        b.rvAlertas.layoutManager = LinearLayoutManager(this)
        cargar()
        b.srlAlertas.setOnRefreshListener { cargar() }
    }

    private fun cargar() {
        lifecycleScope.launch {
            b.srlAlertas.isRefreshing = true
            try {
                val resp = api.getAlertasPaciente(session.perfilId)
                if (resp.isSuccessful) {
                    val lista = resp.body() ?: emptyList()
                    b.rvAlertas.adapter = AlertaAdapter(lista)
                    b.tvVacio.visibility = if (lista.isEmpty()) View.VISIBLE else View.GONE
                }
            } catch (e: Exception) {
                toast("Sin conexión")
            } finally {
                b.srlAlertas.isRefreshing = false
            }
        }
    }

    override fun onSupportNavigateUp(): Boolean { finish(); return true }
}

class AlertaAdapter(private val items: List<AlertaOut>) :
    RecyclerView.Adapter<AlertaAdapter.VH>() {

    inner class VH(view: View) : RecyclerView.ViewHolder(view) {
        val tvTipo:  TextView = view.findViewById(R.id.tvTipo)
        val tvDesc:  TextView = view.findViewById(R.id.tvDescripcion)
        val tvFecha: TextView = view.findViewById(R.id.tvFecha)
        val tvEstado:TextView = view.findViewById(R.id.tvEstado)
    }

    override fun onCreateViewHolder(p: ViewGroup, t: Int) =
        VH(LayoutInflater.from(p.context).inflate(R.layout.item_alerta, p, false))

    override fun onBindViewHolder(h: VH, pos: Int) {
        val a = items[pos]
        val tipoLabel = mapOf(
            "glucosa_alta" to "🔴 Glucosa alta",
            "glucosa_baja" to "🟡 Glucosa baja",
            "dolor_severo" to "🟠 Dolor severo",
            "baja_adherencia" to "⚠️ Baja adherencia",
            "otro" to "ℹ️ Otro"
        )
        h.tvTipo.text  = tipoLabel[a.tipo] ?: a.tipo
        h.tvDesc.text  = a.descripcion
        h.tvFecha.text = a.createdAt.take(16).replace("T", " ")
        h.tvEstado.text = if (a.resuelta) "✓ Resuelta" else "Pendiente"
        h.tvEstado.setTextColor(
            if (a.resuelta) h.itemView.context.getColor(R.color.teal_700)
            else            h.itemView.context.getColor(R.color.red_500)
        )
    }

    override fun getItemCount() = items.size
}
