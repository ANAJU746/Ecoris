require("dotenv").config();

const express = require("express");
const fs = require("fs");
const https = require("https");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const { pool } = require("./db");

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "ecoris_secret";
const isProduction = process.env.NODE_ENV === "production";
const authCookieName = "ecoris_token";
const authCookieBaseOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProduction,
  path: "/",
};
const authCookieMaxAgeMs = 8 * 60 * 60 * 1000;

const setAuthCookie = (res, token) => {
  res.cookie(authCookieName, token, { ...authCookieBaseOptions, maxAge: authCookieMaxAgeMs });
};

const clearAuthCookie = (res) => {
  res.clearCookie(authCookieName, authCookieBaseOptions);
};

const readAuthCookie = (req) => {
  const header = req.headers.cookie || "";
  const cookies = header
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.split("=");
    if (name === authCookieName) {
      try {
        return decodeURIComponent(rest.join("="));
      } catch (error) {
        return null;
      }
    }
  }
  return null;
};

const requireIndexAuth = (req, res, next) => {
  const token = readAuthCookie(req);
  if (!token) {
    return res.redirect("/Sesiones/iniciosesion.html");
  }
  try {
    jwt.verify(token, JWT_SECRET);
    return next();
  } catch (error) {
    clearAuthCookie(res);
    return res.redirect("/Sesiones/iniciosesion.html");
  }
};

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const imageFileFilter = (req, file, cb) => {
  const isImage = file.mimetype.startsWith("image/");
  if (!isImage) {
    return cb(new Error("Solo se permiten imagenes."));
  }
  return cb(null, true);
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeName = `empresa-${req.empresaId || "anon"}-${Date.now()}${ext}`;
    cb(null, safeName);
  },
});

const productStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeName = `producto-${req.empresaId || "anon"}-${Date.now()}${ext}`;
    cb(null, safeName);
  },
});

const clienteStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeName = `cliente-${req.clienteId || "anon"}-${Date.now()}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

const productUpload = multer({
  storage: productStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

const clienteUpload = multer({
  storage: clienteStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

app.use(express.json());
app.use("/uploads", express.static(uploadsDir));

const indexFilePath = path.join(__dirname, "index.html");
const sendIndexFile = (req, res) => {
  res.sendFile(indexFilePath);
};

app.get("/", requireIndexAuth, sendIndexFile);
app.get("/index.html", requireIndexAuth, sendIndexFile);

app.use(express.static(__dirname));

const tileSources = {
  osm: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
  carto: (z, x, y) => `https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/${z}/${x}/${y}.png`,
  esri: (z, x, y) =>
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`,
  esri_sat: (z, x, y) =>
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
  esri_labels: (z, x, y) =>
    `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/${z}/${y}/${x}`,
};

app.get("/api/tiles/:source/:z/:x/:y.png", (req, res) => {
  const { source, z, x, y } = req.params;
  const buildUrl = tileSources[source];
  if (!buildUrl) {
    return res.status(400).json({ error: "Fuente de mapa invalida." });
  }

  const url = buildUrl(z, x, y);
  https
    .get(url, (upstream) => {
      const status = upstream.statusCode || 502;
      res.status(status);
      const contentType = upstream.headers["content-type"] || "image/png";
      res.setHeader("Content-Type", contentType);
      upstream.pipe(res);
    })
    .on("error", () => {
      res.status(502).json({ error: "No se pudo cargar el mapa." });
    });
});

app.get("/api/empresas", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id_empresa, nombre_empresa, tipo_empresa, tipo_material, modalidad, municipio, estado, precio_min, precio_max, lat, lng, foto_url, etiquetas FROM empresa"
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "No se pudo consultar la base de datos." });
  }
});

const parseNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = Number(String(value).replace(",", "."));
  return Number.isNaN(parsed) ? null : parsed;
};

