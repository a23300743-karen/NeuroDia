package mx.ceti.neurodia.ui.medico

import android.os.Bundle
import android.view.*
import android.widget.TextView
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import kotlinx.coroutines.launch
import mx.ceti.neurodia.R
import mx.ceti.neurodia.data.model.ConversacionOut
import mx.ceti.neurodia.data.model.MensajeOut
import mx.ceti.neurodia.databinding.ActivityChatMedicoBinding
import mx.ceti.neurodia.ui.paciente.MensajeAdapter
import mx.ceti.neurodia.util.BaseActivity
import okhttp3.*
import org.json.JSONObject

class ChatMedicoActivity : BaseActivity() {

    private lateinit var b: ActivityChatMedicoBinding
    private val mensajes = mutableListOf<MensajeOut>()
    private lateinit var mensajeAdapter: MensajeAdapter
    private var ws: WebSocket? = null

    // Puede venir de PacienteDetalleActivity con un paciente específico preseleccionado
    private var pacienteIdActual: Int = -1
    private var nombrePacienteActual: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityChatMedicoBinding.inflate(layoutInflater)
        setContentView(b.root)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        // Setup conversaciones
        b.rvConversaciones.layoutManager = LinearLayoutManager(this)

        // Setup mensajes
        mensajeAdapter = MensajeAdapter(mensajes, session.userId)
        b.rvMensajes.layoutManager = LinearLayoutManager(this).apply { stackFromEnd = true }
        b.rvMensajes.adapter = mensajeAdapter

        b.btnEnviar.setOnClickListener { enviar() }

        // Si viene de detalle de paciente, abrir chat directamente
        val pidExtra = intent.getIntExtra("paciente_id", -1)
        if (pidExtra != -1) {
            pacienteIdActual   = pidExtra
            nombrePacienteActual = intent.getStringExtra("nombre") ?: ""
            abrirChat(pacienteIdActual, nombrePacienteActual)
        }

        cargarConversaciones()
        conectarWS()
    }

    private fun cargarConversaciones() {
        lifecycleScope.launch {
            try {
                val resp = api.getConversaciones()
                if (resp.isSuccessful) {
                    b.rvConversaciones.adapter = ConvAdapter(resp.body() ?: emptyList()) { conv ->
                        abrirChat(conv.pacienteId, conv.nombre)
                    }
                }
            } catch (_: Exception) {}
        }
    }

    private fun abrirChat(pacienteId: Int, nombre: String) {
        pacienteIdActual    = pacienteId
        nombrePacienteActual = nombre
        b.tvPacienteChat.text = nombre
        b.layoutChat.visibility = View.VISIBLE

        mensajes.clear()
        mensajeAdapter.notifyDataSetChanged()

        lifecycleScope.launch {
            try {
                val resp = api.getMensajes(pacienteId, 50)
                if (resp.isSuccessful) {
                    mensajes.addAll(resp.body() ?: emptyList())
                    mensajeAdapter.notifyDataSetChanged()
                    if (mensajes.isNotEmpty())
                        b.rvMensajes.scrollToPosition(mensajes.size - 1)
                }
            } catch (_: Exception) {}
        }
    }

    private fun conectarWS() {
        val token  = session.token ?: return
        val userId = session.userId
        val url = "ws://10.0.2.2:8000/ws/chat/$userId?token=$token"

        ws = OkHttpClient().newWebSocket(Request.Builder().url(url).build(), object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                runOnUiThread {
                    try {
                        val obj = JSONObject(text)
                        val pid = obj.optInt("paciente_id", -1)
                        if (pid == pacienteIdActual) {
                            val msg = MensajeOut(
                                id           = obj.optInt("id", 0),
                                emisor       = obj.getString("emisor"),
                                contenido    = obj.getString("contenido"),
                                leido        = true,
                                fueraHorario = obj.optBoolean("fuera_horario", false),
                                createdAt    = obj.optString("created_at", "")
                            )
                            mensajes.add(msg)
                            mensajeAdapter.notifyItemInserted(mensajes.size - 1)
                            b.rvMensajes.smoothScrollToPosition(mensajes.size - 1)
                        }
                        // Refrescar lista de conversaciones para actualizar badges
                        cargarConversaciones()
                    } catch (_: Exception) {}
                }
            }
        })
    }

    private fun enviar() {
        val texto = b.etMensaje.text?.toString()?.trim() ?: ""
        if (texto.isEmpty() || pacienteIdActual < 0) return
        val json = JSONObject()
            .put("contenido", texto)
            .put("paciente_id", pacienteIdActual)
            .toString()
        ws?.send(json)
        b.etMensaje.text?.clear()
    }

    override fun onDestroy() {
        ws?.close(1000, null)
        super.onDestroy()
    }

    override fun onSupportNavigateUp(): Boolean { finish(); return true }
}

class ConvAdapter(
    private val items: List<ConversacionOut>,
    private val onClick: (ConversacionOut) -> Unit
) : RecyclerView.Adapter<ConvAdapter.VH>() {

    inner class VH(v: View) : RecyclerView.ViewHolder(v) {
        val tvNombre:  TextView = v.findViewById(R.id.tvNombre)
        val tvUltimo:  TextView = v.findViewById(R.id.tvUltimoMsg)
        val tvBadge:   TextView = v.findViewById(R.id.tvBadge)
        val tvIniciales: TextView = v.findViewById(R.id.tvIniciales)
    }

    override fun onCreateViewHolder(p: ViewGroup, t: Int) =
        VH(LayoutInflater.from(p.context).inflate(R.layout.item_conversacion, p, false))

    override fun onBindViewHolder(h: VH, pos: Int) {
        val c = items[pos]
        h.tvNombre.text    = c.nombre
        h.tvIniciales.text = c.iniciales
        h.tvUltimo.text    = c.ultimoMensaje ?: "Sin mensajes"
        h.tvBadge.visibility = if (c.noLeidos > 0) View.VISIBLE else View.GONE
        h.tvBadge.text       = c.noLeidos.toString()
        h.itemView.setOnClickListener { onClick(c) }
    }

    override fun getItemCount() = items.size
}
