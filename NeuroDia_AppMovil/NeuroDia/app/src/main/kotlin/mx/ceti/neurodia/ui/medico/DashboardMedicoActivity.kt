package mx.ceti.neurodia.ui.medico

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import mx.ceti.neurodia.databinding.ActivityDashboardMedicoBinding
import mx.ceti.neurodia.ui.login.LoginActivity
import mx.ceti.neurodia.util.BaseActivity

class DashboardMedicoActivity : BaseActivity() {

    private lateinit var b: ActivityDashboardMedicoBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityDashboardMedicoBinding.inflate(layoutInflater)
        setContentView(b.root)

        b.tvBienvenida.text = "Dr. ${session.nombre} ${session.apellidos}"

        b.cardPacientes.setOnClickListener {
            startActivity(Intent(this, PacientesActivity::class.java))
        }
        b.cardAlertas.setOnClickListener {
            startActivity(Intent(this, AlertasMedicoActivity::class.java))
        }
        b.cardChat.setOnClickListener {
            startActivity(Intent(this, ChatMedicoActivity::class.java))
        }
        b.cardHorario.setOnClickListener {
            startActivity(Intent(this, HorarioActivity::class.java))
        }
        b.btnLogout.setOnClickListener {
            session.logout()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }

        cargarDashboard()
    }

    override fun onResume() {
        super.onResume()
        cargarDashboard()
    }

    private fun cargarDashboard() {
        lifecycleScope.launch {
            try {
                val resp = api.getDashboard()
                if (resp.isSuccessful) {
                    val d = resp.body()!!
                    b.tvTotalPacientes.text   = d.totalPacientes.toString()
                    b.tvActivos.text          = d.pacientesActivos.toString()
                    b.tvAlertas.text          = d.alertasPendientes.toString()
                    b.tvSinRegistro.text      = d.sinRegistro7dias.toString()

                    // Resaltar si hay alertas pendientes
                    if (d.alertasPendientes > 0) {
                        b.tvAlertas.setTextColor(getColor(android.R.color.holo_red_dark))
                    }
                }
            } catch (_: Exception) {}
        }
    }
}
