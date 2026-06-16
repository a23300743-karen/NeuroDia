package mx.ceti.neurodia.ui.paciente

import android.os.Bundle
import android.view.*
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import kotlinx.coroutines.launch
import mx.ceti.neurodia.R
import mx.ceti.neurodia.data.model.*
import mx.ceti.neurodia.databinding.ActivityMedicamentosBinding
import mx.ceti.neurodia.util.BaseActivity
import mx.ceti.neurodia.util.errorMessage

class MedicamentosActivity : BaseActivity() {

    private lateinit var b: ActivityMedicamentosBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityMedicamentosBinding.inflate(layoutInflater)
        setContentView(b.root)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        b.rvMeds.layoutManager   = LinearLayoutManager(this)
        b.rvComorb.layoutManager = LinearLayoutManager(this)

        b.btnAddMed.setOnClickListener   { dialogAgregarMed() }
        b.btnAddComorb.setOnClickListener { dialogAgregarComorb() }

        cargar()
    }

    private fun cargar() {
        lifecycleScope.launch {
            try {
                val mResp = api.getMedicamentos(session.perfilId)
                val cResp = api.getComorbilidades(session.perfilId)
                if (mResp.isSuccessful) {
                    b.rvMeds.adapter = MedAdapter(mResp.body() ?: emptyList()) { deleteM(it) }
                }
                if (cResp.isSuccessful) {
                    b.rvComorb.adapter = ComorbAdapter(cResp.body() ?: emptyList()) { deleteC(it) }
                }
            } catch (e: Exception) { toast("Sin conexión") }
        }
    }

    private fun dialogAgregarMed() {
        val view   = layoutInflater.inflate(R.layout.dialog_add_med, null)
        val etNom  = view.findViewById<EditText>(R.id.etNombre)
        val etDos  = view.findViewById<EditText>(R.id.etDosis)
        val etFrec = view.findViewById<EditText>(R.id.etFrecuencia)
        AlertDialog.Builder(this)
            .setTitle("Agregar medicamento")
            .setView(view)
            .setPositiveButton("Agregar") { _, _ ->
                val nom = etNom.text.toString().trim()
                if (nom.isEmpty()) { toast("Nombre requerido"); return@setPositiveButton }
                lifecycleScope.launch {
                    try {
                        val r = api.addMedicamento(session.perfilId,
                            MedIn(nom, etDos.text.toString().trim().ifEmpty { null },
                                       etFrec.text.toString().trim().ifEmpty { null }))
                        if (r.isSuccessful) { toast("Medicamento agregado"); cargar() }
                        else toast(r.errorBody().errorMessage())
                    } catch (e: Exception) { toast("Sin conexión") }
                }
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun dialogAgregarComorb() {
        val et = EditText(this).apply { hint = "Nombre de la comorbilidad" }
        AlertDialog.Builder(this)
            .setTitle("Agregar comorbilidad")
            .setView(et)
            .setPositiveButton("Agregar") { _, _ ->
                val nom = et.text.toString().trim()
                if (nom.isEmpty()) { toast("Nombre requerido"); return@setPositiveButton }
                lifecycleScope.launch {
                    try {
                        val r = api.addComorbilidad(session.perfilId, ComorbIn(nom))
                        if (r.isSuccessful) { toast("Comorbilidad agregada"); cargar() }
                        else toast(r.errorBody().errorMessage())
                    } catch (e: Exception) { toast("Sin conexión") }
                }
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun deleteM(id: Int) {
        lifecycleScope.launch {
            try {
                val r = api.deleteMedicamento(id)
                if (r.isSuccessful) { toast("Eliminado"); cargar() }
            } catch (e: Exception) { toast("Sin conexión") }
        }
    }

    private fun deleteC(id: Int) {
        lifecycleScope.launch {
            try {
                val r = api.deleteComorbilidad(id)
                if (r.isSuccessful) { toast("Eliminada"); cargar() }
            } catch (e: Exception) { toast("Sin conexión") }
        }
    }

    override fun onSupportNavigateUp(): Boolean { finish(); return true }
}

// Adapters
class MedAdapter(
    private val items: List<MedOut>,
    private val onDelete: (Int) -> Unit
) : RecyclerView.Adapter<MedAdapter.VH>() {
    inner class VH(v: View) : RecyclerView.ViewHolder(v) {
        val tvNom: TextView = v.findViewById(R.id.tvNombre)
        val tvDos: TextView = v.findViewById(R.id.tvDosis)
        val btnDel: ImageButton = v.findViewById(R.id.btnEliminar)
    }
    override fun onCreateViewHolder(p: ViewGroup, t: Int) =
        VH(LayoutInflater.from(p.context).inflate(R.layout.item_medicamento, p, false))
    override fun onBindViewHolder(h: VH, pos: Int) {
        val m = items[pos]
        h.tvNom.text = m.nombre
        h.tvDos.text = listOfNotNull(m.dosis, m.frecuencia).joinToString(" · ")
        h.btnDel.setOnClickListener { onDelete(m.id) }
    }
    override fun getItemCount() = items.size
}

class ComorbAdapter(
    private val items: List<ComorbOut>,
    private val onDelete: (Int) -> Unit
) : RecyclerView.Adapter<ComorbAdapter.VH>() {
    inner class VH(v: View) : RecyclerView.ViewHolder(v) {
        val tvNom: TextView = v.findViewById(R.id.tvNombre)
        val btnDel: ImageButton = v.findViewById(R.id.btnEliminar)
    }
    override fun onCreateViewHolder(p: ViewGroup, t: Int) =
        VH(LayoutInflater.from(p.context).inflate(R.layout.item_comorbilidad, p, false))
    override fun onBindViewHolder(h: VH, pos: Int) {
        h.tvNom.text = items[pos].nombre
        h.btnDel.setOnClickListener { onDelete(items[pos].id) }
    }
    override fun getItemCount() = items.size
}