const authenticateEmpresa = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Token requerido." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload || payload.tipo !== "empresa" || !payload.id_empresa) {
      return res.status(403).json({ error: "Acceso no autorizado." });
    }

    req.empresaId = payload.id_empresa;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Token invalido." });
  }
};

const authenticateCliente = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Token requerido." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload || payload.tipo !== "cliente" || !payload.id) {
      return res.status(403).json({ error: "Acceso no autorizado." });
    }

    req.clienteId = payload.id;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Token invalido." });
  }
};

app.post("/api/productos", authenticateEmpresa, async (req, res) => {
  const payload = req.body || {};

  const values = {
    id_empresa: req.empresaId,
    nombre_material: String(payload.nombre_material || "").trim(),
    categoria: String(payload.categoria || "").trim(),
    tipo_residuo: String(payload.tipo_residuo || "").trim(),
    cantidad: parseNumber(payload.cantidad),
    unidad: String(payload.unidad || "").trim(),
    foto_url: String(payload.foto_url || "").trim(),
    estado_material: String(payload.estado_material || "nuevo").trim(),
    descripcion: String(payload.descripcion || "").trim(),
    precio_unitario: parseNumber(payload.precio_unitario),
    precio_min: parseNumber(payload.precio_min),
    precio_max: parseNumber(payload.precio_max),
    moneda: String(payload.moneda || "").trim(),
    modalidad: String(payload.modalidad || "").trim(),
    negociable: String(payload.negociable || "").trim(),
    ubicacion: String(payload.ubicacion || "").trim(),
    horario_retiro: String(payload.horario_retiro || "").trim(),
    disponible_desde: payload.disponible_desde || null,
    contacto: String(payload.contacto || "").trim(),
    recoleccion: String(payload.recoleccion || "").trim(),
    certificaciones: String(payload.certificaciones || "").trim(),
    etiquetas: String(payload.etiquetas || "").trim(),
  };

  if (!values.nombre_material) {
    return res.status(400).json({ error: "El nombre del material es obligatorio." });
  }

  try {
    if (!values.ubicacion) {
      const [empresaRows] = await pool.query(
        "SELECT municipio, estado, direccion FROM empresa WHERE id_empresa = ?",
        [req.empresaId]
      );
      if (empresaRows.length) {
        const direccion = empresaRows[0].direccion || "";
        const municipio = empresaRows[0].municipio || "";
        const estado = empresaRows[0].estado || "";
        values.ubicacion =
          direccion || [municipio, estado].filter(Boolean).join(", ");
      }
    }

    const [result] = await pool.query(
      `
        INSERT INTO productos (
          id_empresa,
          nombre_material,
          categoria,
          tipo_residuo,
          cantidad,
          unidad,
          foto_url,
          estado_material,
          descripcion,
          precio_unitario,
          precio_min,
          precio_max,
          moneda,
          modalidad,
          negociable,
          ubicacion,
          horario_retiro,
          disponible_desde,
          contacto,
          recoleccion,
          certificaciones,
          etiquetas
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        values.id_empresa,
        values.nombre_material,
        values.categoria,
        values.tipo_residuo,
        values.cantidad,
        values.unidad,
        values.foto_url,
        values.estado_material,
        values.descripcion,
        values.precio_unitario,
        values.precio_min,
        values.precio_max,
        values.moneda,
        values.modalidad,
        values.negociable,
        values.ubicacion,
        values.horario_retiro,
        values.disponible_desde,
        values.contacto,
        values.recoleccion,
        values.certificaciones,
        values.etiquetas,
      ]
    );

    res.status(201).json({ id_producto: result.insertId });
  } catch (error) {
    res.status(500).json({ error: "No se pudo guardar el residuo." });
  }
});

app.put("/api/productos/:id", authenticateEmpresa, async (req, res) => {
  const productoId = Number(req.params.id);
  if (!Number.isFinite(productoId)) {
    return res.status(400).json({ error: "ID invalido." });
  }

  const payload = req.body || {};
  const values = {
    nombre_material: String(payload.nombre_material || "").trim(),
    categoria: String(payload.categoria || "").trim(),
    tipo_residuo: String(payload.tipo_residuo || "").trim(),
    cantidad: parseNumber(payload.cantidad),
    unidad: String(payload.unidad || "").trim(),
    foto_url: String(payload.foto_url || "").trim(),
    estado_material: String(payload.estado_material || "nuevo").trim(),
    descripcion: String(payload.descripcion || "").trim(),
    precio_unitario: parseNumber(payload.precio_unitario),
    precio_min: parseNumber(payload.precio_min),
    precio_max: parseNumber(payload.precio_max),
    moneda: String(payload.moneda || "").trim(),
    modalidad: String(payload.modalidad || "").trim(),
    negociable: String(payload.negociable || "").trim(),
    ubicacion: String(payload.ubicacion || "").trim(),
    horario_retiro: String(payload.horario_retiro || "").trim(),
    disponible_desde: payload.disponible_desde || null,
    contacto: String(payload.contacto || "").trim(),
    recoleccion: String(payload.recoleccion || "").trim(),
    certificaciones: String(payload.certificaciones || "").trim(),
    etiquetas: String(payload.etiquetas || "").trim(),
  };

  if (!values.nombre_material) {
    return res.status(400).json({ error: "El nombre del material es obligatorio." });
  }

  try {
    const [existingRows] = await pool.query(
      "SELECT id_producto FROM productos WHERE id_producto = ? AND id_empresa = ?",
      [productoId, req.empresaId]
    );
    if (!existingRows.length) {
      return res.status(404).json({ error: "Producto no encontrado." });
    }

    if (!values.ubicacion) {
      const [empresaRows] = await pool.query(
        "SELECT municipio, estado, direccion FROM empresa WHERE id_empresa = ?",
        [req.empresaId]
      );
      if (empresaRows.length) {
        const direccion = empresaRows[0].direccion || "";
        const municipio = empresaRows[0].municipio || "";
        const estado = empresaRows[0].estado || "";
        values.ubicacion = direccion || [municipio, estado].filter(Boolean).join(", ");
      }
    }

    await pool.query(
      `
        UPDATE productos
        SET nombre_material = ?, categoria = ?, tipo_residuo = ?, cantidad = ?, unidad = ?,
            foto_url = ?, estado_material = ?, descripcion = ?, precio_unitario = ?,
            precio_min = ?, precio_max = ?, moneda = ?, modalidad = ?, negociable = ?,
            ubicacion = ?, horario_retiro = ?, disponible_desde = ?, contacto = ?,
            recoleccion = ?, certificaciones = ?, etiquetas = ?
        WHERE id_producto = ? AND id_empresa = ?
      `,
      [
        values.nombre_material,
        values.categoria,
        values.tipo_residuo,
        values.cantidad,
        values.unidad,
        values.foto_url,
        values.estado_material,
        values.descripcion,
        values.precio_unitario,
        values.precio_min,
        values.precio_max,
        values.moneda,
        values.modalidad,
        values.negociable,
        values.ubicacion,
        values.horario_retiro,
        values.disponible_desde,
        values.contacto,
        values.recoleccion,
        values.certificaciones,
        values.etiquetas,
        productoId,
        req.empresaId,
      ]
    );

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: "No se pudo actualizar el residuo." });
  }
});

app.get("/api/productos", async (req, res) => {
  const limit = Number(req.query.limit) || 12;

  try {
    const [rows] = await pool.query(
      `
        SELECT p.id_producto, p.id_empresa, p.nombre_material, p.categoria, p.tipo_residuo, p.cantidad,
               p.unidad, p.foto_url, p.estado_material, p.descripcion, p.precio_unitario, p.precio_min,
               p.precio_max, p.moneda, p.modalidad, p.etiquetas, p.created_at,
               e.nombre_empresa, e.municipio, e.estado, e.foto_url AS empresa_foto_url
        FROM productos p
        LEFT JOIN empresa e ON e.id_empresa = p.id_empresa
        ORDER BY p.created_at DESC
        LIMIT ?
      `,
      [limit]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: "No se pudo cargar los productos." });
  }
});

app.post("/api/productos/foto", authenticateEmpresa, productUpload.single("foto"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No se recibio ninguna imagen." });
  }

  const fotoUrl = `/uploads/${req.file.filename}`;
  return res.json({ foto_url: fotoUrl });
});

app.post("/api/notificaciones", authenticateCliente, async (req, res) => {
  const body = req.body || {};
  const comentario = String(body.comentario || "").trim();
  const itemsRaw = Array.isArray(body.items) ? body.items : [];

  const items = itemsRaw
    .map((item) => {
      const empresaIdCandidate = Number(item.empresa_id ?? item.id_empresa ?? item.id);
      const empresaId = Number.isFinite(empresaIdCandidate) ? empresaIdCandidate : null;
      if (!empresaId) {
        return null;
      }
      const productoCandidate = Number(item.producto_id ?? item.id_producto);
      const productoId = Number.isFinite(productoCandidate) ? productoCandidate : null;
      const material = String(item.material || "").trim();
      const cantidad = parseNumber(item.cantidad ?? item.qty ?? 1) ?? 1;
      const modalidad = String(item.modalidad || "").trim();
      const mensajeCustom = String(item.mensaje || "").trim();
      return {
        empresaId,
        productoId,
        material: material || null,
        cantidad,
        modalidad: modalidad || null,
        mensaje: mensajeCustom,
      };
    })
    .filter(Boolean);

  if (!items.length) {
    return res.status(400).json({ error: "Debes enviar al menos una solicitud valida." });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    for (const item of items) {
      const titulo = item.material ? `Solicitud de ${item.material}` : "Solicitud de material";
      const detalleMaterial = item.material ? ` de ${item.material}` : "";
      const mensajeBase = item.mensaje
        ? item.mensaje
        : `El cliente solicita ${item.cantidad || 1} unidad(es)${detalleMaterial}`;

      await connection.query(
        `
          INSERT INTO notificaciones (
            id_empresa,
            id_cliente,
            id_producto,
            titulo,
            mensaje,
            material,
            cantidad,
            modalidad,
            comentario
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          item.empresaId,
          req.clienteId,
          item.productoId,
          titulo,
          mensajeBase,
          item.material,
          item.cantidad,
          item.modalidad,
          comentario || null,
        ]
      );
    }

    await connection.commit();
    return res.status(201).json({ ok: true, total: items.length });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_) {
        // ignore rollback errors
      }
    }
    return res.status(500).json({ error: "No se pudo registrar la solicitud." });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

