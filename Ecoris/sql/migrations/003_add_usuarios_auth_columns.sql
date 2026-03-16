ALTER TABLE usuarios
  ADD COLUMN tipo VARCHAR(20) NULL AFTER telefono,
  ADD COLUMN id_empresa INT NULL AFTER tipo,
  ADD COLUMN contrasena_hash VARCHAR(255) NULL AFTER email;
