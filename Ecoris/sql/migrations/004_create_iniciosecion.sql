CREATE TABLE IF NOT EXISTS iniciosecion (
  id_inicio INT AUTO_INCREMENT PRIMARY KEY,
  correo VARCHAR(120) NOT NULL,
  contrasena VARCHAR(120) NOT NULL,
  id_empresa INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_iniciosecion_empresa
    FOREIGN KEY (id_empresa)
    REFERENCES empresa(id_empresa)
    ON DELETE SET NULL
);