app.get("/api/notificaciones/empresa", authenticateEmpresa, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          n.id_notificacion,
          n.titulo,
          n.mensaje,
          n.material,
          n.cantidad,
          n.modalidad,
          n.comentario,
          n.estado,
          n.respuesta,
          n.respuesta_mensaje,
          n.created_at,
          n.responded_at,
          c.nombre AS cliente_nombre,
          c.correo AS cliente_correo,
          c.telefono AS cliente_telefono
        FROM notificaciones n
        INNER JOIN clientes c ON c.id_cliente = n.id_cliente
        WHERE n.id_empresa = ?
        ORDER BY n.created_at DESC
      `,
      [req.empresaId]
    );

    return res.json({ notificaciones: rows });
  } catch (error) {
    return res.status(500).json({ error: "No se pudieron cargar las notificaciones." });
  }
});

app.get("/api/notificaciones/cliente", authenticateCliente, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          n.id_notificacion,
          n.titulo,
          n.mensaje,
          n.material,
          n.cantidad,
          n.modalidad,
          n.comentario,
          n.estado,
          n.respuesta,
          n.respuesta_mensaje,
          n.created_at,
          n.responded_at,
          e.nombre_empresa AS empresa_nombre,
          e.correo AS empresa_correo,
          e.telefono AS empresa_telefono
        FROM notificaciones n
        INNER JOIN empresa e ON e.id_empresa = n.id_empresa
        WHERE n.id_cliente = ?
        ORDER BY n.created_at DESC
      `,
      [req.clienteId]
    );

    return res.json({ notificaciones: rows });
  } catch (error) {
    return res.status(500).json({ error: "No se pudieron cargar las notificaciones." });
  }
});

