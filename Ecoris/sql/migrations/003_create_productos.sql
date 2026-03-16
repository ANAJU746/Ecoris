CREATE TABLE IF NOT EXISTS productos (
  id_producto INT AUTO_INCREMENT PRIMARY KEY,
  id_empresa INT NULL,
  nombre_material VARCHAR(150) NOT NULL,
  categoria VARCHAR(80) NULL,
  tipo_residuo VARCHAR(80) NULL,
  cantidad DECIMAL(10, 2) NULL,
  unidad VARCHAR(20) NULL,
  foto_url VARCHAR(255) NULL,
  estado_material ENUM('nuevo', 'usado', 'mal_estado') NOT NULL DEFAULT 'nuevo',
  descripcion TEXT NULL,
  precio_unitario DECIMAL(10, 2) NULL,
  precio_min DECIMAL(10, 2) NULL,
  precio_max DECIMAL(10, 2) NULL,
  moneda VARCHAR(10) NULL,
  modalidad VARCHAR(40) NULL,
  negociable VARCHAR(10) NULL,
  ubicacion VARCHAR(150) NULL,
  horario_retiro VARCHAR(100) NULL,
  disponible_desde DATE NULL,
  contacto VARCHAR(120) NULL,
  recoleccion VARCHAR(40) NULL,
  certificaciones VARCHAR(150) NULL,
  etiquetas VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_productos_empresa
    FOREIGN KEY (id_empresa)
    REFERENCES empresa(id_empresa)
    ON DELETE SET NULL
);
