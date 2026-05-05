"""
NeuroDia — main.py
Ejecutar: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException, Depends, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
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

@app.on_event("startup")
def on_startup():
    verify_connection()


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
    token = create_access_token({"sub": usuario.id, "rol": data.rol})
    return TokenResponse(access_token=token, token_type="bearer", user=build_user_public(usuario, perfil))


@app.post("/auth/login", response_model=TokenResponse, tags=["Autenticación"])
def login(creds: LoginRequest, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.email == creds.email).first()
    if not usuario or not verify_password(creds.password, usuario.password_hash):
        raise HTTPException(401, "Correo o contraseña incorrectos.")
    if creds.role and creds.role != usuario.rol.value:
        raise HTTPException(403, f"Esta cuenta no tiene acceso como '{creds.role}'.")

    perfil = usuario.medico or usuario.paciente
    token  = create_access_token({"sub": usuario.id, "rol": usuario.rol.value})
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