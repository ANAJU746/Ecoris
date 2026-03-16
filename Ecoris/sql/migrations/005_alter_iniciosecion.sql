ALTER TABLE iniciosecion
  CHANGE COLUMN contrasena contrasena_hash VARCHAR(255) NOT NULL,
  ADD COLUMN nombre VARCHAR(120) NULL AFTER id_inicio,
  ADD COLUMN telefono VARCHAR(40) NULL AFTER correo;
