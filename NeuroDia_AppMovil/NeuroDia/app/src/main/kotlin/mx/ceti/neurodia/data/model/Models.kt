package mx.ceti.neurodia.data.model

import com.google.gson.annotations.SerializedName

// ── Auth ─────────────────────────────────────

data class RegisterRequest(
    val email: String,
    val password: String,
    val rol: String,
    val nombre: String,
    val apellidos: String
)

data class LoginRequest(
    val email: String,
    val password: String,
    val role: String? = null
)

data class UserPublic(
    val id: Int,
    @SerializedName("perfil_id") val perfilId: Int,
    val email: String,
    val rol: String,
    val nombre: String,
    val apellidos: String
)

data class TokenResponse(
    @SerializedName("access_token") val accessToken: String,
    @SerializedName("token_type") val tokenType: String,
    val user: UserPublic
)

// ── Perfil paciente ───────────────────────────

data class PerfilOut(
    val id: Int,
    val nombre: String,
    val apellidos: String,
    @SerializedName("fecha_nacimiento") val fechaNacimiento: String?,
    val sexo: String?,
    val curp: String?,
    val telefono: String?,
    @SerializedName("tipo_diabetes") val tipoDiabetes: String?,
    @SerializedName("anios_diagnostico") val aniosDiagnostico: Int?,
    val hba1c: Double?,
    @SerializedName("grupo_estudio") val grupoEstudio: String?,
    val consentimiento: Boolean,
    val verificado: Boolean
)

data class PerfilUpdate(
    val nombre: String? = null,
    val apellidos: String? = null,
    @SerializedName("fecha_nacimiento") val fechaNacimiento: String? = null,
    val sexo: String? = null,
    val curp: String? = null,
    val telefono: String? = null,
    @SerializedName("tipo_diabetes") val tipoDiabetes: String? = null,
    @SerializedName("anios_diagnostico") val aniosDiagnostico: Int? = null,
    val hba1c: Double? = null,
    @SerializedName("grupo_estudio") val grupoEstudio: String? = null
)

// ── Registros diarios ────────────────────────

data class RegistroIn(
    val fecha: String? = null,
    @SerializedName("glucosa_valor") val glucosaValor: Double,
    @SerializedName("glucosa_momento") val glucosaMomento: String,
    @SerializedName("dolor_intensidad") val dolorIntensidad: Int,
    val notas: String? = null,
    val localizaciones: List<String> = emptyList(),
    val sintomas: List<String> = emptyList()
)

data class RegistroOut(
    val id: Int,
    val fecha: String,
    @SerializedName("glucosa_valor") val glucosaValor: Double?,
    @SerializedName("glucosa_momento") val glucosaMomento: String?,
    @SerializedName("dolor_intensidad") val dolorIntensidad: Int?,
    val notas: String?,
    val estado: String,
    @SerializedName("created_at") val createdAt: String,
    val localizaciones: List<String>,
    val sintomas: List<String>
)

// ── Alertas ───────────────────────────────────

data class AlertaOut(
    val id: Int,
    val tipo: String,
    val descripcion: String,
    val resuelta: Boolean,
    @SerializedName("created_at") val createdAt: String
)

// ── Comorbilidades ────────────────────────────

data class ComorbOut(
    val id: Int,
    val nombre: String,
    val activa: Boolean
)

data class ComorbIn(val nombre: String)

// ── Medicamentos ──────────────────────────────

data class MedOut(
    val id: Int,
    val nombre: String,
    val dosis: String?,
    val frecuencia: String?,
    val activo: Boolean
)

data class MedIn(
    val nombre: String,
    val dosis: String? = null,
    val frecuencia: String? = null
)

// ── Médico dashboard ──────────────────────────

data class DashboardMedicoOut(
    @SerializedName("total_pacientes") val totalPacientes: Int,
    @SerializedName("pacientes_activos") val pacientesActivos: Int,
    @SerializedName("alertas_pendientes") val alertasPendientes: Int,
    @SerializedName("sin_registro_7dias") val sinRegistro7dias: Int
)

data class PacienteResumenOut(
    val id: Int,
    val nombre: String,
    val apellidos: String,
    @SerializedName("tipo_diabetes") val tipoDiabetes: String?,
    val hba1c: Double?,
    @SerializedName("anios_diagnostico") val aniosDiagnostico: Int?,
    val verificado: Boolean,
    val consentimiento: Boolean,
    @SerializedName("ultima_glucosa") val ultimaGlucosa: Double?,
    @SerializedName("ultima_fecha") val ultimaFecha: String?,
    @SerializedName("alertas_activas") val alertasActivas: Int
)

