package mx.ceti.neurodia.data.network

import mx.ceti.neurodia.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    // ── Autenticación ─────────────────────────

    @POST("auth/register")
    suspend fun register(@Body data: RegisterRequest): Response<TokenResponse>

    @POST("auth/login")
    suspend fun login(@Body creds: LoginRequest): Response<TokenResponse>

    @GET("auth/me")
    suspend fun getMe(): Response<UserPublic>

    // ── Perfil paciente ───────────────────────

    @GET("pacientes/{id}/perfil")
    suspend fun getPerfil(@Path("id") pacienteId: Int): Response<PerfilOut>

    @PATCH("pacientes/{id}/perfil")
    suspend fun updatePerfil(
        @Path("id") pacienteId: Int,
        @Body data: PerfilUpdate
    ): Response<PerfilOut>

    // ── Registros diarios ─────────────────────

    @GET("pacientes/{id}/registros")
    suspend fun getRegistros(
        @Path("id") pacienteId: Int,
        @Query("limit") limit: Int = 30
    ): Response<List<RegistroOut>>

    @POST("pacientes/{id}/registros")
    suspend fun createRegistro(
        @Path("id") pacienteId: Int,
        @Body data: RegistroIn
    ): Response<RegistroOut>

    // ── Alertas ───────────────────────────────

    @GET("pacientes/{id}/alertas")
    suspend fun getAlertasPaciente(@Path("id") pacienteId: Int): Response<List<AlertaOut>>

    @PATCH("alertas/{id}/resolver")
    suspend fun resolverAlerta(@Path("id") alertaId: Int): Response<OkResponse>

    // ── Comorbilidades ────────────────────────

    @GET("pacientes/{id}/comorbilidades")
    suspend fun getComorbilidades(@Path("id") pacienteId: Int): Response<List<ComorbOut>>

    @POST("pacientes/{id}/comorbilidades")
    suspend fun addComorbilidad(
        @Path("id") pacienteId: Int,
        @Body data: ComorbIn
    ): Response<ComorbOut>

    @DELETE("comorbilidades/{id}")
    suspend fun deleteComorbilidad(@Path("id") id: Int): Response<OkResponse>

    // ── Medicamentos ──────────────────────────

    @GET("pacientes/{id}/medicamentos")
    suspend fun getMedicamentos(@Path("id") pacienteId: Int): Response<List<MedOut>>

    @POST("pacientes/{id}/medicamentos")
    suspend fun addMedicamento(
        @Path("id") pacienteId: Int,
        @Body data: MedIn
    ): Response<MedOut>

    @DELETE("medicamentos/{id}")
    suspend fun deleteMedicamento(@Path("id") id: Int): Response<OkResponse>

    // ── Médico ────────────────────────────────

    @GET("medico/dashboard")
    suspend fun getDashboard(): Response<DashboardMedicoOut>

    @GET("medico/pacientes")
    suspend fun getMisPacientes(): Response<List<PacienteResumenOut>>

    @GET("medico/alertas")
    suspend fun getAlertasMedico(): Response<List<AlertaOut>>

    @POST("medico/alta-paciente")
    suspend fun altaPaciente(@Body data: AltaPacienteIn): Response<PacienteResumenOut>

    @POST("medico/vincular-paciente")
    suspend fun vincularPaciente(@Body data: VincularPacienteIn): Response<PacienteResumenOut>

    @GET("medico/buscar-paciente")
    suspend fun buscarPaciente(@Query("email") email: String): Response<PacienteBusquedaOut>

    @PATCH("medico/pacientes/{id}/verificar")
    suspend fun verificarPaciente(@Path("id") pacienteId: Int): Response<OkResponse>

    @GET("medico/pacientes/{id}/detalle")
    suspend fun getPacienteDetalle(@Path("id") pacienteId: Int): Response<PacienteDetalleOut>

    // ── Chat REST ─────────────────────────────

    @GET("chat/{pacienteId}/mensajes")
    suspend fun getMensajes(
        @Path("pacienteId") pacienteId: Int,
        @Query("limit") limit: Int = 50
    ): Response<List<MensajeOut>>

    @GET("chat/medico/conversaciones")
    suspend fun getConversaciones(): Response<List<ConversacionOut>>

    @GET("chat/paciente/horario")
    suspend fun getHorarioPaciente(): Response<HorarioPacienteOut>

    @GET("medico/horario")
    suspend fun getHorario(): Response<List<HorarioSlot>>

    @POST("medico/horario")
    suspend fun saveHorario(@Body data: HorarioIn): Response<OkResponse>
}
