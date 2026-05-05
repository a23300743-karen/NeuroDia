"""
NeuroDia — models.py
Modelos ORM de SQLAlchemy que mapean exactamente
a las tablas del neurodia.sql
"""

from sqlalchemy import (
    Column, Integer, String, Boolean, Date, DateTime, Time,
    Text, Enum, ForeignKey, DECIMAL, SmallInteger,
    UniqueConstraint, func
)
from sqlalchemy.orm import relationship
from backend.database import Base
import enum


# ── Enums Python (coinciden con los ENUM de MySQL) ─────────────

class RolEnum(str, enum.Enum):
    medico   = "medico"
    paciente = "paciente"
    admin    = "admin"

class SexoEnum(str, enum.Enum):
    masculino = "masculino"
    femenino  = "femenino"
    otro      = "otro"

class DiabetesEnum(str, enum.Enum):
    tipo_1      = "tipo_1"
    tipo_2      = "tipo_2"
    gestacional = "gestacional"
    otro        = "otro"

class MomentoGlucosaEnum(str, enum.Enum):
    ayunas       = "ayunas"
    postprandial = "postprandial"
    nocturno     = "nocturno"

class EstadoRegistroEnum(str, enum.Enum):
    completo   = "completo"
    incompleto = "incompleto"
    pendiente  = "pendiente"

class TipoAlertaEnum(str, enum.Enum):
    glucosa_alta    = "glucosa_alta"
    glucosa_baja    = "glucosa_baja"
    dolor_severo    = "dolor_severo"
    baja_adherencia = "baja_adherencia"
    otro            = "otro"


# ══════════════════════════════════════════════════════════════
# MODELOS
# ══════════════════════════════════════════════════════════════

