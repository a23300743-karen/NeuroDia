package mx.ceti.neurodia.ui.paciente

import android.content.Intent
import android.os.Bundle
import mx.ceti.neurodia.R
import mx.ceti.neurodia.databinding.ActivityPacienteHomeBinding
import mx.ceti.neurodia.ui.login.LoginActivity
import mx.ceti.neurodia.util.BaseActivity

class PacienteHomeActivity : BaseActivity() {

    private lateinit var b: ActivityPacienteHomeBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityPacienteHomeBinding.inflate(layoutInflater)
        setContentView(b.root)

        b.tvBienvenida.text = "Hola, ${session.nombre} ${session.apellidos}"

        b.cardMonitoreo.setOnClickListener {
            startActivity(Intent(this, MonitoreoActivity::class.java))
        }
        b.cardHistorial.setOnClickListener {
            startActivity(Intent(this, HistorialActivity::class.java))
        }
        b.cardPerfil.setOnClickListener {
            startActivity(Intent(this, PerfilActivity::class.java))
        }
        b.cardAlertas.setOnClickListener {
            startActivity(Intent(this, AlertasPacienteActivity::class.java))
        }
        b.cardMedicamentos.setOnClickListener {
            startActivity(Intent(this, MedicamentosActivity::class.java))
        }
        b.cardChat.setOnClickListener {
            startActivity(Intent(this, ChatPacienteActivity::class.java))
        }
        b.btnLogout.setOnClickListener {
            session.logout()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }
    }
}