app.post("/api/notificaciones/:id/responder", authenticateEmpresa, async (req, res) => {
  const notificacionId = Number(req.params.id);
  if (!Number.isFinite(notificacionId)) {
    return res.status(400).json({ error: "ID invalido." });
  }

  const rawRespuesta = String(req.body?.respuesta || "").trim().toLowerCase();
  const respuestaMap = {
    disponible: "disponible",
    "no_disponible": "no_disponible",
    "no-disponible": "no_disponible",
    "no disponible": "no_disponible",
  };
  const respuesta = respuestaMap[rawRespuesta];
  if (!respuesta) {
    return res.status(400).json({ error: "Respuesta invalida." });
  }
  const mensaje = String(req.body?.mensaje || "").trim();

  try {
    const [rows] = await pool.query(
      "SELECT id_notificacion FROM notificaciones WHERE id_notificacion = ? AND id_empresa = ?",
      [notificacionId, req.empresaId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Notificacion no encontrada." });
    }

    await pool.query(
      `
        UPDATE notificaciones
        SET estado = 'respondido',
            respuesta = ?,
            respuesta_mensaje = ?,
            responded_at = CURRENT_TIMESTAMP
        WHERE id_notificacion = ?
      `,
      [respuesta, mensaje || null, notificacionId]
    );

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: "No se pudo actualizar la notificacion." });
  }
});

