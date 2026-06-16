-- ═══════════════════════════════════════════════════════════════
-- NeuroDia — neurodia.sql
-- Base de datos MySQL para sistema de monitoreo de neuropatías
-- CETI Grupo 6E | Sprint 1
--
-- Ejecutar:
--   mysql -u root -p < neurodia.sql
-- ═══════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS neurodia
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE neurodia;

-- ──────────────────────────────────────────────
-- 1. USUARIOS  (tabla base de autenticación)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
    id            INT           NOT NULL AUTO_INCREMENT,
    email         VARCHAR(120)  NOT NULL UNIQUE,
    password_hash VARCHAR(255)  NOT NULL,
    rol           ENUM('medico','paciente','admin') NOT NULL,
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_usuarios_email (email),
    INDEX idx_usuarios_rol   (rol)
) ENGINE=InnoDB;


-- ──────────────────────────────────────────────
-- 2. MEDICOS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medicos (
    id           INT          NOT NULL AUTO_INCREMENT,
    usuario_id   INT          NOT NULL,
    nombre       VARCHAR(80)  NOT NULL,
    apellidos    VARCHAR(80)  NOT NULL,
    especialidad VARCHAR(120) DEFAULT NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_medicos_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_medicos_usuario (usuario_id)
) ENGINE=InnoDB;