data class AltaPacienteIn(
    val email: String,
    val password: String,
    val nombre: String,
    val apellidos: String,
    @SerializedName("tipo_diabetes") val tipoDiabetes: String? = "tipo_2",
    @SerializedName("anios_diagnostico") val aniosDiagnostico: Int? = null,
    val hba1c: Double? = null,
    @SerializedName("grupo_estudio") val grupoEstudio: String? = null,
    val consentimiento: Boolean = false
)

data class VincularPacienteIn(
    val email: String,
    @SerializedName("tipo_diabetes") val tipoDiabetes: String? = null,
    @SerializedName("anios_diagnostico") val aniosDiagnostico: Int? = null,
    val hba1c: Double? = null,
    @SerializedName("grupo_estudio") val grupoEstudio: String? = null,
    val consentimiento: Boolean = false
)

data class PacienteBusquedaOut(
    @SerializedName("usuario_id") val usuarioId: Int,
    @SerializedName("paciente_id") val pacienteId: Int?,
    val email: String,
    val nombre: String,
    val apellidos: String,
    @SerializedName("tipo_diabetes") val tipoDiabetes: String?,
    @SerializedName("anios_diagnostico") val aniosDiagnostico: Int?,
    val hba1c: Double?,
    @SerializedName("grupo_estudio") val grupoEstudio: String?,
    val consentimiento: Boolean,
    @SerializedName("ya_asignado") val yaAsignado: Boolean
)

// Detalle completo para el médico
data class PacienteDetalleOut(
    val paciente: PacienteDetalleInfo,
    val registros: List<RegistroResumenOut>,
    val alertas: List<AlertaDetalleOut>
)

data class PacienteDetalleInfo(
    val id: Int,
    val nombre: String,
    val apellidos: String,
    @SerializedName("tipo_diabetes") val tipoDiabetes: String?,
    val hba1c: Double?,
    @SerializedName("anios_diagnostico") val aniosDiagnostico: Int?,
    val verificado: Boolean,
    val consentimiento: Boolean,
    @SerializedName("grupo_estudio") val grupoEstudio: String?,
    val comorbilidades: List<String>,
    val medicamentos: List<MedResumenOut>
)

data class MedResumenOut(val nombre: String, val dosis: String?)

data class RegistroResumenOut(
    val fecha: String,
    @SerializedName("glucosa_valor") val glucosaValor: Double?,
    @SerializedName("glucosa_momento") val glucosaMomento: String?,
    @SerializedName("dolor_intensidad") val dolorIntensidad: Int?,
    val estado: String,
    val sintomas: List<String>
)

data class AlertaDetalleOut(
    val id: Int,
    val tipo: String,
    val descripcion: String,
    val resuelta: Boolean,
    @SerializedName("created_at") val createdAt: String
)

// ── Chat ──────────────────────────────────────

data class MensajeOut(
    val id: Int,
    val emisor: String,   // "medico" | "paciente"
    val contenido: String,
    val leido: Boolean,
    @SerializedName("fuera_horario") val fueraHorario: Boolean,
    @SerializedName("created_at") val createdAt: String
)

data class ConversacionOut(
    @SerializedName("paciente_id") val pacienteId: Int,
    val nombre: String,
    val iniciales: String,
    @SerializedName("ultimo_mensaje") val ultimoMensaje: String?,
    @SerializedName("ultimo_at") val ultimoAt: String?,
    @SerializedName("ultimo_emisor") val ultimoEmisor: String?,
    @SerializedName("no_leidos") val noLeidos: Int
)

data class HorarioPacienteOut(
    val disponible: Boolean,
    @SerializedName("medico_nombre") val medicoNombre: String,
    val horario: List<HorarioSlot>
)

data class HorarioSlot(
    val dia: String,
    @SerializedName("hora_inicio") val horaInicio: String,
    @SerializedName("hora_fin") val horaFin: String,
    val activo: Boolean = true
)

data class HorarioIn(val horarios: List<HorarioSlot>)

// ── Respuestas simples ────────────────────────

data class OkResponse(val ok: Boolean)
