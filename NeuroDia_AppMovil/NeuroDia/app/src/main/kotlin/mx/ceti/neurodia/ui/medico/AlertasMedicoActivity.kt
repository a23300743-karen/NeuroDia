package mx.ceti.neurodia.ui.medico

import android.os.Bundle
import android.view.*
import android.widget.*
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import kotlinx.coroutines.launch
import mx.ceti.neurodia.R
import mx.ceti.neurodia.data.model.AlertaOut
import mx.ceti.neurodia.databinding.ActivityAlertasMedicoBinding
import mx.ceti.neurodia.util.BaseActivity

class AlertasMedicoActivity : BaseActivity() {

    private lateinit var b: ActivityAlertasMedicoBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityAlertasMedicoBinding.inflate(layoutInflater)
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
                val resp = api.getAlertasMedico()
                if (resp.isSuccessful) {
                    val lista = resp.body() ?: emptyList()
                    b.rvAlertas.adapter = AlertaMedicoAdapter(lista) { id -> resolver(id) }
                    b.tvVacio.visibility = if (lista.isEmpty()) View.VISIBLE else View.GONE
                    b.tvCount.text = "${lista.size} alerta(s) pendiente(s)"
                }
            } catch (_: Exception) { toast("Sin conexión") }
            finally { b.srlAlertas.isRefreshing = false }
        }
    }

    private fun resolver(id: Int) {
        lifecycleScope.launch {
            try {
                val r = api.resolverAlerta(id)
                if (r.isSuccessful) { toast("Alerta resuelta"); cargar() }
            } catch (_: Exception) { toast("Error") }
        }
    }

    override fun onSupportNavigateUp(): Boolean { finish(); return true }
}

class AlertaMedicoAdapter(
    private val items: List<AlertaOut>,
    private val onResolver: (Int) -> Unit
) : RecyclerView.Adapter<AlertaMedicoAdapter.VH>() {

    inner class VH(v: View) : RecyclerView.ViewHolder(v) {
        val tvTipo:   TextView = v.findViewById(R.id.tvTipo)
        val tvDesc:   TextView = v.findViewById(R.id.tvDescripcion)
        val tvFecha:  TextView = v.findViewById(R.id.tvFecha)
        val btnRes:   Button   = v.findViewById(R.id.btnResolver)
    }

    override fun onCreateViewHolder(p: ViewGroup, t: Int) =
        VH(LayoutInflater.from(p.context).inflate(R.layout.item_alerta_medico, p, false))

    override fun onBindViewHolder(h: VH, pos: Int) {
        val a = items[pos]
        val iconos = mapOf(
            "glucosa_alta" to "🔴", "glucosa_baja" to "🟡",
            "dolor_severo" to "🟠", "baja_adherencia" to "⚠️", "otro" to "ℹ️"
        )
        h.tvTipo.text  = "${iconos[a.tipo] ?: ""} ${a.tipo.replace("_"," ").replaceFirstChar { it.uppercase() }}"
        h.tvDesc.text  = a.descripcion
        h.tvFecha.text = a.createdAt.take(16).replace("T", " ")
        h.btnRes.setOnClickListener { onResolver(a.id) }
    }

    override fun getItemCount() = items.size
}