-- ──────────────────────────────────────────────
-- 3. PACIENTES
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pacientes (
    id                      INT           NOT NULL AUTO_INCREMENT,
    usuario_id              INT           NOT NULL,
    medico_id               INT           DEFAULT NULL,
    nombre                  VARCHAR(80)   NOT NULL,
    apellidos               VARCHAR(80)   NOT NULL,
    fecha_nacimiento        DATE          DEFAULT NULL,
    sexo                    ENUM('masculino','femenino','otro') DEFAULT NULL,
    curp                    VARCHAR(18)   DEFAULT NULL UNIQUE,
    telefono                VARCHAR(20)   DEFAULT NULL,
    tipo_diabetes           ENUM('tipo_1','tipo_2','gestacional','otro') DEFAULT 'tipo_2',
    anios_diagnostico       INT           DEFAULT NULL,
    hba1c                   DECIMAL(4,1)  DEFAULT NULL,
    grupo_estudio           VARCHAR(50)   DEFAULT NULL,
    consentimiento          BOOLEAN       NOT NULL DEFAULT FALSE,
    verificado              BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_pacientes_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_pacientes_medico
        FOREIGN KEY (medico_id) REFERENCES medicos(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_pacientes_usuario (usuario_id),
    INDEX idx_pacientes_medico  (medico_id)
) ENGINE=InnoDB;


-- ──────────────────────────────────────────────
-- 4. COMORBILIDADES
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comorbilidades (
    id          INT          NOT NULL AUTO_INCREMENT,
    paciente_id INT          NOT NULL,
    nombre      VARCHAR(120) NOT NULL,
    activa      BOOLEAN      NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    CONSTRAINT fk_comorbilidades_paciente
        FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_comorbilidades_paciente (paciente_id)
) ENGINE=InnoDB;


-- ──────────────────────────────────────────────
-- 5. MEDICAMENTOS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medicamentos (
    id          INT          NOT NULL AUTO_INCREMENT,
    paciente_id INT          NOT NULL,
    nombre      VARCHAR(120) NOT NULL,
    dosis       VARCHAR(80)  DEFAULT NULL,
    frecuencia  VARCHAR(80)  DEFAULT NULL,
    activo      BOOLEAN      NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    CONSTRAINT fk_medicamentos_paciente
        FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_medicamentos_paciente (paciente_id)
) ENGINE=InnoDB;


-- ──────────────────────────────────────────────
-- 6. REGISTROS_DIARIOS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registros_diarios (
    id               INT           NOT NULL AUTO_INCREMENT,
    paciente_id      INT           NOT NULL,
    fecha            DATE          NOT NULL,
    glucosa_valor    DECIMAL(5,1)  DEFAULT NULL,
    glucosa_momento  ENUM('ayunas','postprandial','nocturno') DEFAULT NULL,
    dolor_intensidad TINYINT       DEFAULT NULL CHECK (dolor_intensidad BETWEEN 0 AND 10),
    notas            TEXT          DEFAULT NULL,
    estado           ENUM('completo','incompleto','pendiente') NOT NULL DEFAULT 'pendiente',
    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_registros_paciente
        FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE KEY uq_registro_fecha (paciente_id, fecha),
    INDEX idx_registros_paciente (paciente_id),
    INDEX idx_registros_fecha    (fecha)
) ENGINE=InnoDB;


-- ──────────────────────────────────────────────
-- 7. DOLOR_LOCALIZACIONES
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dolor_localizaciones (
    id          INT         NOT NULL AUTO_INCREMENT,
    registro_id INT         NOT NULL,
    zona        VARCHAR(80) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_dolor_registro
        FOREIGN KEY (registro_id) REFERENCES registros_diarios(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_dolor_registro (registro_id)
) ENGINE=InnoDB;


-- ──────────────────────────────────────────────
-- 8. SINTOMAS_REGISTRO
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sintomas_registro (
    id          INT         NOT NULL AUTO_INCREMENT,
    registro_id INT         NOT NULL,
    sintoma     VARCHAR(120) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_sintomas_registro
        FOREIGN KEY (registro_id) REFERENCES registros_diarios(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_sintomas_registro (registro_id)
) ENGINE=InnoDB;


-- ──────────────────────────────────────────────
-- 9. DOSIS_REGISTRO
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dosis_registro (
    id             INT         NOT NULL AUTO_INCREMENT,
    registro_id    INT         NOT NULL,
    medicamento_id INT         NOT NULL,
    tomada         BOOLEAN     NOT NULL DEFAULT FALSE,
    turno          VARCHAR(40) DEFAULT NULL,
    hora_registro  TIME        DEFAULT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_dosis_registro
        FOREIGN KEY (registro_id) REFERENCES registros_diarios(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_dosis_medicamento
        FOREIGN KEY (medicamento_id) REFERENCES medicamentos(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_dosis_registro    (registro_id),
    INDEX idx_dosis_medicamento (medicamento_id)
) ENGINE=InnoDB;


-- ──────────────────────────────────────────────
-- 10. ALERTAS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alertas (
    id          INT          NOT NULL AUTO_INCREMENT,
    paciente_id INT          NOT NULL,
    medico_id   INT          NOT NULL,
    tipo        ENUM('glucosa_alta','glucosa_baja','dolor_severo','baja_adherencia','otro') NOT NULL,
    descripcion TEXT         NOT NULL,
    resuelta    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_alertas_paciente
        FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_alertas_medico
        FOREIGN KEY (medico_id) REFERENCES medicos(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_alertas_paciente (paciente_id),
    INDEX idx_alertas_medico   (medico_id),
    INDEX idx_alertas_resuelta (resuelta)
) ENGINE=InnoDB;


-- ──────────────────────────────────────────────
-- DATOS DE PRUEBA (comentar en producción)
-- ──────────────────────────────────────────────

-- Usuario médico de prueba (contraseña: Test1234)
INSERT INTO usuarios (email, password_hash, rol) VALUES
('medico@ceti.mx', '$2b$12$placeholder_hash_cambiar', 'medico');

INSERT INTO medicos (usuario_id, nombre, apellidos, especialidad) VALUES
(1, 'Carlos', 'Ramírez López', 'Endocrinología');

-- Usuario paciente de prueba
INSERT INTO usuarios (email, password_hash, rol) VALUES
('paciente@ceti.mx', '$2b$12$placeholder_hash_cambiar', 'paciente');

INSERT INTO pacientes (usuario_id, medico_id, nombre, apellidos, tipo_diabetes,
                       anios_diagnostico, hba1c, grupo_estudio, consentimiento) VALUES
(2, 1, 'María Elena', 'Flores García', 'tipo_2', 8, 7.8, 'Grupo A', TRUE);

INSERT INTO medicamentos (paciente_id, nombre, dosis, frecuencia) VALUES
(1, 'Perlas de myo-inositol', '1 perla', 'c/12h'),
(1, 'Metformina', '850mg', 'c/12h');
