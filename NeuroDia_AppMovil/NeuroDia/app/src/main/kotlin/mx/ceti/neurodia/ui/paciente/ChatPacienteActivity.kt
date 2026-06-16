package mx.ceti.neurodia.ui.paciente

import android.os.Bundle
import android.view.*
import android.widget.TextView
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import kotlinx.coroutines.launch
import mx.ceti.neurodia.R
import mx.ceti.neurodia.data.model.MensajeOut
import mx.ceti.neurodia.databinding.ActivityChatBinding
import mx.ceti.neurodia.util.BaseActivity
import okhttp3.*
import org.json.JSONObject

class ChatPacienteActivity : BaseActivity() {

    private lateinit var b: ActivityChatBinding
    private val mensajes = mutableListOf<MensajeOut>()
    private lateinit var adapter: MensajeAdapter
    private var ws: WebSocket? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityChatBinding.inflate(layoutInflater)
        setContentView(b.root)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        adapter = MensajeAdapter(mensajes, session.userId)
        b.rvMensajes.layoutManager = LinearLayoutManager(this).apply { stackFromEnd = true }
        b.rvMensajes.adapter = adapter

        cargarHistorial()
        conectarWS()

        b.btnEnviar.setOnClickListener { enviar() }
    }

    private fun cargarHistorial() {
        lifecycleScope.launch {
            try {
                val resp = api.getMensajes(session.perfilId, 50)
                if (resp.isSuccessful) {
                    mensajes.clear()
                    mensajes.addAll(resp.body() ?: emptyList())
                    adapter.notifyDataSetChanged()
                    scrollAbajo()
                }
                // Info de horario
                val hResp = api.getHorarioPaciente()
                if (hResp.isSuccessful) {
                    val h = hResp.body()!!
                    b.tvMedicoNombre.text = h.medicoNombre.ifEmpty { "Sin médico asignado" }
                    b.tvDisponible.text   = if (h.disponible) "● Disponible" else "○ No disponible"
                    b.tvDisponible.setTextColor(
                        getColor(if (h.disponible) R.color.teal_700 else R.color.red_500)
                    )
                }
            } catch (_: Exception) {}
        }
    }

    private fun conectarWS() {
        val token  = session.token ?: return
        val userId = session.userId
        // URL del WebSocket — ajusta la IP igual que RetrofitClient
        val url = "ws://10.0.2.2:8000/ws/chat/$userId?token=$token"

        val request = Request.Builder().url(url).build()
        ws = okhttp3.OkHttpClient().newWebSocket(request, object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                runOnUiThread {
                    try {
                        val obj = JSONObject(text)
                        val msg = MensajeOut(
                            id           = obj.optInt("id", 0),
                            emisor       = obj.getString("emisor"),
                            contenido    = obj.getString("contenido"),
                            leido        = true,
                            fueraHorario = obj.optBoolean("fuera_horario", false),
                            createdAt    = obj.optString("created_at", "")
                        )
                        // Evitar duplicados (confirmación del propio envío)
                        if (mensajes.none { it.id == msg.id && it.id != 0 }) {
                            mensajes.add(msg)
                            adapter.notifyItemInserted(mensajes.size - 1)
                            scrollAbajo()
                        }
                    } catch (_: Exception) {}
                }
            }
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                runOnUiThread { toast("WebSocket desconectado") }
            }
        })
    }

    private fun enviar() {
        val texto = b.etMensaje.text?.toString()?.trim() ?: ""
        if (texto.isEmpty()) return
        val json = JSONObject().put("contenido", texto).toString()
        ws?.send(json)
        b.etMensaje.text?.clear()
    }

    private fun scrollAbajo() {
        if (mensajes.isNotEmpty())
            b.rvMensajes.smoothScrollToPosition(mensajes.size - 1)
    }

    override fun onDestroy() {
        ws?.close(1000, "Activity destroyed")
        super.onDestroy()
    }

    override fun onSupportNavigateUp(): Boolean { finish(); return true }
}

// ── Adapter para mensajes ─────────────────────

class MensajeAdapter(
    private val items: List<MensajeOut>,
    private val myUserId: Int
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    companion object {
        const val VIEW_SENT = 1
        const val VIEW_RECV = 2
    }

    override fun getItemViewType(pos: Int) =
        if (items[pos].emisor == "paciente") VIEW_SENT else VIEW_RECV

    override fun onCreateViewHolder(p: ViewGroup, type: Int): RecyclerView.ViewHolder {
        val layout = if (type == VIEW_SENT) R.layout.item_msg_sent else R.layout.item_msg_recv
        val v = LayoutInflater.from(p.context).inflate(layout, p, false)
        return object : RecyclerView.ViewHolder(v) {}
    }

    override fun onBindViewHolder(h: RecyclerView.ViewHolder, pos: Int) {
        val m = items[pos]
        h.itemView.findViewById<TextView>(R.id.tvContenido)?.text = m.contenido
        h.itemView.findViewById<TextView>(R.id.tvHora)?.text      = m.createdAt.take(16).replace("T"," ")
        if (m.fueraHorario) {
            h.itemView.findViewById<TextView>(R.id.tvFueraHorario)?.apply {
                visibility = View.VISIBLE
                text = "⚠ Fuera de horario"
            }
        }
    }

    override fun getItemCount() = items.size
}
