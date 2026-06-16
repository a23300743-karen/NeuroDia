"""
NeuroDia — main.py
Ejecutar: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException, Depends, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from pydantic import BaseModel, EmailStr, field_validator
from passlib.context import CryptContext
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, date
from typing import Optional, List
from decimal import Decimal

from backend.database import get_db, verify_connection
from backend.models import (
    Usuario, Medico, Paciente, RolEnum,
    RegistroDiario, DolorLocalizacion, SintomaRegistro,
    Alerta, Comorbilidad, Medicamento,
    MomentoGlucosaEnum, EstadoRegistroEnum
)

# ══════════════════════════════════════════════
# CONFIGURACIÓN
# ══════════════════════════════════════════════

SECRET_KEY = "CAMBIA-ESTO-POR-UNA-CLAVE-SECRETA-SEGURA"
ALGORITHM  = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8

pwd_context   = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

app = FastAPI(
    title="NeuroDia API",
    description="Sistema de monitoreo de neuropatías diabéticas — CETI Grupo 6E",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Servir archivos estáticos del frontend
frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
if os.path.exists(frontend_path):
    app.mount("/css", StaticFiles(directory=os.path.join(frontend_path, "css")), name="css")
    app.mount("/js", StaticFiles(directory=os.path.join(frontend_path, "js")), name="js")
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_path, "assets")), name="assets")

@app.on_event("startup")
def on_startup():
    verify_connection()

@app.get("/", include_in_schema=False)
def serve_root():
    index_path = os.path.join(frontend_path, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)
    raise HTTPException(status_code=404, detail="Not found")

# Ruta para servir HTML files
@app.get("/{path:path}", tags=["Frontend"])
def serve_frontend(path: str):
    """Serve frontend files from the frontend directory"""
    file_path = os.path.join(frontend_path, path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    # Si no existe el archivo, servir index.html para SPA routing
    index_path = os.path.join(frontend_path, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)
    raise HTTPException(status_code=404, detail="Not found")


# ══════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════

class RegisterRequest(BaseModel):
    email:     EmailStr
    password:  str
    rol:       str
    nombre:    str
    apellidos: str

    @field_validator("password")
    @classmethod
    def pw_min_length(cls, v):
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        return v

    @field_validator("rol")
    @classmethod
    def rol_valido(cls, v):
        if v not in ["medico", "paciente", "admin"]:
            raise ValueError("Rol inválido")
        return v


class LoginRequest(BaseModel):
    email:    EmailStr
    password: str
    role:     Optional[str] = None


class UserPublic(BaseModel):
    id:        int
    perfil_id: int        # ← ID real del paciente/médico
    email:     str
    rol:       str
    nombre:    str
    apellidos: str
    model_config = {"from_attributes": True}

class TokenResponse(BaseModel):
    access_token: str
    token_type:   str
    user:         UserPublic


# ── Perfil paciente ──────────────────────────

class PerfilOut(BaseModel):
    id:               int
    nombre:           str
    apellidos:        str
    fecha_nacimiento: Optional[date]
    sexo:             Optional[str]
    curp:             Optional[str]
    telefono:         Optional[str]
    tipo_diabetes:    Optional[str]
    anios_diagnostico:Optional[int]
    hba1c:            Optional[Decimal]
    grupo_estudio:    Optional[str]
    consentimiento:   bool
    verificado:       bool
    model_config = {"from_attributes": True}


class PerfilUpdate(BaseModel):
    nombre:            Optional[str]   = None
    apellidos:         Optional[str]   = None
    fecha_nacimiento:  Optional[date]  = None
    sexo:              Optional[str]   = None
    curp:              Optional[str]   = None
    telefono:          Optional[str]   = None
    tipo_diabetes:     Optional[str]   = None
    anios_diagnostico: Optional[int]   = None
    hba1c:             Optional[Decimal] = None
    grupo_estudio:     Optional[str]   = None


# ── Registros diarios ────────────────────────

class RegistroIn(BaseModel):
    fecha:            Optional[str]   = None   # YYYY-MM-DD, default hoy
    glucosa_valor:    float
    glucosa_momento:  str
    dolor_intensidad: int
    notas:            Optional[str]   = None
    localizaciones:   List[str]       = []
    sintomas:         List[str]       = []


class RegistroOut(BaseModel):
    id:               int
    fecha:            date
    glucosa_valor:    Optional[Decimal]
    glucosa_momento:  Optional[str]
    dolor_intensidad: Optional[int]
    notas:            Optional[str]
    estado:           str
    created_at:       datetime
    localizaciones:   List[str] = []
    sintomas:         List[str] = []
    model_config = {"from_attributes": True}


# ── Alertas ──────────────────────────────────

class AlertaOut(BaseModel):
    id:          int
    tipo:        str
    descripcion: str
    resuelta:    bool
    created_at:  datetime
    model_config = {"from_attributes": True}


# ── Comorbilidades y Medicamentos ────────────

class ComorbOut(BaseModel):
    id:     int
    nombre: str
    activa: bool
    model_config = {"from_attributes": True}

class ComorbIn(BaseModel):
    nombre: str

class MedOut(BaseModel):
    id:        int
    nombre:    str
    dosis:     Optional[str]
    frecuencia:Optional[str]
    activo:    bool
    model_config = {"from_attributes": True}

class MedIn(BaseModel):
    nombre:    str
    dosis:     Optional[str] = None
    frecuencia:Optional[str] = None


# ══════════════════════════════════════════════
# UTILIDADES
# ══════════════════════════════════════════════

def hash_password(p: str) -> str:       return pwd_context.hash(p)
def verify_password(p: str, h: str) -> bool: return pwd_context.verify(p, h)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db:    Session = Depends(get_db)
) -> Usuario:
    exc = HTTPException(status_code=401, detail="Token inválido o expirado",
                        headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
        if user_id is None: raise exc
    except JWTError:
        raise exc
    user = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not user: raise exc
    return user


def build_user_public(usuario: Usuario, perfil) -> UserPublic:
    return UserPublic(
        id=usuario.id,
        perfil_id=perfil.id if perfil else 0,   # ← agrega esta línea
        email=usuario.email,
        rol=usuario.rol.value,
        nombre=perfil.nombre if perfil else "",
        apellidos=perfil.apellidos if perfil else "",
    )


def get_paciente_or_404(paciente_id: int, db: Session) -> Paciente:
    p = db.query(Paciente).filter(Paciente.id == paciente_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    return p


# ══════════════════════════════════════════════
# RUTAS — General
# ══════════════════════════════════════════════

@app.get("/", tags=["General"])
def root():
    return {"app": "NeuroDia API", "version": "2.0.0", "status": "running", "docs": "/docs"}

@app.get("/health", tags=["General"])
def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


# ══════════════════════════════════════════════
# RUTAS — Autenticación
# ══════════════════════════════════════════════

@app.post("/auth/register", response_model=TokenResponse, status_code=201, tags=["Autenticación"])
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(Usuario).filter(Usuario.email == data.email).first():
        raise HTTPException(409, "Este correo ya está registrado.")

    usuario = Usuario(email=data.email, password_hash=hash_password(data.password), rol=RolEnum(data.rol))
    db.add(usuario)
    db.flush()

    perfil = None
    if data.rol == "medico":
        perfil = Medico(usuario_id=usuario.id, nombre=data.nombre, apellidos=data.apellidos)
        db.add(perfil)
    elif data.rol == "paciente":
        perfil = Paciente(usuario_id=usuario.id, nombre=data.nombre, apellidos=data.apellidos, consentimiento=False)
        db.add(perfil)

    db.commit()
    db.refresh(usuario)
    token = create_access_token({"sub": str(usuario.id), "rol": data.rol})
    return TokenResponse(access_token=token, token_type="bearer", user=build_user_public(usuario, perfil))


@app.post("/auth/login", response_model=TokenResponse, tags=["Autenticación"])
def login(creds: LoginRequest, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.email == creds.email).first()
    if not usuario or not verify_password(creds.password, usuario.password_hash):
        raise HTTPException(401, "Correo o contraseña incorrectos.")
    if creds.role and creds.role != usuario.rol.value:
        raise HTTPException(403, f"Esta cuenta no tiene acceso como '{creds.role}'.")

    perfil = usuario.medico or usuario.paciente
    token = create_access_token({"sub": str(usuario.id), "rol": usuario.rol.value})
    return TokenResponse(access_token=token, token_type="bearer", user=build_user_public(usuario, perfil))


@app.get("/auth/me", response_model=UserPublic, tags=["Autenticación"])
def get_me(current_user: Usuario = Depends(get_current_user)):
    perfil = current_user.medico or current_user.paciente
    return build_user_public(current_user, perfil)


# ══════════════════════════════════════════════
# RUTAS — Perfil del paciente
# ══════════════════════════════════════════════

@app.get("/pacientes/{paciente_id}/perfil", response_model=PerfilOut, tags=["Pacientes"])
def get_perfil(
    paciente_id: int,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user)
):
    return get_paciente_or_404(paciente_id, db)


@app.patch("/pacientes/{paciente_id}/perfil", response_model=PerfilOut, tags=["Pacientes"])
def update_perfil(
    paciente_id: int,
    data: PerfilUpdate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user)
):
    paciente = get_paciente_or_404(paciente_id, db)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(paciente, field, value)
    db.commit()
    db.refresh(paciente)
    return paciente


# ══════════════════════════════════════════════
# RUTAS — Registros diarios
# ══════════════════════════════════════════════

@app.get("/pacientes/{paciente_id}/registros", response_model=List[RegistroOut], tags=["Registros"])
def get_registros(
    paciente_id: int,
    limit: int = Query(14, ge=1, le=90),
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user)
):
    get_paciente_or_404(paciente_id, db)
    registros = (
        db.query(RegistroDiario)
        .filter(RegistroDiario.paciente_id == paciente_id)
        .order_by(RegistroDiario.fecha.desc())
        .limit(limit)
        .all()
    )

    result = []
    for r in registros:
        result.append(RegistroOut(
            id=r.id,
            fecha=r.fecha,
            glucosa_valor=r.glucosa_valor,
            glucosa_momento=r.glucosa_momento.value if r.glucosa_momento else None,
            dolor_intensidad=r.dolor_intensidad,
            notas=r.notas,
            estado=r.estado.value,
            created_at=r.created_at,
            localizaciones=[dl.zona for dl in r.dolor_localizaciones],
            sintomas=[s.sintoma for s in r.sintomas],
        ))
    return result


@app.post("/pacientes/{paciente_id}/registros", response_model=RegistroOut, status_code=201, tags=["Registros"])
def create_registro(
    paciente_id: int,
    data: RegistroIn,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user)
):
    get_paciente_or_404(paciente_id, db)

    fecha = date.fromisoformat(data.fecha) if data.fecha else date.today()

    # Si ya existe registro del día, actualizar en lugar de duplicar
    existente = (
        db.query(RegistroDiario)
        .filter(RegistroDiario.paciente_id == paciente_id, RegistroDiario.fecha == fecha)
        .first()
    )
    if existente:
        raise HTTPException(409, "Ya existe un registro para esta fecha. Solo se permite uno por día.")

    registro = RegistroDiario(
        paciente_id      = paciente_id,
        fecha            = fecha,
        glucosa_valor    = data.glucosa_valor,
        glucosa_momento  = MomentoGlucosaEnum(data.glucosa_momento),
        dolor_intensidad = data.dolor_intensidad,
        notas            = data.notas,
        estado           = EstadoRegistroEnum.completo,
    )
    db.add(registro)
    db.flush()

    for zona in data.localizaciones:
        db.add(DolorLocalizacion(registro_id=registro.id, zona=zona))
    for sintoma in data.sintomas:
        db.add(SintomaRegistro(registro_id=registro.id, sintoma=sintoma))

    # Generar alertas automáticas
    _generar_alertas(paciente_id, data, registro.id, db)

    db.commit()
    db.refresh(registro)

    return RegistroOut(
        id=registro.id, fecha=registro.fecha,
        glucosa_valor=registro.glucosa_valor,
        glucosa_momento=registro.glucosa_momento.value if registro.glucosa_momento else None,
        dolor_intensidad=registro.dolor_intensidad,
        notas=registro.notas, estado=registro.estado.value,
        created_at=registro.created_at,
        localizaciones=data.localizaciones,
        sintomas=data.sintomas,
    )


def _generar_alertas(paciente_id: int, data: RegistroIn, registro_id: int, db: Session):
    """Crea alertas automáticas según umbrales clínicos."""
    paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()
    medico_id = paciente.medico_id if paciente and paciente.medico_id else None
    if not medico_id:
        return  # Sin médico asignado, no se generan alertas

    alertas = []
    g = data.glucosa_valor
    d = data.dolor_intensidad

    if g > 250:
        alertas.append(Alerta(paciente_id=paciente_id, medico_id=medico_id,
            tipo="glucosa_alta",
            descripcion=f"Glucosa muy elevada: {g} mg/dL (umbral >250). Requiere atención."))
    elif g > 180:
        alertas.append(Alerta(paciente_id=paciente_id, medico_id=medico_id,
            tipo="glucosa_alta",
            descripcion=f"Glucosa elevada: {g} mg/dL (>180 mg/dL)."))
    elif g < 70:
        alertas.append(Alerta(paciente_id=paciente_id, medico_id=medico_id,
            tipo="glucosa_baja",
            descripcion=f"Hipoglucemia detectada: {g} mg/dL (<70 mg/dL)."))

    if d >= 8:
        alertas.append(Alerta(paciente_id=paciente_id, medico_id=medico_id,
            tipo="dolor_severo",
            descripcion=f"Dolor neuropático severo reportado: {d}/10."))

    for a in alertas:
        db.add(a)


# ══════════════════════════════════════════════
# RUTAS — Alertas
# ══════════════════════════════════════════════

@app.get("/pacientes/{paciente_id}/alertas", response_model=List[AlertaOut], tags=["Alertas"])
def get_alertas(
    paciente_id: int,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user)
):
    get_paciente_or_404(paciente_id, db)
    return (
        db.query(Alerta)
        .filter(Alerta.paciente_id == paciente_id)
        .order_by(Alerta.created_at.desc())
        .limit(20)
        .all()
    )


@app.patch("/alertas/{alerta_id}/resolver", tags=["Alertas"])
def resolver_alerta(
    alerta_id: int,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user)
):
    alerta = db.query(Alerta).filter(Alerta.id == alerta_id).first()
    if not alerta:
        raise HTTPException(404, "Alerta no encontrada")
    alerta.resuelta = True
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════
# RUTAS — Comorbilidades
# ══════════════════════════════════════════════

@app.get("/pacientes/{paciente_id}/comorbilidades", response_model=List[ComorbOut], tags=["Pacientes"])
def get_comorbilidades(
    paciente_id: int,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user)
):
    get_paciente_or_404(paciente_id, db)
    return db.query(Comorbilidad).filter(Comorbilidad.paciente_id == paciente_id, Comorbilidad.activa == True).all()


@app.post("/pacientes/{paciente_id}/comorbilidades", response_model=ComorbOut, status_code=201, tags=["Pacientes"])
def add_comorbilidad(
    paciente_id: int,
    data: ComorbIn,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user)
):
    get_paciente_or_404(paciente_id, db)
    c = Comorbilidad(paciente_id=paciente_id, nombre=data.nombre)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@app.delete("/comorbilidades/{comorbilidad_id}", tags=["Pacientes"])
def delete_comorbilidad(
    comorbilidad_id: int,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user)
):
    c = db.query(Comorbilidad).filter(Comorbilidad.id == comorbilidad_id).first()
    if not c: raise HTTPException(404, "No encontrada")
    c.activa = False   # soft delete
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════
# RUTAS — Medicamentos
# ══════════════════════════════════════════════

@app.get("/pacientes/{paciente_id}/medicamentos", response_model=List[MedOut], tags=["Pacientes"])
def get_medicamentos(
    paciente_id: int,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user)
):
    get_paciente_or_404(paciente_id, db)
    return db.query(Medicamento).filter(Medicamento.paciente_id == paciente_id, Medicamento.activo == True).all()


@app.post("/pacientes/{paciente_id}/medicamentos", response_model=MedOut, status_code=201, tags=["Pacientes"])
def add_medicamento(
    paciente_id: int,
    data: MedIn,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user)
):
    get_paciente_or_404(paciente_id, db)
    m = Medicamento(paciente_id=paciente_id, nombre=data.nombre, dosis=data.dosis, frecuencia=data.frecuencia)
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@app.delete("/medicamentos/{medicamento_id}", tags=["Pacientes"])
def delete_medicamento(
    medicamento_id: int,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user)
):
    m = db.query(Medicamento).filter(Medicamento.id == medicamento_id).first()
    if not m: raise HTTPException(404, "No encontrado")
    m.activo = False   # soft delete
    db.commit()
    return {"ok": True}

# ══════════════════════════════════════════════
# RUTAS — Médico: dashboard y gestión
# ══════════════════════════════════════════════

class PacienteResumenOut(BaseModel):
    id:               int
    nombre:           str
    apellidos:        str
    tipo_diabetes:    Optional[str]
    hba1c:            Optional[Decimal]
    anios_diagnostico:Optional[int]
    verificado:       bool
    consentimiento:   bool
    ultima_glucosa:   Optional[Decimal] = None
    ultima_fecha:     Optional[date]    = None
    alertas_activas:  int               = 0
    model_config = {"from_attributes": True}


class DashboardMedicoOut(BaseModel):
    total_pacientes:     int
    pacientes_activos:   int
    alertas_pendientes:  int
    sin_registro_7dias:  int


class AltaPacienteIn(BaseModel):
    email:            EmailStr
    password:         str
    nombre:           str
    apellidos:        str
    tipo_diabetes:    Optional[str]  = "tipo_2"
    anios_diagnostico:Optional[int] = None
    hba1c:            Optional[Decimal] = None
    grupo_estudio:    Optional[str] = None
    consentimiento:   bool          = False

    @field_validator("password")
    @classmethod
    def pw_min(cls, v):
        if len(v) < 8:
            raise ValueError("Mínimo 8 caracteres")
        return v


def get_medico_or_403(current_user: Usuario) -> Medico:
    if current_user.rol.value != "medico":
        raise HTTPException(403, "Solo médicos pueden acceder a este recurso.")
    if not current_user.medico:
        raise HTTPException(404, "Perfil de médico no encontrado.")
    return current_user.medico


@app.get("/medico/dashboard", response_model=DashboardMedicoOut, tags=["Médico"])
def get_dashboard_medico(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    medico = get_medico_or_403(current_user)
    pacientes = db.query(Paciente).filter(Paciente.medico_id == medico.id).all()

    hace_7 = date.today().toordinal() - 7
    sin_registro = 0
    for p in pacientes:
        ultimo = (
            db.query(RegistroDiario)
            .filter(RegistroDiario.paciente_id == p.id)
            .order_by(RegistroDiario.fecha.desc())
            .first()
        )
        if not ultimo or ultimo.fecha.toordinal() < hace_7:
            sin_registro += 1

    alertas = db.query(Alerta).filter(
        Alerta.medico_id == medico.id, Alerta.resuelta == False
    ).count()

    return DashboardMedicoOut(
        total_pacientes    = len(pacientes),
        pacientes_activos  = len([p for p in pacientes if p.consentimiento]),
        alertas_pendientes = alertas,
        sin_registro_7dias = sin_registro,
    )


@app.get("/medico/pacientes", response_model=List[PacienteResumenOut], tags=["Médico"])
def get_mis_pacientes(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    medico = get_medico_or_403(current_user)
    pacientes = (
        db.query(Paciente)
        .filter(Paciente.medico_id == medico.id)
        .order_by(Paciente.created_at.desc())
        .all()
    )

    result = []
    for p in pacientes:
        ultimo = (
            db.query(RegistroDiario)
            .filter(RegistroDiario.paciente_id == p.id)
            .order_by(RegistroDiario.fecha.desc())
            .first()
        )
        alertas_n = db.query(Alerta).filter(
            Alerta.paciente_id == p.id, Alerta.resuelta == False
        ).count()
        result.append(PacienteResumenOut(
            id=p.id, nombre=p.nombre, apellidos=p.apellidos,
            tipo_diabetes=p.tipo_diabetes.value if p.tipo_diabetes else None,
            hba1c=p.hba1c, anios_diagnostico=p.anios_diagnostico,
            verificado=p.verificado, consentimiento=p.consentimiento,
            ultima_glucosa=ultimo.glucosa_valor if ultimo else None,
            ultima_fecha=ultimo.fecha if ultimo else None,
            alertas_activas=alertas_n,
        ))
    return result


@app.get("/medico/alertas", response_model=List[AlertaOut], tags=["Médico"])
def get_alertas_medico(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    medico = get_medico_or_403(current_user)
    return (
        db.query(Alerta)
        .filter(Alerta.medico_id == medico.id, Alerta.resuelta == False)
        .order_by(Alerta.created_at.desc())
        .limit(50)
        .all()
    )


@app.post("/medico/alta-paciente", response_model=PacienteResumenOut, status_code=201, tags=["Médico"])
def alta_paciente(
    data: AltaPacienteIn,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    medico = get_medico_or_403(current_user)

    if db.query(Usuario).filter(Usuario.email == data.email).first():
        raise HTTPException(409, "Este correo ya está registrado.")

    usuario = Usuario(
        email=data.email,
        password_hash=hash_password(data.password),
        rol=RolEnum.paciente
    )
    db.add(usuario)
    db.flush()

    from backend.models import DiabetesEnum
    paciente = Paciente(
        usuario_id        = usuario.id,
        medico_id         = medico.id,
        nombre            = data.nombre,
        apellidos         = data.apellidos,
        tipo_diabetes     = DiabetesEnum(data.tipo_diabetes) if data.tipo_diabetes else DiabetesEnum.tipo_2,
        anios_diagnostico = data.anios_diagnostico,
        hba1c             = data.hba1c,
        grupo_estudio     = data.grupo_estudio,
        consentimiento    = data.consentimiento,
        verificado        = True,   # el médico que da de alta ya verifica
    )
    db.add(paciente)
    db.commit()
    db.refresh(paciente)

    return PacienteResumenOut(
        id=paciente.id, nombre=paciente.nombre, apellidos=paciente.apellidos,
        tipo_diabetes=paciente.tipo_diabetes.value if paciente.tipo_diabetes else None,
        hba1c=paciente.hba1c, anios_diagnostico=paciente.anios_diagnostico,
        verificado=paciente.verificado, consentimiento=paciente.consentimiento,
        alertas_activas=0,
    )


@app.patch("/medico/pacientes/{paciente_id}/verificar", tags=["Médico"])
def verificar_paciente(
    paciente_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    medico = get_medico_or_403(current_user)
    paciente = db.query(Paciente).filter(
        Paciente.id == paciente_id,
        Paciente.medico_id == medico.id
    ).first()
    if not paciente:
        raise HTTPException(404, "Paciente no encontrado o no pertenece a este médico.")
    paciente.verificado = True
    db.commit()
    return {"ok": True, "verificado": True}


@app.get("/medico/pacientes/{paciente_id}/detalle", tags=["Médico"])
def get_paciente_detalle(
    paciente_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    medico = get_medico_or_403(current_user)
    p = db.query(Paciente).filter(
        Paciente.id == paciente_id,
        Paciente.medico_id == medico.id
    ).first()
    if not p:
        raise HTTPException(404, "Paciente no encontrado.")

    registros = (
        db.query(RegistroDiario)
        .filter(RegistroDiario.paciente_id == p.id)
        .order_by(RegistroDiario.fecha.desc())
        .limit(30)
        .all()
    )
    alertas = db.query(Alerta).filter(
        Alerta.paciente_id == p.id
    ).order_by(Alerta.created_at.desc()).limit(10).all()

    return {
        "paciente": {
            "id": p.id, "nombre": p.nombre, "apellidos": p.apellidos,
            "tipo_diabetes": p.tipo_diabetes.value if p.tipo_diabetes else None,
            "hba1c": float(p.hba1c) if p.hba1c else None,
            "anios_diagnostico": p.anios_diagnostico,
            "verificado": p.verificado, "consentimiento": p.consentimiento,
            "grupo_estudio": p.grupo_estudio,
            "comorbilidades": [c.nombre for c in p.comorbilidades if c.activa],
            "medicamentos": [{"nombre": m.nombre, "dosis": m.dosis} for m in p.medicamentos if m.activo],
        },
        "registros": [{
            "fecha": str(r.fecha),
            "glucosa_valor": float(r.glucosa_valor) if r.glucosa_valor else None,
            "glucosa_momento": r.glucosa_momento.value if r.glucosa_momento else None,
            "dolor_intensidad": r.dolor_intensidad,
            "estado": r.estado.value,
            "sintomas": [s.sintoma for s in r.sintomas],
        } for r in registros],
        "alertas": [{
            "id": a.id, "tipo": a.tipo.value,
            "descripcion": a.descripcion,
            "resuelta": a.resuelta,
            "created_at": a.created_at.isoformat(),
        } for a in alertas],
    }


# ── Vincular paciente por correo ─────────────────
class VincularPacienteIn(BaseModel):
    email: EmailStr

@app.post("/medico/vincular-paciente-simple", response_model=PacienteResumenOut, tags=["Médico"], include_in_schema=False)
def vincular_paciente(
    data: VincularPacienteIn,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    medico = get_medico_or_403(current_user)

    usuario = db.query(Usuario).filter(Usuario.email == data.email).first()
    if not usuario:
        raise HTTPException(404, "No existe ningún usuario con ese correo.")
    if usuario.rol.value != "paciente":
        raise HTTPException(400, "Ese correo no corresponde a una cuenta de paciente.")

    paciente = db.query(Paciente).filter(Paciente.usuario_id == usuario.id).first()
    if not paciente:
        raise HTTPException(404, "El usuario no tiene perfil de paciente.")
    if paciente.medico_id and paciente.medico_id != medico.id:
        raise HTTPException(409, "Este paciente ya está asignado a otro médico.")
    if paciente.medico_id == medico.id:
        raise HTTPException(409, "Este paciente ya está en tu panel.")

    paciente.medico_id = medico.id
    db.commit()
    db.refresh(paciente)

    alertas_n = db.query(Alerta).filter(Alerta.paciente_id == paciente.id, Alerta.resuelta == False).count()
    return PacienteResumenOut(
        id=paciente.id, nombre=paciente.nombre, apellidos=paciente.apellidos,
        tipo_diabetes=paciente.tipo_diabetes.value if paciente.tipo_diabetes else None,
        hba1c=paciente.hba1c, anios_diagnostico=paciente.anios_diagnostico,
        verificado=paciente.verificado, consentimiento=paciente.consentimiento,
        alertas_activas=alertas_n,
    )


# ── Buscar paciente por correo (para precargar formulario) ─────
class PacienteBusquedaOut(BaseModel):
    usuario_id:       int
    paciente_id:      Optional[int]   # None si aún no tiene perfil de paciente
    email:            str
    nombre:           str
    apellidos:        str
    tipo_diabetes:    Optional[str]   = None
    anios_diagnostico:Optional[int]   = None
    hba1c:            Optional[Decimal] = None
    grupo_estudio:    Optional[str]   = None
    consentimiento:   bool            = False
    ya_asignado:      bool            = False  # True si ya es paciente de este médico

@app.get("/medico/buscar-paciente", response_model=PacienteBusquedaOut, tags=["Médico"])
def buscar_paciente_por_correo(
    email: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    medico = get_medico_or_403(current_user)

    usuario = db.query(Usuario).filter(Usuario.email == email).first()
    if not usuario:
        raise HTTPException(404, "No existe ningún usuario con ese correo.")
    if usuario.rol.value != "paciente":
        raise HTTPException(400, "Ese correo no corresponde a una cuenta de paciente.")

    paciente = db.query(Paciente).filter(Paciente.usuario_id == usuario.id).first()

    if paciente and paciente.medico_id and paciente.medico_id != medico.id:
        raise HTTPException(409, "Este paciente ya está asignado a otro médico.")

    return PacienteBusquedaOut(
        usuario_id        = usuario.id,
        paciente_id       = paciente.id if paciente else None,
        email             = usuario.email,
        nombre            = paciente.nombre if paciente else "",
        apellidos         = paciente.apellidos if paciente else "",
        tipo_diabetes     = paciente.tipo_diabetes.value if paciente and paciente.tipo_diabetes else None,
        anios_diagnostico = paciente.anios_diagnostico if paciente else None,
        hba1c             = paciente.hba1c if paciente else None,
        grupo_estudio     = paciente.grupo_estudio if paciente else None,
        consentimiento    = paciente.consentimiento if paciente else False,
        ya_asignado       = paciente.medico_id == medico.id if paciente else False,
    )


# ── Vincular + actualizar datos clínicos ──────────────────────
class VincularConDatosIn(BaseModel):
    email:            EmailStr
    tipo_diabetes:    Optional[str]    = None
    anios_diagnostico:Optional[int]    = None
    hba1c:            Optional[Decimal] = None
    grupo_estudio:    Optional[str]    = None
    consentimiento:   bool             = False

@app.post("/medico/vincular-paciente", response_model=PacienteResumenOut, tags=["Médico"])
def vincular_paciente(
    data: VincularConDatosIn,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    medico = get_medico_or_403(current_user)

    usuario = db.query(Usuario).filter(Usuario.email == data.email).first()
    if not usuario:
        raise HTTPException(404, "No existe ningún usuario con ese correo.")
    if usuario.rol.value != "paciente":
        raise HTTPException(400, "Ese correo no corresponde a una cuenta de paciente.")

    paciente = db.query(Paciente).filter(Paciente.usuario_id == usuario.id).first()
    if not paciente:
        raise HTTPException(404, "El usuario no tiene perfil de paciente.")
    if paciente.medico_id and paciente.medico_id != medico.id:
        raise HTTPException(409, "Este paciente ya está asignado a otro médico.")

    # Asignar médico y actualizar datos clínicos
    paciente.medico_id = medico.id
    if data.tipo_diabetes:
        from backend.models import DiabetesEnum
        paciente.tipo_diabetes = DiabetesEnum(data.tipo_diabetes)
    if data.anios_diagnostico is not None:
        paciente.anios_diagnostico = data.anios_diagnostico
    if data.hba1c is not None:
        paciente.hba1c = data.hba1c
    if data.grupo_estudio:
        paciente.grupo_estudio = data.grupo_estudio
    paciente.consentimiento = data.consentimiento

    db.commit()
    db.refresh(paciente)

    alertas_n = db.query(Alerta).filter(Alerta.paciente_id == paciente.id, Alerta.resuelta == False).count()
    return PacienteResumenOut(
        id=paciente.id, nombre=paciente.nombre, apellidos=paciente.apellidos,
        tipo_diabetes=paciente.tipo_diabetes.value if paciente.tipo_diabetes else None,
        hba1c=paciente.hba1c, anios_diagnostico=paciente.anios_diagnostico,
        verificado=paciente.verificado, consentimiento=paciente.consentimiento,
        alertas_activas=alertas_n,
    )
