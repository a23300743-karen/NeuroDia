package mx.ceti.neurodia.ui.medico

import android.content.Intent
import android.os.Bundle
import android.view.*
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import kotlinx.coroutines.launch
import mx.ceti.neurodia.R
import mx.ceti.neurodia.data.model.PacienteResumenOut
import mx.ceti.neurodia.databinding.ActivityPacientesBinding
import mx.ceti.neurodia.util.BaseActivity

class PacientesActivity : BaseActivity() {

    private lateinit var b: ActivityPacientesBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityPacientesBinding.inflate(layoutInflater)
        setContentView(b.root)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        b.rvPacientes.layoutManager = LinearLayoutManager(this)
        b.fabAgregar.setOnClickListener { mostrarOpcionesAgregar() }
        cargar()
        b.srlPacientes.setOnRefreshListener { cargar() }
    }

    private fun cargar() {
        lifecycleScope.launch {
            b.srlPacientes.isRefreshing = true
            try {
                val resp = api.getMisPacientes()
                if (resp.isSuccessful) {
                    val lista = resp.body() ?: emptyList()
                    b.rvPacientes.adapter = PacienteAdapter(lista) { p ->
                        startActivity(
                            Intent(this@PacientesActivity, PacienteDetalleActivity::class.java)
                                .putExtra("paciente_id", p.id)
                                .putExtra("nombre", "${p.nombre} ${p.apellidos}")
                        )
                    }
                    b.tvVacio.visibility = if (lista.isEmpty()) View.VISIBLE else View.GONE
                }
            } catch (_: Exception) { toast("Sin conexión") }
            finally { b.srlPacientes.isRefreshing = false }
        }
    }

    private fun mostrarOpcionesAgregar() {
        AlertDialog.Builder(this)
            .setTitle("Agregar paciente")
            .setItems(arrayOf("Dar de alta nuevo paciente", "Vincular paciente existente")) { _, which ->
                when (which) {
                    0 -> startActivity(Intent(this, AltaPacienteActivity::class.java))
                    1 -> startActivity(Intent(this, AltaPacienteActivity::class.java)
                            .putExtra("modo", "vincular"))
                }
            }.show()
    }

    override fun onResume() { super.onResume(); cargar() }
    override fun onSupportNavigateUp(): Boolean { finish(); return true }
}

class PacienteAdapter(
    private val items: List<PacienteResumenOut>,
    private val onClick: (PacienteResumenOut) -> Unit
) : RecyclerView.Adapter<PacienteAdapter.VH>() {

    inner class VH(v: View) : RecyclerView.ViewHolder(v) {
        val tvNombre:  TextView = v.findViewById(R.id.tvNombre)
        val tvInfo:    TextView = v.findViewById(R.id.tvInfo)
        val tvAlertas: TextView = v.findViewById(R.id.tvAlertas)
        val tvGlucosa: TextView = v.findViewById(R.id.tvGlucosa)
    }

    override fun onCreateViewHolder(p: ViewGroup, t: Int) =
        VH(LayoutInflater.from(p.context).inflate(R.layout.item_paciente, p, false))

    override fun onBindViewHolder(h: VH, pos: Int) {
        val p = items[pos]
        h.tvNombre.text  = "${p.nombre} ${p.apellidos}"
        h.tvInfo.text    = buildString {
            p.tipoDiabetes?.let { append("DM ${it.replace("tipo_","").uppercase()}") }
            p.hba1c?.let { append("  |  HbA1c $it%") }
            p.aniosDiagnostico?.let { append("  |  $it años dx") }
        }
        h.tvGlucosa.text = p.ultimaGlucosa?.let {
            "Última glucosa: ${"%.0f".format(it)} mg/dL (${p.ultimaFecha ?: "—"})"
        } ?: "Sin registros"

        h.tvAlertas.visibility = if (p.alertasActivas > 0) View.VISIBLE else View.GONE
        h.tvAlertas.text = "⚠ ${p.alertasActivas} alerta(s)"

        h.itemView.setOnClickListener { onClick(p) }
    }

    override fun getItemCount() = items.size
}
