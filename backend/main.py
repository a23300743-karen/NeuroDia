"""
NeuroDia — main.py  (v2 — conectado a MySQL)
Reemplaza la versión anterior que usaba fake_users_db.

Ejecutar:
    uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr, field_validator
from passlib.context import CryptContext
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional


from database import get_db, verify_connection
from models import Usuario, Medico, Paciente, RolEnum

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
# SCHEMAS PYDANTIC
# ══════════════════════════════════════════════

class RegisterRequest(BaseModel):
    email:     EmailStr
    password:  str
    rol:       str
    nombre:    str
    apellidos: str
    cedula:    Optional[str] = None

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
            raise ValueError("Rol inválido. Opciones: medico, paciente, admin")
        return v


class LoginRequest(BaseModel):
    email:    EmailStr
    password: str
    role:     Optional[str] = None


class UserPublic(BaseModel):
    id:        int
    email:     str
    rol:       str
    nombre:    str
    apellidos: str

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str
    user:         UserPublic


# ══════════════════════════════════════════════
# UTILIDADES
# ══════════════════════════════════════════════

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db:    Session = Depends(get_db)
) -> Usuario:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(Usuario).filter(Usuario.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user


def _build_user_public(usuario: Usuario, perfil) -> UserPublic:
    return UserPublic(
        id        = usuario.id,
        email     = usuario.email,
        rol       = usuario.rol.value,
        nombre    = perfil.nombre    if perfil else "",
        apellidos = perfil.apellidos if perfil else "",
    )


# ══════════════════════════════════════════════
# RUTAS — Autenticación
# ══════════════════════════════════════════════

@app.post(
    "/auth/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar nuevo usuario",
    tags=["Autenticación"]
)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(Usuario).filter(Usuario.email == data.email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este correo ya está registrado."
        )

    nuevo_usuario = Usuario(
        email         = data.email,
        password_hash = hash_password(data.password),
        rol           = RolEnum(data.rol),
    )
    db.add(nuevo_usuario)
    db.flush()

    perfil = None
    if data.rol == "medico":
        perfil = Medico(
            usuario_id = nuevo_usuario.id,
            nombre     = data.nombre,
            apellidos  = data.apellidos,
        )
        db.add(perfil)
    elif data.rol == "paciente":
        perfil = Paciente(
            usuario_id     = nuevo_usuario.id,
            nombre         = data.nombre,
            apellidos      = data.apellidos,
            consentimiento = False,
        )
        db.add(perfil)

    db.commit()
    db.refresh(nuevo_usuario)

    token = create_access_token({"sub": nuevo_usuario.id, "rol": data.rol})

    return TokenResponse(
        access_token = token,
        token_type   = "bearer",
        user         = _build_user_public(nuevo_usuario, perfil)
    )


@app.post(
    "/auth/login",
    response_model=TokenResponse,
    summary="Iniciar sesión",
    tags=["Autenticación"]
)
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.email == credentials.email).first()

    if not usuario or not verify_password(credentials.password, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos."
        )

    if credentials.role and credentials.role != usuario.rol.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Esta cuenta no tiene acceso como '{credentials.role}'."
        )

    perfil = usuario.medico or usuario.paciente
    token  = create_access_token({"sub": usuario.id, "rol": usuario.rol.value})

    return TokenResponse(
        access_token = token,
        token_type   = "bearer",
        user         = _build_user_public(usuario, perfil)
    )


@app.get(
    "/auth/me",
    response_model=UserPublic,
    summary="Obtener usuario actual",
    tags=["Autenticación"]
)
def get_me(current_user: Usuario = Depends(get_current_user)):
    perfil = current_user.medico or current_user.paciente
    return _build_user_public(current_user, perfil)


@app.get("/", tags=["General"])
def root():
    return {"app": "NeuroDia API", "version": "2.0.0", "status": "running", "docs": "/docs"}

@app.get("/health", tags=["General"])
def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}

# Rutas futuras Sprint 2+:
# POST /pacientes/{id}/registros   → US-03, 04, 05
# GET  /pacientes/{id}/registros   → US-08
# GET  /medicos/{id}/dashboard     → US-02, 09
# POST /alertas/generar            → alertas automáticas
# GET  /pacientes/{id}/reporte     → US-10
