"""
NeuroDia — database.py
Conexión a MySQL con SQLAlchemy.

Requiere un archivo .env en la raíz del proyecto con:
    DB_HOST=localhost
    DB_PORT=3306
    DB_NAME=neurodia
    DB_USER=root
    DB_PASSWORD=tu_contraseña
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.exc import OperationalError
import os

# ── Leer variables de entorno ──────────────────────────────────
# Instalar: pip install python-dotenv
# y crear archivo .env en la carpeta del proyecto
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # Si no tienen python-dotenv, usan variables del sistema

DB_HOST     = os.getenv("DB_HOST",     "localhost")
DB_PORT     = os.getenv("DB_PORT",     "3306")
DB_NAME     = os.getenv("DB_NAME",     "neurodia")
DB_USER     = os.getenv("DB_USER",     "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

# ── URL de conexión ────────────────────────────────────────────
# Formato: mysql+pymysql://usuario:contraseña@host:puerto/basededatos
DATABASE_URL = (
    f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}"
    f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    f"?charset=utf8mb4"
)

# ── Engine ─────────────────────────────────────────────────────
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,      # verifica la conexión antes de usarla
    pool_size=5,             # conexiones simultáneas máximas
    max_overflow=10,         # conexiones extra si se satura el pool
    echo=False,              # True para ver el SQL en consola (debug)
)

# ── Session factory ────────────────────────────────────────────
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# ── Base para los modelos ORM ──────────────────────────────────
class Base(DeclarativeBase):
    pass


# ── Dependencia para FastAPI (inyección en rutas) ──────────────
def get_db():
    """
    Genera una sesión de BD por cada request y la cierra al terminar.
    Uso en rutas FastAPI:
        db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Verificar conexión al arrancar ─────────────────────────────
def verify_connection():
    """Llamar desde main.py al iniciar la app para confirmar que la BD está accesible."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("OK Conexion a MySQL exitosa - base de datos: neurodia")
        return True
    except OperationalError as e:
        print(f"ERROR conectando a MySQL: {e}")
        print("  Verifica que MySQL esté corriendo y que el archivo .env sea correcto.")
        return False
