package mx.ceti.neurodia.ui.medico

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import kotlinx.coroutines.launch
import mx.ceti.neurodia.R
import mx.ceti.neurodia.data.model.HorarioIn
import mx.ceti.neurodia.data.model.HorarioSlot
import mx.ceti.neurodia.databinding.ActivityHorarioBinding
import mx.ceti.neurodia.util.BaseActivity

class HorarioActivity : BaseActivity() {

    private lateinit var b: ActivityHorarioBinding
    private val DIAS = listOf("lunes","martes","miercoles","jueves","viernes","sabado","domingo")
    private val slots = mutableListOf<HorarioSlot>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityHorarioBinding.inflate(layoutInflater)
        setContentView(b.root)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        // Inicializar con días de la semana
        DIAS.forEach { dia ->
            slots.add(HorarioSlot(dia, "08:00", "17:00", activo = false))
        }

        b.rvHorario.layoutManager = LinearLayoutManager(this)
        b.rvHorario.adapter = HorarioAdapter(slots)

        b.btnGuardar.setOnClickListener { guardar() }

        cargar()
    }

    private fun cargar() {
        lifecycleScope.launch {
            try {
                val resp = api.getHorario()
                if (resp.isSuccessful) {
                    val existentes = resp.body() ?: emptyList()
                    existentes.forEach { h ->
                        val idx = DIAS.indexOf(h.dia)
                        if (idx >= 0) slots[idx] = h
                    }
                    b.rvHorario.adapter?.notifyDataSetChanged()
                }
            } catch (_: Exception) {}
        }
    }

    private fun guardar() {
        lifecycleScope.launch {
            try {
                val r = api.saveHorario(HorarioIn(slots.toList()))
                if (r.isSuccessful) { toast("Horario guardado") }
                else toast("Error al guardar")
            } catch (_: Exception) { toast("Sin conexión") }
        }
    }

    override fun onSupportNavigateUp(): Boolean { finish(); return true }
}

class HorarioAdapter(private val items: MutableList<HorarioSlot>) :
    RecyclerView.Adapter<HorarioAdapter.VH>() {

    inner class VH(v: View) : RecyclerView.ViewHolder(v) {
        val tvDia:   TextView  = v.findViewById(R.id.tvDia)
        val etInicio:EditText  = v.findViewById(R.id.etHoraInicio)
        val etFin:   EditText  = v.findViewById(R.id.etHoraFin)
        val swActivo:Switch    = v.findViewById(R.id.swActivo)
    }

    override fun onCreateViewHolder(p: ViewGroup, t: Int) =
        VH(LayoutInflater.from(p.context).inflate(R.layout.item_horario, p, false))

    override fun onBindViewHolder(h: VH, pos: Int) {
        val s = items[pos]
        val diasLabel = listOf("Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo")
        h.tvDia.text       = diasLabel.getOrElse(pos) { s.dia }
        h.etInicio.setText(s.horaInicio)
        h.etFin.setText(s.horaFin)
        h.swActivo.isChecked = s.activo

        h.swActivo.setOnCheckedChangeListener { _, checked ->
            items[pos] = items[pos].copy(activo = checked)
        }
        h.etInicio.setOnFocusChangeListener { _, hasFocus ->
            if (!hasFocus) items[pos] = items[pos].copy(horaInicio = h.etInicio.text.toString())
        }
        h.etFin.setOnFocusChangeListener { _, hasFocus ->
            if (!hasFocus) items[pos] = items[pos].copy(horaFin = h.etFin.text.toString())
        }
    }

    override fun getItemCount() = items.size
}