class Usuario(Base):
    __tablename__ = "usuarios"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    email         = Column(String(120), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    rol           = Column(Enum(RolEnum), nullable=False)
    created_at    = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at    = Column(DateTime, server_default=func.now(),
                           onupdate=func.now(), nullable=False)

    # Relaciones (uno a uno)
    medico   = relationship("Medico",   back_populates="usuario", uselist=False)
    paciente = relationship("Paciente", back_populates="usuario", uselist=False)

    def __repr__(self):
        return f"<Usuario id={self.id} email={self.email} rol={self.rol}>"


class Medico(Base):
    __tablename__ = "medicos"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    usuario_id   = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    nombre       = Column(String(80), nullable=False)
    apellidos    = Column(String(80), nullable=False)
    especialidad = Column(String(120), nullable=True)
    created_at   = Column(DateTime, server_default=func.now(), nullable=False)

    # Relaciones
    usuario   = relationship("Usuario",  back_populates="medico")
    pacientes = relationship("Paciente", back_populates="medico")
    alertas   = relationship("Alerta",   back_populates="medico")

    def __repr__(self):
        return f"<Medico id={self.id} nombre={self.nombre} {self.apellidos}>"


class Paciente(Base):
    __tablename__ = "pacientes"

    id                = Column(Integer, primary_key=True, autoincrement=True)
    usuario_id        = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    medico_id         = Column(Integer, ForeignKey("medicos.id",  ondelete="SET NULL"), nullable=True)
    nombre            = Column(String(80), nullable=False)
    apellidos         = Column(String(80), nullable=False)
    fecha_nacimiento  = Column(Date, nullable=True)
    sexo              = Column(Enum(SexoEnum), nullable=True)
    curp              = Column(String(18), nullable=True, unique=True)
    telefono          = Column(String(20), nullable=True)
    tipo_diabetes     = Column(Enum(DiabetesEnum), nullable=True, default=DiabetesEnum.tipo_2)
    anios_diagnostico = Column(Integer, nullable=True)
    hba1c             = Column(DECIMAL(4, 1), nullable=True)
    grupo_estudio     = Column(String(50), nullable=True)
    consentimiento    = Column(Boolean, nullable=False, default=False)
    created_at        = Column(DateTime, server_default=func.now(), nullable=False)

    # Relaciones
    usuario            = relationship("Usuario",          back_populates="paciente")
    medico             = relationship("Medico",           back_populates="pacientes")
    comorbilidades     = relationship("Comorbilidad",     back_populates="paciente", cascade="all, delete-orphan")
    medicamentos       = relationship("Medicamento",      back_populates="paciente", cascade="all, delete-orphan")
    registros_diarios  = relationship("RegistroDiario",   back_populates="paciente", cascade="all, delete-orphan")
    alertas            = relationship("Alerta",           back_populates="paciente", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Paciente id={self.id} nombre={self.nombre} {self.apellidos}>"


class Comorbilidad(Base):
    __tablename__ = "comorbilidades"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    paciente_id = Column(Integer, ForeignKey("pacientes.id", ondelete="CASCADE"), nullable=False)
    nombre      = Column(String(120), nullable=False)
    activa      = Column(Boolean, nullable=False, default=True)

    paciente = relationship("Paciente", back_populates="comorbilidades")


class Medicamento(Base):
    __tablename__ = "medicamentos"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    paciente_id = Column(Integer, ForeignKey("pacientes.id", ondelete="CASCADE"), nullable=False)
    nombre      = Column(String(120), nullable=False)
    dosis       = Column(String(80),  nullable=True)
    frecuencia  = Column(String(80),  nullable=True)
    activo      = Column(Boolean, nullable=False, default=True)

    paciente      = relationship("Paciente",      back_populates="medicamentos")
    dosis_registro = relationship("DosisRegistro", back_populates="medicamento", cascade="all, delete-orphan")


class RegistroDiario(Base):
    __tablename__ = "registros_diarios"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    paciente_id      = Column(Integer, ForeignKey("pacientes.id", ondelete="CASCADE"), nullable=False)
    fecha            = Column(Date, nullable=False)
    glucosa_valor    = Column(DECIMAL(5, 1), nullable=True)
    glucosa_momento  = Column(Enum(MomentoGlucosaEnum), nullable=True)
    dolor_intensidad = Column(SmallInteger, nullable=True)
    notas            = Column(Text, nullable=True)
    estado           = Column(Enum(EstadoRegistroEnum), nullable=False, default=EstadoRegistroEnum.pendiente)
    created_at       = Column(DateTime, server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("paciente_id", "fecha", name="uq_registro_fecha"),
    )

    paciente             = relationship("Paciente",          back_populates="registros_diarios")
    dolor_localizaciones = relationship("DolorLocalizacion", back_populates="registro", cascade="all, delete-orphan")
    sintomas             = relationship("SintomaRegistro",   back_populates="registro", cascade="all, delete-orphan")
    dosis                = relationship("DosisRegistro",     back_populates="registro", cascade="all, delete-orphan")


class DolorLocalizacion(Base):
    __tablename__ = "dolor_localizaciones"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    registro_id = Column(Integer, ForeignKey("registros_diarios.id", ondelete="CASCADE"), nullable=False)
    zona        = Column(String(80), nullable=False)

    registro = relationship("RegistroDiario", back_populates="dolor_localizaciones")


class SintomaRegistro(Base):
    __tablename__ = "sintomas_registro"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    registro_id = Column(Integer, ForeignKey("registros_diarios.id", ondelete="CASCADE"), nullable=False)
    sintoma     = Column(String(120), nullable=False)

    registro = relationship("RegistroDiario", back_populates="sintomas")


class DosisRegistro(Base):
    __tablename__ = "dosis_registro"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    registro_id    = Column(Integer, ForeignKey("registros_diarios.id", ondelete="CASCADE"), nullable=False)
    medicamento_id = Column(Integer, ForeignKey("medicamentos.id",     ondelete="CASCADE"), nullable=False)
    tomada         = Column(Boolean, nullable=False, default=False)
    turno          = Column(String(40), nullable=True)
    hora_registro  = Column(Time, nullable=True)

    registro    = relationship("RegistroDiario", back_populates="dosis")
    medicamento = relationship("Medicamento",    back_populates="dosis_registro")


class Alerta(Base):
    __tablename__ = "alertas"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    paciente_id = Column(Integer, ForeignKey("pacientes.id", ondelete="CASCADE"), nullable=False)
    medico_id   = Column(Integer, ForeignKey("medicos.id",   ondelete="CASCADE"), nullable=False)
    tipo        = Column(Enum(TipoAlertaEnum), nullable=False)
    descripcion = Column(Text, nullable=False)
    resuelta    = Column(Boolean, nullable=False, default=False)
    created_at  = Column(DateTime, server_default=func.now(), nullable=False)

    paciente = relationship("Paciente", back_populates="alertas")
    medico   = relationship("Medico",   back_populates="alertas")