app.post("/api/iniciosecion", async (req, res) => {
  const payload = req.body || {};
  const tipo = String(payload.tipo || "empresa").trim().toLowerCase();
  const correo = String(payload.correo || "").trim();
  const contrasena = String(payload.contrasena || "").trim();

  if (!correo || !contrasena) {
    return res
      .status(400)
      .json({ error: "Correo y contrasena son obligatorios." });
  }

  const isCliente = tipo === "cliente";
  const tableName = isCliente ? "clientes" : "iniciosecion";
  const idField = isCliente ? "id_cliente" : "id_inicio";
  const extraField = isCliente ? "NULL AS id_empresa" : "id_empresa";

  try {
    const [rows] = await pool.query(
      isCliente
        ? `SELECT ${idField} AS id, ${extraField}, contrasena_hash, nombre, correo, telefono, foto_url FROM ${tableName} WHERE correo = ?`
        : `SELECT ${idField} AS id, ${tableName}.id_empresa AS id_empresa, contrasena_hash, ${tableName}.nombre, ${tableName}.correo, ${tableName}.telefono, empresa.foto_url FROM ${tableName} LEFT JOIN empresa ON empresa.id_empresa = ${tableName}.id_empresa WHERE ${tableName}.correo = ?`,
      [correo]
    );

    if (!rows.length) {
      return res.status(401).json({ error: "Credenciales invalidas." });
    }

    const isValid = await bcrypt.compare(contrasena, rows[0].contrasena_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Credenciales invalidas." });
    }

    const token = jwt.sign(
      {
        id: rows[0].id,
        tipo,
        id_empresa: rows[0].id_empresa || null,
      },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    if (tipo === "empresa" && !rows[0].id_empresa) {
      return res
        .status(400)
        .json({ error: "Cuenta de empresa sin ID empresa asociado." });
    }

    setAuthCookie(res, token);

    res.status(200).json({
      id: rows[0].id,
      tipo,
      token,
      nombre: rows[0].nombre,
      correo: rows[0].correo,
      telefono: rows[0].telefono,
      foto_url: rows[0].foto_url,
    });
  } catch (error) {
    console.error("Inicio de sesion fallo:", error);
    res.status(500).json({
      error: "No se pudo iniciar sesion.",
      details: error.message,
    });
  }
});

app.post("/api/logout", (req, res) => {
  clearAuthCookie(res);
  res.status(200).json({ ok: true });
});

app.post("/api/registro", async (req, res) => {
  const payload = req.body || {};
  const tipo = String(payload.tipo || "empresa").trim().toLowerCase();
  const nombre = String(payload.nombre || "").trim();
  const correo = String(payload.correo || "").trim();
  const contrasena = String(payload.contrasena || "").trim();
  const telefono = String(payload.telefono || "").trim();
  const municipio = String(payload.municipio || "").trim();
  const estado = String(payload.estado || "").trim();
  const direccion = String(payload.direccion || "").trim();
  const lat = parseNumber(payload.lat);
  const lng = parseNumber(payload.lng);

  if (!nombre || !correo || !contrasena) {
    return res.status(400).json({ error: "Nombre, correo y contrasena son obligatorios." });
  }

  const isCliente = tipo === "cliente";
  const tableName = isCliente ? "clientes" : "iniciosecion";
  const idField = isCliente ? "id_cliente" : "id_inicio";

  try {
    const [existing] = await pool.query(
      `SELECT ${idField} AS id FROM ${tableName} WHERE correo = ?`,
      [correo]
    );

    if (existing.length) {
      return res.status(409).json({ error: "El correo ya esta registrado." });
    }

    const contrasenaHash = await bcrypt.hash(contrasena, 10);

    if (isCliente) {
      const [result] = await pool.query(
        `
          INSERT INTO clientes (nombre, correo, contrasena_hash, telefono)
          VALUES (?, ?, ?, ?)
        `,
        [nombre, correo, contrasenaHash, telefono]
      );

      return res.status(201).json({ id: result.insertId, tipo });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [empresaResult] = await connection.query(
        `
          INSERT INTO empresa (
            nombre_empresa,
            tipo_empresa,
            responsable,
            telefono,
            correo,
            direccion,
            tipo_material,
            modalidad,
            municipio,
            estado,
            precio_min,
            precio_max,
            lat,
            lng,
            foto_url,
            etiquetas
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          nombre,
          "",
          nombre,
          telefono,
          correo,
          direccion,
          "",
          "Venta",
          municipio,
          estado,
          0,
          0,
          lat,
          lng,
          "",
          "",
        ]
      );

      const empresaId = empresaResult.insertId;

      const [result] = await connection.query(
        `
          INSERT INTO iniciosecion (nombre, correo, contrasena_hash, telefono, id_empresa)
          VALUES (?, ?, ?, ?, ?)
        `,
        [nombre, correo, contrasenaHash, telefono, empresaId]
      );

      await connection.commit();
      return res.status(201).json({ id: result.insertId, tipo, id_empresa: empresaId });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Registro fallo:", error);
    res.status(500).json({
      error: "No se pudo registrar la cuenta.",
      details: error.message,
    });
  }
});

app.get("/api/empresa/me", authenticateEmpresa, async (req, res) => {
  try {
    const [empresaRows] = await pool.query(
      "SELECT id_empresa, nombre_empresa, tipo_empresa, tipo_material, modalidad, municipio, estado, direccion, lat, lng, precio_min, precio_max, foto_url, etiquetas FROM empresa WHERE id_empresa = ?",
      [req.empresaId]
    );

    if (!empresaRows.length) {
      return res.status(404).json({ error: "Empresa no encontrada." });
    }

    const [productoRows] = await pool.query(
      `
        SELECT id_producto, id_empresa, nombre_material, categoria, tipo_residuo, cantidad, unidad,
               foto_url, estado_material, descripcion, precio_unitario, precio_min, precio_max, moneda,
               modalidad, negociable, ubicacion, horario_retiro, disponible_desde, contacto, recoleccion,
               certificaciones, etiquetas, created_at
        FROM productos
        WHERE id_empresa = ?
        ORDER BY created_at DESC
      `,
      [req.empresaId]
    );

    return res.json({ empresa: empresaRows[0], productos: productoRows });
  } catch (error) {
    return res.status(500).json({ error: "No se pudo cargar la empresa." });
  }
});

app.get("/api/empresa/:id", async (req, res) => {
  const empresaId = Number(req.params.id);
  if (!Number.isFinite(empresaId)) {
    return res.status(400).json({ error: "ID invalido." });
  }

  try {
    const [empresaRows] = await pool.query(
      "SELECT id_empresa, nombre_empresa, tipo_empresa, tipo_material, modalidad, municipio, estado, direccion, lat, lng, foto_url, etiquetas FROM empresa WHERE id_empresa = ?",
      [empresaId]
    );

    if (!empresaRows.length) {
      return res.status(404).json({ error: "Empresa no encontrada." });
    }

    const [productoRows] = await pool.query(
      `
        SELECT id_producto, id_empresa, nombre_material, categoria, tipo_residuo, cantidad, unidad,
               foto_url, estado_material, descripcion, precio_unitario, precio_min, precio_max, moneda,
               modalidad, negociable, ubicacion, horario_retiro, disponible_desde, contacto, recoleccion,
               certificaciones, etiquetas, created_at
        FROM productos
        WHERE id_empresa = ?
        ORDER BY created_at DESC
      `,
      [empresaId]
    );

    return res.json({ empresa: empresaRows[0], productos: productoRows });
  } catch (error) {
    return res.status(500).json({ error: "No se pudo cargar la empresa." });
  }
});

app.get("/api/productos/:id", async (req, res) => {
  const productoId = Number(req.params.id);
  if (!Number.isFinite(productoId)) {
    return res.status(400).json({ error: "ID invalido." });
  }

  try {
    const [rows] = await pool.query(
      `
        SELECT p.id_producto, p.id_empresa, p.nombre_material, p.categoria, p.tipo_residuo, p.cantidad,
               p.unidad, p.foto_url, p.estado_material, p.descripcion, p.precio_unitario, p.precio_min,
               p.precio_max, p.moneda, p.modalidad, p.negociable, p.ubicacion, p.horario_retiro,
               p.disponible_desde, p.contacto, p.recoleccion, p.certificaciones, p.etiquetas, p.created_at,
               e.nombre_empresa, e.municipio, e.estado, e.telefono, e.correo, e.foto_url AS empresa_foto_url
        FROM productos p
        LEFT JOIN empresa e ON e.id_empresa = p.id_empresa
        WHERE p.id_producto = ?
      `,
      [productoId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Producto no encontrado." });
    }

    const row = rows[0];
    const producto = {
      id_producto: row.id_producto,
      id_empresa: row.id_empresa,
      nombre_material: row.nombre_material,
      categoria: row.categoria,
      tipo_residuo: row.tipo_residuo,
      cantidad: row.cantidad,
      unidad: row.unidad,
      foto_url: row.foto_url,
      estado_material: row.estado_material,
      descripcion: row.descripcion,
      precio_unitario: row.precio_unitario,
      precio_min: row.precio_min,
      precio_max: row.precio_max,
      moneda: row.moneda,
      modalidad: row.modalidad,
      negociable: row.negociable,
      ubicacion: row.ubicacion,
      horario_retiro: row.horario_retiro,
      disponible_desde: row.disponible_desde,
      contacto: row.contacto,
      recoleccion: row.recoleccion,
      certificaciones: row.certificaciones,
      etiquetas: row.etiquetas,
      created_at: row.created_at,
    };

    const empresa = row.id_empresa
      ? {
          id_empresa: row.id_empresa,
          nombre_empresa: row.nombre_empresa,
          municipio: row.municipio,
          estado: row.estado,
          telefono: row.telefono,
          correo: row.correo,
          foto_url: row.empresa_foto_url,
        }
      : null;

    return res.json({ producto, empresa });
  } catch (error) {
    return res.status(500).json({ error: "No se pudo cargar el producto." });
  }
});

app.put("/api/empresa/me", authenticateEmpresa, async (req, res) => {
  const payload = req.body || {};
  const municipio = String(payload.municipio || "").trim();
  const estado = String(payload.estado || "").trim();
  const direccion = String(payload.direccion || "").trim();
  const lat = parseNumber(payload.lat);
  const lng = parseNumber(payload.lng);
  const tipoEmpresa = String(payload.tipo_empresa || "").trim();
  const tipoMaterial = String(payload.tipo_material || "").trim();
  const modalidad = String(payload.modalidad || "").trim();
  const etiquetas = String(payload.etiquetas || "").trim();

  try {
    await pool.query(
      `
        UPDATE empresa
        SET municipio = ?, estado = ?, direccion = ?, lat = ?, lng = ?,
            tipo_empresa = ?, tipo_material = ?, modalidad = ?, etiquetas = ?
        WHERE id_empresa = ?
      `,
      [
        municipio,
        estado,
        direccion,
        lat,
        lng,
        tipoEmpresa,
        tipoMaterial,
        modalidad,
        etiquetas,
        req.empresaId,
      ]
    );

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: "No se pudo actualizar la empresa." });
  }
});

app.post("/api/empresa/logo", authenticateEmpresa, upload.single("logo"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No se recibio ninguna imagen." });
  }

  const fotoUrl = `/uploads/${req.file.filename}`;

  try {
    await pool.query(
      "UPDATE empresa SET foto_url = ? WHERE id_empresa = ?",
      [fotoUrl, req.empresaId]
    );

    return res.json({ foto_url: fotoUrl });
  } catch (error) {
    return res.status(500).json({ error: "No se pudo guardar el logo." });
  }
});

app.get("/api/cliente/me", authenticateCliente, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id_cliente, nombre, correo, telefono, foto_url FROM clientes WHERE id_cliente = ?",
      [req.clienteId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Cliente no encontrado." });
    }

    return res.json({ cliente: rows[0] });
  } catch (error) {
    return res.status(500).json({ error: "No se pudo cargar el cliente." });
  }
});

app.put("/api/cliente/me", authenticateCliente, async (req, res) => {
  const payload = req.body || {};
  const nombre = String(payload.nombre || "").trim();
  const correo = String(payload.correo || "").trim();
  const telefono = String(payload.telefono || "").trim();

  if (!nombre || !correo) {
    return res.status(400).json({ error: "Nombre y correo son obligatorios." });
  }

  try {
    const [existing] = await pool.query(
      "SELECT id_cliente FROM clientes WHERE correo = ? AND id_cliente <> ?",
      [correo, req.clienteId]
    );

    if (existing.length) {
      return res.status(409).json({ error: "El correo ya esta registrado." });
    }

    await pool.query(
      "UPDATE clientes SET nombre = ?, correo = ?, telefono = ? WHERE id_cliente = ?",
      [nombre, correo, telefono, req.clienteId]
    );

    return res.json({ ok: true, cliente: { nombre, correo, telefono } });
  } catch (error) {
    return res.status(500).json({ error: "No se pudo actualizar el cliente." });
  }
});

app.post(
  "/api/cliente/foto",
  authenticateCliente,
  clienteUpload.single("foto"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No se recibio ninguna imagen." });
    }

    const fotoUrl = `/uploads/${req.file.filename}`;

    try {
      await pool.query("UPDATE clientes SET foto_url = ? WHERE id_cliente = ?", [
        fotoUrl,
        req.clienteId,
      ]);

      return res.json({ foto_url: fotoUrl });
    } catch (error) {
      return res.status(500).json({ error: "No se pudo guardar la foto." });
    }
  }
);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () => {
  console.log(`Servidor activo en http://localhost:${port}`);
});
