const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();

const db = require('./db');

const app = express();

// =====================================================
// CONFIGURACIÓN GENERAL
// =====================================================

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin'
    }
  })
);

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:4000',
  'http://localhost:3001'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('No permitido por CORS'));
  },
  credentials: true
}));

const obtenerOCrearClienteFacturacion = async (
  connection,
  {
    idRestaurante,
    idCliente,
    nit,
    nombreFacturacion,
    direccionFacturacion,
    correoFacturacion
  }
) => {
  const nitFinal = nit && nit.trim()
    ? nit.trim().toUpperCase()
    : 'CF';

  const nombreFinal = nombreFacturacion && nombreFacturacion.trim()
    ? nombreFacturacion.trim()
    : 'Consumidor final';

  const direccionFinal = direccionFacturacion && direccionFacturacion.trim()
    ? direccionFacturacion.trim()
    : null;

  const correoFinal = correoFacturacion && correoFacturacion.trim()
    ? correoFacturacion.trim()
    : null;

  const [existente] = await connection.query(
    `
    SELECT id_cliente_facturacion
    FROM clientes_facturacion
    WHERE id_restaurante = ?
    AND nit = ?
    LIMIT 1
    `,
    [idRestaurante, nitFinal]
  );

  if (existente.length > 0) {
    const idClienteFacturacion = existente[0].id_cliente_facturacion;

    await connection.query(
      `
      UPDATE clientes_facturacion
      SET
        id_cliente = COALESCE(?, id_cliente),
        nombre_facturacion = ?,
        direccion_facturacion = ?,
        correo_facturacion = ?,
        estado = 1
      WHERE id_cliente_facturacion = ?
      AND id_restaurante = ?
      `,
      [
        idCliente || null,
        nombreFinal,
        direccionFinal,
        correoFinal,
        idClienteFacturacion,
        idRestaurante
      ]
    );

    return idClienteFacturacion;
  }

  const [result] = await connection.query(
    `
    INSERT INTO clientes_facturacion (
      id_restaurante,
      id_cliente,
      nit,
      nombre_facturacion,
      direccion_facturacion,
      correo_facturacion,
      estado
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      idRestaurante,
      idCliente || null,
      nitFinal,
      nombreFinal,
      direccionFinal,
      correoFinal,
      1
    ]
  );

  return result.insertId;
};

app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET no está definido en las variables de entorno');
}

// =====================================================
// LIMITADORES
// =====================================================

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    mensaje: 'Demasiados intentos de login. Intenta nuevamente en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const registroLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    mensaje: 'Demasiados registros desde esta conexión. Intenta nuevamente más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

const validarPassword = (password) => {
  if (typeof password !== 'string') return false;
  return password.length >= 8;
};

const obtenerIdRestaurante = (req, res) => {
  const idRestaurante = req.user?.id_restaurante;

  if (!idRestaurante) {
    res.status(400).json({
      mensaje: 'El usuario actual no tiene restaurante asignado'
    });
    return null;
  }

  return idRestaurante;
};

const permitirRoles = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.user || !rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({
        mensaje: 'No tienes permiso para realizar esta acción'
      });
    }

    next();
  };
};

// =====================================================
// CONFIGURACIÓN DE CORREO
// =====================================================

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT || 587),
  secure: String(process.env.EMAIL_SECURE) === 'true',
  family: 4,
  requireTLS: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    servername: 'smtp.gmail.com',

    // IMPORTANTE:
    // Esto ayuda cuando Windows, antivirus o firewall intercepta el certificado.
    // Para pruebas locales funciona.
    rejectUnauthorized: false
  }
});

const enviarCorreo = async ({ para, asunto, html }) => {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: para,
    subject: asunto,
    html
  });
};

const generarCodigoRecuperacion = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generarTokenTemporal = () => {
  return crypto.randomBytes(32).toString('hex');
};

// =====================================================
// MIDDLEWARE PARA VERIFICAR TOKEN
// =====================================================

const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      mensaje: 'Token no proporcionado'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        mensaje: 'Token inválido o vencido'
      });
    }

    req.user = user;
    next();
  });
};

// =====================================================
// MIDDLEWARE PARA VERIFICAR USUARIO Y RESTAURANTE ACTIVO
// =====================================================

const verificarUsuarioActivo = async (req, res, next) => {
  try {
    const idUsuario = req.user.id_usuario || req.user.id;

    const [rows] = await db.query(
      `
      SELECT 
        u.id_usuario,
        u.estado AS estado_usuario,
        u.id_restaurante,
        r.estado AS estado_restaurante
      FROM usuarios u
      INNER JOIN restaurantes r 
        ON u.id_restaurante = r.id_restaurante
      WHERE u.id_usuario = ?
      LIMIT 1
      `,
      [idUsuario]
    );

    if (rows.length === 0) {
      return res.status(403).json({
        mensaje: 'Usuario no válido'
      });
    }

    const usuario = rows[0];

    if (Number(usuario.estado_usuario) !== 1) {
      return res.status(403).json({
        mensaje: 'Tu usuario está desactivado'
      });
    }

    if (Number(usuario.estado_restaurante) !== 1) {
      return res.status(403).json({
        mensaje: 'El restaurante está desactivado'
      });
    }

    req.user.id_restaurante = usuario.id_restaurante;

    next();

  } catch (error) {
    console.error('Error validando usuario activo:', error);

    return res.status(500).json({
      mensaje: 'Error validando sesión'
    });
  }
};

// =====================================================
// CONFIGURACIÓN PARA SUBIR IMÁGENES
// =====================================================

const uploadDir = path.join(__dirname, 'uploads', 'productos');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Servir archivos estáticos
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
  })
);

const extensionesPermitidas = ['.jpg', '.jpeg', '.png', '.webp'];
const tiposPermitidos = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

const storageProductos = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (!extensionesPermitidas.includes(extension)) {
      return cb(new Error('Extensión de imagen no permitida'));
    }

    const nombreArchivo = `producto-${Date.now()}-${Math.round(Math.random() * 1E9)}${extension}`;

    cb(null, nombreArchivo);
  }
});

const fileFilterProductos = (req, file, cb) => {
  if (!tiposPermitidos.includes(file.mimetype)) {
    return cb(new Error('Solo se permiten imágenes JPG, PNG o WEBP'), false);
  }

  cb(null, true);
};

const uploadProducto = multer({
  storage: storageProductos,
  fileFilter: fileFilterProductos,
  limits: {
    fileSize: 3 * 1024 * 1024
  }
});

// =====================================================
// PERFIL DEL USUARIO AUTENTICADO
// =====================================================

app.get('/profile',
  verificarToken,
  verificarUsuarioActivo,
  async (req, res) => {
    try {
      const idUsuario = req.user.id_usuario || req.user.id;

      const [rows] = await db.query(
        `
        SELECT 
          u.id_usuario,
          u.id_restaurante,
          u.nombre,
          u.usuario,
          u.rol,
          u.estado,
          r.nombre AS nombre_restaurante
        FROM usuarios u
        INNER JOIN restaurantes r
          ON u.id_restaurante = r.id_restaurante
        WHERE u.id_usuario = ?
        LIMIT 1
        `,
        [idUsuario]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          mensaje: 'Usuario no encontrado'
        });
      }

      const usuario = rows[0];

      return res.json({
        user: {
          id: usuario.id_usuario,
          id_usuario: usuario.id_usuario,
          id_restaurante: usuario.id_restaurante,
          nombre: usuario.nombre,
          usuario: usuario.usuario,
          rol: usuario.rol,
          estado: usuario.estado,
          nombre_restaurante: usuario.nombre_restaurante
        }
      });

    } catch (error) {
      console.error('Error obteniendo perfil:', error);

      return res.status(500).json({
        mensaje: 'Error obteniendo perfil del usuario'
      });
    }
  }
);

// =====================================================
// RUTA DE PRUEBA
// =====================================================

app.get('/', (req, res) => {
  res.json({
    mensaje: 'Backend del sistema de restaurante funcionando correctamente'
  });
});

// =====================================================
// CREAR RESTAURANTE Y ADMIN INICIAL
// USAR SOLO PARA PRUEBAS O REGISTRO INICIAL
// =====================================================

app.post('/crear-admin-inicial', registroLimiter, async (req, res) => {
  const connection = await db.getConnection();

  try {
    const {
      nombre_restaurante,
      telefono,
      direccion,
      nit,
      nombre_admin,
      usuario,
      password
    } = req.body;

    if (!nombre_restaurante || !nombre_admin || !usuario || !password) {
      connection.release();

      return res.status(400).json({
        mensaje: 'Faltan datos obligatorios'
      });
    }

    if (!validarPassword(password)) {
      connection.release();

      return res.status(400).json({
        mensaje: 'La contraseña debe tener al menos 8 caracteres'
      });
    }

    await connection.beginTransaction();

    const [restauranteResult] = await connection.query(
      `
      INSERT INTO restaurantes (
        nombre,
        telefono,
        direccion,
        nit
      ) VALUES (?, ?, ?, ?)
      `,
      [
        nombre_restaurante.trim(),
        telefono || null,
        direccion || null,
        nit || 'CF'
      ]
    );

    const idRestaurante = restauranteResult.insertId;

    const passwordHash = await bcrypt.hash(password, 10);

    await connection.query(
      `
      INSERT INTO usuarios (
        id_restaurante,
        nombre,
        usuario,
        password,
        rol,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        idRestaurante,
        nombre_admin.trim(),
        usuario.trim(),
        passwordHash,
        'ADMINISTRADOR',
        1
      ]
    );

    await connection.query(
      `
      INSERT INTO configuracion_restaurante (
        id_restaurante,
        cobra_propina,
        porcentaje_propina,
        moneda
      ) VALUES (?, ?, ?, ?)
      `,
      [idRestaurante, 0, 0, 'Q']
    );

    await connection.commit();
    connection.release();

    return res.status(201).json({
      mensaje: 'Restaurante y administrador creados correctamente',
      restaurante: {
        id_restaurante: idRestaurante,
        nombre: nombre_restaurante
      },
      usuario: {
        nombre: nombre_admin,
        usuario,
        rol: 'ADMINISTRADOR'
      }
    });

  } catch (error) {
    await connection.rollback();
    connection.release();

    console.error('Error creando administrador inicial:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        mensaje: 'Ese usuario ya existe'
      });
    }

    return res.status(500).json({
      mensaje: 'Error creando restaurante y administrador'
    });
  }
});

// =====================================================
// LOGIN
// =====================================================

app.post('/login', loginLimiter, async (req, res) => {
  try {
    const { usuario, password } = req.body;

    if (!usuario || !password) {
      return res.status(400).json({
        mensaje: 'Usuario y contraseña son obligatorios'
      });
    }

    const [rows] = await db.query(
      `
      SELECT 
        u.id_usuario,
        u.id_restaurante,
        u.nombre,
        u.usuario,
        u.password,
        u.rol,
        u.estado AS estado_usuario,
        r.nombre AS nombre_restaurante,
        r.estado AS estado_restaurante
      FROM usuarios u
      INNER JOIN restaurantes r 
        ON u.id_restaurante = r.id_restaurante
      WHERE u.usuario = ?
      LIMIT 1
      `,
      [usuario.trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        mensaje: 'Usuario o contraseña incorrectos'
      });
    }

    const usuarioEncontrado = rows[0];

    if (Number(usuarioEncontrado.estado_usuario) !== 1) {
      return res.status(403).json({
        mensaje: 'Este usuario está desactivado'
      });
    }

    if (Number(usuarioEncontrado.estado_restaurante) !== 1) {
      return res.status(403).json({
        mensaje: 'Este restaurante está desactivado'
      });
    }

    const passwordValido = await bcrypt.compare(
      password,
      usuarioEncontrado.password
    );

    if (!passwordValido) {
      return res.status(401).json({
        mensaje: 'Usuario o contraseña incorrectos'
      });
    }

    const token = jwt.sign(
      {
        id_usuario: usuarioEncontrado.id_usuario,
        id_restaurante: usuarioEncontrado.id_restaurante,
        nombre: usuarioEncontrado.nombre,
        usuario: usuarioEncontrado.usuario,
        rol: usuarioEncontrado.rol,
        nombre_restaurante: usuarioEncontrado.nombre_restaurante
      },
      JWT_SECRET,
      {
        expiresIn: '8h'
      }
    );

    return res.json({
      mensaje: 'Login exitoso',
      token,
      usuario: {
        id_usuario: usuarioEncontrado.id_usuario,
        id_restaurante: usuarioEncontrado.id_restaurante,
        nombre: usuarioEncontrado.nombre,
        usuario: usuarioEncontrado.usuario,
        rol: usuarioEncontrado.rol,
        nombre_restaurante: usuarioEncontrado.nombre_restaurante
      }
    });

  } catch (error) {
    console.error('Error en login:', error);

    return res.status(500).json({
      mensaje: 'Error en el servidor'
    });
  }
});
// =====================================================
// VALIDAR SESIÓN
// =====================================================

// =====================================================
// REGISTRO DE RESTAURANTE
// =====================================================

app.post('/registro-restaurante', registroLimiter, async (req, res) => {
  const connection = await db.getConnection();

  try {
    const {
      nombre_restaurante,
      propietario,
      telefono,
      correo,
      direccion,
      nit,
      tipo_restaurante,
      descripcion,
      nombre_admin,
      usuario,
      password
    } = req.body;

    if (!nombre_restaurante || !propietario || !telefono || !nombre_admin || !usuario || !password) {
      connection.release();

      return res.status(400).json({
        mensaje: 'Faltan datos obligatorios'
      });
    }

    if (!validarPassword(password)) {
      connection.release();

      return res.status(400).json({
        mensaje: 'La contraseña debe tener al menos 8 caracteres'
      });
    }

    await connection.beginTransaction();

    const [restauranteResult] = await connection.query(
      `
  INSERT INTO restaurantes (
    nombre,
    propietario,
    telefono,
    correo,
    direccion,
    nit,
    tipo_restaurante,
    descripcion,
    estado
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
      [
        nombre_restaurante.trim(),
        propietario.trim(),
        telefono.trim(),
        correo || null,
        direccion || null,
        nit || 'CF',
        tipo_restaurante || null,
        descripcion || null,
        1
      ]
    );

    const idRestaurante = restauranteResult.insertId;

    const passwordHash = await bcrypt.hash(password, 10);

    await connection.query(
      `
      INSERT INTO usuarios (
        id_restaurante,
        nombre,
        usuario,
        password,
        rol,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        idRestaurante,
        nombre_admin.trim(),
        usuario.trim(),
        passwordHash,
        'ADMINISTRADOR',
        1
      ]
    );

    await connection.query(
      `
      INSERT INTO configuracion_restaurante (
        id_restaurante,
        cobra_propina,
        porcentaje_propina,
        imprime_comanda,
        imprime_ticket,
        moneda
      ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        idRestaurante,
        0,
        0,
        0,
        0,
        'Q'
      ]
    );

    await connection.query(
      `
      INSERT INTO categorias (id_restaurante, nombre) VALUES
      (?, 'Comidas'),
      (?, 'Bebidas'),
      (?, 'Postres'),
      (?, 'Promociones'),
      (?, 'Extras')
      `,
      [
        idRestaurante,
        idRestaurante,
        idRestaurante,
        idRestaurante,
        idRestaurante
      ]
    );

    await connection.query(
      `
      INSERT INTO mesas (id_restaurante, numero_mesa, capacidad, estado) VALUES
      (?, '1', 4, 'libre'),
      (?, '2', 4, 'libre'),
      (?, '3', 4, 'libre'),
      (?, '4', 4, 'libre'),
      (?, '5', 4, 'libre'),
      (?, '6', 4, 'libre'),
      (?, '7', 4, 'libre'),
      (?, '8', 4, 'libre')
      `,
      [
        idRestaurante,
        idRestaurante,
        idRestaurante,
        idRestaurante,
        idRestaurante,
        idRestaurante,
        idRestaurante,
        idRestaurante
      ]
    );

    await connection.commit();
    connection.release();

    return res.status(201).json({
      mensaje: 'Restaurante registrado correctamente',
      restaurante: {
        id_restaurante: idRestaurante,
        nombre: nombre_restaurante,
        propietario,
        telefono,
        correo,
        tipo_restaurante,
        descripcion
      },
      usuario: {
        nombre: nombre_admin,
        usuario,
        rol: 'ADMINISTRADOR'
      }
    });

  } catch (error) {
    await connection.rollback();
    connection.release();

    console.error('Error registrando restaurante:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        mensaje: 'Ya existe un registro con esos datos'
      });
    }

    return res.status(500).json({
      mensaje: 'Error registrando restaurante'
    });
  }
});

app.get('/validar-sesion',
  verificarToken,
  verificarUsuarioActivo,
  async (req, res) => {
    try {
      return res.json({
        mensaje: 'Sesión válida',
        usuario: req.user
      });
    } catch (error) {
      console.error('Error validando sesión:', error);

      return res.status(500).json({
        mensaje: 'Error validando sesión'
      });
    }
  }
);

// =====================================================
// OBTENER DATOS DEL RESTAURANTE ACTUAL
// =====================================================

app.get('/mi-restaurante', verificarToken, verificarUsuarioActivo, async (req, res) => {
  try {
    const idRestaurante = obtenerIdRestaurante(req, res);
    if (!idRestaurante) return;

    const [rows] = await db.query(
      `
        SELECT 
          id_restaurante,
          nombre,
          telefono,
          direccion,
          nit,
          logo,
          estado,
          fecha_creacion
        FROM restaurantes
        WHERE id_restaurante = ?
        LIMIT 1
        `,
      [idRestaurante]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        mensaje: 'Restaurante no encontrado'
      });
    }

    return res.json(rows[0]);

  } catch (error) {
    console.error('Error obteniendo restaurante:', error);

    return res.status(500).json({
      mensaje: 'Error obteniendo datos del restaurante'
    });
  }
}
);

// =====================================================
// RECUPERACIÓN - SOLICITAR CÓDIGO
// Usa el correo registrado en la tabla restaurantes
// =====================================================

app.post('/recuperar-acceso/solicitar', async (req, res) => {
  try {
    const { correo } = req.body;

    if (!correo || !correo.trim()) {
      return res.status(400).json({
        mensaje: 'El correo es obligatorio'
      });
    }

    const correoLimpio = correo.trim().toLowerCase();

    const [usuarios] = await db.query(
      `
      SELECT 
        u.id_usuario,
        u.id_restaurante,
        u.nombre,
        u.usuario,
        u.estado,
        u.rol,

        r.nombre AS nombre_restaurante,
        r.correo AS correo_restaurante,
        r.estado AS estado_restaurante

      FROM usuarios u
      INNER JOIN restaurantes r
        ON u.id_restaurante = r.id_restaurante

      WHERE LOWER(r.correo) = ?
      AND u.rol = 'ADMINISTRADOR'

      LIMIT 1
      `,
      [correoLimpio]
    );

    if (usuarios.length === 0) {
      return res.json({
        mensaje: 'Si el correo está registrado, recibirás un código de recuperación.'
      });
    }

    const usuario = usuarios[0];

    if (Number(usuario.estado) !== 1 || Number(usuario.estado_restaurante) !== 1) {
      return res.json({
        mensaje: 'Si el correo está registrado, recibirás un código de recuperación.'
      });
    }

    const codigo = generarCodigoRecuperacion();

    const fechaExpira = new Date();
    fechaExpira.setMinutes(fechaExpira.getMinutes() + 10);

    await db.query(
      `
      UPDATE password_reset_codes
      SET usado = 1
      WHERE id_usuario = ?
      AND usado = 0
      `,
      [usuario.id_usuario]
    );

    await db.query(
      `
      INSERT INTO password_reset_codes (
        id_usuario,
        id_restaurante,
        correo,
        codigo,
        usado,
        fecha_expira
      ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        usuario.id_usuario,
        usuario.id_restaurante,
        correoLimpio,
        codigo,
        0,
        fechaExpira
      ]
    );

    await enviarCorreo({
      para: correoLimpio,
      asunto: 'Código de recuperación de acceso',
      html: `
        <div style="font-family:Arial, sans-serif; color:#111827;">
          <h2>Recuperación de acceso</h2>

          <p>Hola, ${usuario.nombre}.</p>

          <p>Recibimos una solicitud para recuperar el acceso a tu cuenta del sistema.</p>

          <p>
            <strong>Restaurante:</strong> ${usuario.nombre_restaurante}<br>
            <strong>Usuario:</strong> ${usuario.usuario}
          </p>

          <p>Tu código de recuperación es:</p>

          <div style="
            font-size:28px;
            font-weight:800;
            letter-spacing:4px;
            background:#f3f4f6;
            padding:14px 18px;
            border-radius:10px;
            display:inline-block;
          ">
            ${codigo}
          </div>

          <p>Este código vence en 10 minutos.</p>

          <p>Si tú no solicitaste esta recuperación, ignora este correo.</p>
        </div>
      `
    });

    return res.json({
      mensaje: 'Si el correo está registrado, recibirás un código de recuperación.'
    });

  } catch (error) {
    console.error('Error solicitando recuperación:', error);

    return res.status(500).json({
      mensaje: 'Error solicitando recuperación de acceso',
      error: error.message
    });
  }
});

// =====================================================
// RECUPERACIÓN - VERIFICAR CÓDIGO
// =====================================================

app.post('/recuperar-acceso/verificar', async (req, res) => {
  try {
    const { correo, codigo } = req.body;

    if (!correo || !correo.trim()) {
      return res.status(400).json({
        mensaje: 'El correo es obligatorio'
      });
    }

    if (!codigo || !codigo.trim()) {
      return res.status(400).json({
        mensaje: 'El código es obligatorio'
      });
    }

    const correoLimpio = correo.trim().toLowerCase();
    const codigoLimpio = codigo.trim();

    const [rows] = await db.query(
      `
      SELECT 
        pr.id_reset,
        pr.id_usuario,
        pr.id_restaurante,
        pr.correo,
        pr.codigo,
        pr.usado,
        pr.fecha_expira,
        u.nombre,
        u.usuario
      FROM password_reset_codes pr
      INNER JOIN usuarios u
        ON pr.id_usuario = u.id_usuario
      WHERE LOWER(pr.correo) = ?
      AND pr.codigo = ?
      AND pr.usado = 0
      AND pr.fecha_expira > NOW()
      ORDER BY pr.fecha_creacion DESC
      LIMIT 1
      `,
      [correoLimpio, codigoLimpio]
    );

    if (rows.length === 0) {
      return res.status(400).json({
        mensaje: 'El código no es válido o ya expiró'
      });
    }

    const reset = rows[0];
    const tokenTemporal = generarTokenTemporal();

    const nuevaFechaExpira = new Date();
    nuevaFechaExpira.setMinutes(nuevaFechaExpira.getMinutes() + 10);

    await db.query(
      `
      UPDATE password_reset_codes
      SET 
        token_temporal = ?,
        fecha_expira = ?
      WHERE id_reset = ?
      `,
      [
        tokenTemporal,
        nuevaFechaExpira,
        reset.id_reset
      ]
    );

    return res.json({
      mensaje: 'Código verificado correctamente',
      token_temporal: tokenTemporal,
      usuario: reset.usuario,
      nombre: reset.nombre
    });

  } catch (error) {
    console.error('Error verificando código:', error);

    return res.status(500).json({
      mensaje: 'Error verificando código de recuperación'
    });
  }
});
// =====================================================
// RECUPERACIÓN - CAMBIAR CONTRASEÑA
// Usa el correo guardado en password_reset_codes
// =====================================================

app.post('/recuperar-acceso/cambiar-password', async (req, res) => {
  const connection = await db.getConnection();

  try {
    const {
      token_temporal,
      nueva_password,
      confirmar_password
    } = req.body;

    if (!token_temporal) {
      connection.release();
      return res.status(400).json({
        mensaje: 'Token de recuperación requerido'
      });
    }

    if (!nueva_password || !confirmar_password) {
      connection.release();
      return res.status(400).json({
        mensaje: 'Debes ingresar y confirmar la nueva contraseña'
      });
    }

    if (nueva_password !== confirmar_password) {
      connection.release();
      return res.status(400).json({
        mensaje: 'Las contraseñas no coinciden'
      });
    }

    if (nueva_password.length < 8) {
      connection.release();
      return res.status(400).json({
        mensaje: 'La contraseña debe tener al menos 8 caracteres'
      });
    }

    await connection.beginTransaction();

    const [rows] = await connection.query(
      `
      SELECT 
        pr.id_reset,
        pr.id_usuario,
        pr.id_restaurante,
        pr.correo,
        pr.usado,
        pr.fecha_expira,
        u.usuario,
        u.nombre
      FROM password_reset_codes pr
      INNER JOIN usuarios u
        ON pr.id_usuario = u.id_usuario
      WHERE pr.token_temporal = ?
      AND pr.usado = 0
      AND pr.fecha_expira > NOW()
      LIMIT 1
      FOR UPDATE
      `,
      [token_temporal]
    );

    if (rows.length === 0) {
      await connection.rollback();
      connection.release();

      return res.status(400).json({
        mensaje: 'La solicitud de recuperación no es válida o ya expiró'
      });
    }

    const reset = rows[0];

    const passwordHash = await bcrypt.hash(nueva_password, 10);

    await connection.query(
      `
      UPDATE usuarios
      SET password = ?
      WHERE id_usuario = ?
      `,
      [
        passwordHash,
        reset.id_usuario
      ]
    );

    await connection.query(
      `
      UPDATE password_reset_codes
      SET usado = 1
      WHERE id_reset = ?
      `,
      [reset.id_reset]
    );

    await connection.commit();
    connection.release();

    try {
      await enviarCorreo({
        para: reset.correo,
        asunto: 'Contraseña actualizada',
        html: `
          <div style="font-family:Arial, sans-serif; color:#111827;">
            <h2>Contraseña actualizada</h2>

            <p>Hola, ${reset.nombre}.</p>

            <p>Tu contraseña fue actualizada correctamente.</p>

            <p>
              <strong>Usuario:</strong> ${reset.usuario}
            </p>

            <p>
              Si tú no hiciste este cambio, contacta inmediatamente al administrador del sistema.
            </p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('No se pudo enviar correo de confirmación:', emailError);
    }

    return res.json({
      mensaje: 'Contraseña actualizada correctamente'
    });

  } catch (error) {
    await connection.rollback();
    connection.release();

    console.error('Error cambiando contraseña:', error);

    return res.status(500).json({
      mensaje: 'Error cambiando contraseña',
      error: error.message
    });
  }
});

// =====================================================
// DASHBOARD RESTAURANTE - RESUMEN MENSUAL
// =====================================================

app.get( '/dashboard/resumen',
  verificarToken,
  verificarUsuarioActivo,
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const fechaActual = new Date();
      const anio = Number(req.query.anio) || fechaActual.getFullYear();
      const mes = Number(req.query.mes) || fechaActual.getMonth() + 1;

      const fechaInicio = `${anio}-${String(mes).padStart(2, '0')}-01`;
      const fechaFin = new Date(anio, mes, 1).toISOString().slice(0, 10);

      const [[mesas]] = await db.query(
        `
        SELECT 
          COUNT(*) AS total_mesas,
          SUM(CASE WHEN estado = 'libre' THEN 1 ELSE 0 END) AS mesas_libres,
          SUM(CASE WHEN estado = 'ocupada' THEN 1 ELSE 0 END) AS mesas_ocupadas,
          SUM(CASE WHEN estado = 'reservada' THEN 1 ELSE 0 END) AS mesas_reservadas
        FROM mesas
        WHERE id_restaurante = ?
        `,
        [idRestaurante]
      );

      const [[pedidos]] = await db.query(
        `
        SELECT 
          COUNT(*) AS pedidos_mes,

          SUM(CASE 
            WHEN DATE(fecha_pedido) = CURDATE() 
            THEN 1 ELSE 0 
          END) AS pedidos_hoy,

          SUM(CASE 
            WHEN estado IN ('abierto', 'en_cocina', 'preparando', 'listo', 'entregado') 
            THEN 1 ELSE 0 
          END) AS pedidos_activos,

          SUM(CASE 
            WHEN estado IN ('en_cocina', 'preparando') 
            THEN 1 ELSE 0 
          END) AS pedidos_en_cocina,

          SUM(CASE 
            WHEN estado = 'listo' 
            THEN 1 ELSE 0 
          END) AS pedidos_listos,

          SUM(CASE 
            WHEN estado = 'pagado' 
            THEN 1 ELSE 0 
          END) AS pedidos_pagados,

          SUM(CASE 
            WHEN estado = 'cancelado' 
            THEN 1 ELSE 0 
          END) AS pedidos_cancelados,

          SUM(CASE 
            WHEN estado = 'pagado' 
            AND DATE(fecha_pagado) = CURDATE()
            THEN total ELSE 0 
          END) AS ventas_hoy,

          SUM(CASE 
            WHEN estado = 'pagado' 
            THEN total ELSE 0 
          END) AS ventas_mes,

          SUM(saldo_pendiente) AS saldo_pendiente_total

        FROM pedidos
        WHERE id_restaurante = ?
        AND fecha_pedido >= ?
        AND fecha_pedido < ?
        `,
        [idRestaurante, fechaInicio, fechaFin]
      );

      const [[pagos]] = await db.query(
        `
        SELECT 
          SUM(monto) AS pagos_recibidos_mes
        FROM pagos
        WHERE id_restaurante = ?
        AND fecha_pago >= ?
        AND fecha_pago < ?
        `,
        [idRestaurante, fechaInicio, fechaFin]
      );

      const [[productos]] = await db.query(
        `
        SELECT 
          COUNT(*) AS total_productos
        FROM productos
        WHERE id_restaurante = ?
        AND estado = 1
        `,
        [idRestaurante]
      );

      const [[clientes]] = await db.query(
        `
        SELECT 
          COUNT(*) AS total_clientes
        FROM clientes
        WHERE id_restaurante = ?
        AND estado = 1
        `,
        [idRestaurante]
      );

      const [ultimosPedidos] = await db.query(
        `
        SELECT 
          p.id_pedido,
          p.tipo_pedido,
          p.fecha_pedido,
          p.estado,
          p.total,
          p.saldo_pendiente,
          p.cliente_nombre,
          p.cliente_telefono,
          c.nombre AS cliente_registrado,
          m.numero_mesa
        FROM pedidos p
        LEFT JOIN clientes c
          ON p.id_cliente = c.id_cliente
        LEFT JOIN mesas m
          ON p.id_mesa = m.id_mesa
        WHERE p.id_restaurante = ?
        AND p.fecha_pedido >= ?
        AND p.fecha_pedido < ?
        ORDER BY p.fecha_pedido DESC
        LIMIT 10
        `,
        [idRestaurante, fechaInicio, fechaFin]
      );

      const ultimosPedidosFormateados = ultimosPedidos.map((pedido) => ({
        id_pedido: pedido.id_pedido,
        tipo_pedido: pedido.tipo_pedido,
        numero_mesa: pedido.numero_mesa,
        cliente: pedido.cliente_nombre || pedido.cliente_registrado || 'Consumidor final',
        telefono: pedido.cliente_telefono || '',
        fecha_pedido: pedido.fecha_pedido,
        estado: pedido.estado,
        total: Number(pedido.total || 0),
        saldo_pendiente: Number(pedido.saldo_pendiente || 0)
      }));

      return res.json({
        resumen: {
          total_mesas: Number(mesas.total_mesas || 0),
          mesas_libres: Number(mesas.mesas_libres || 0),
          mesas_ocupadas: Number(mesas.mesas_ocupadas || 0),
          mesas_reservadas: Number(mesas.mesas_reservadas || 0),

          pedidos_hoy: Number(pedidos.pedidos_hoy || 0),
          pedidos_mes: Number(pedidos.pedidos_mes || 0),
          pedidos_activos: Number(pedidos.pedidos_activos || 0),
          pedidos_en_cocina: Number(pedidos.pedidos_en_cocina || 0),
          pedidos_listos: Number(pedidos.pedidos_listos || 0),
          pedidos_pagados: Number(pedidos.pedidos_pagados || 0),
          pedidos_cancelados: Number(pedidos.pedidos_cancelados || 0),

          ventas_hoy: Number(pedidos.ventas_hoy || 0),
          ventas_mes: Number(pedidos.ventas_mes || 0),
          pagos_recibidos_mes: Number(pagos.pagos_recibidos_mes || 0),
          saldo_pendiente_total: Number(pedidos.saldo_pendiente_total || 0),

          total_productos: Number(productos.total_productos || 0),
          total_clientes: Number(clientes.total_clientes || 0)
        },
        ultimos_pedidos: ultimosPedidosFormateados
      });

    } catch (error) {
      console.error('Error obteniendo resumen del dashboard:', error);

      return res.status(500).json({
        mensaje: 'Error obteniendo resumen del dashboard'
      });
    }
  }
);
// =====================================================
// MESAS - LISTAR
// =====================================================

app.get('/mesas',
  verificarToken,
  verificarUsuarioActivo,
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const [mesas] = await db.query(
        `
        SELECT 
          id_mesa,
          id_restaurante,
          numero_mesa,
          descripcion,
          capacidad,
          estado,
          fecha_creacion
        FROM mesas
        WHERE id_restaurante = ?
        ORDER BY CAST(numero_mesa AS UNSIGNED), numero_mesa
        `,
        [idRestaurante]
      );

      return res.json(mesas);

    } catch (error) {
      console.error('Error obteniendo mesas:', error);

      return res.status(500).json({
        mensaje: 'Error obteniendo mesas'
      });
    }
  }
);

// =====================================================
// MESAS - CREAR
// =====================================================

app.post('/mesas',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const {
        numero_mesa,
        descripcion,
        capacidad
      } = req.body;

      if (!numero_mesa || !numero_mesa.toString().trim()) {
        return res.status(400).json({
          mensaje: 'El número de mesa es obligatorio'
        });
      }

      const [result] = await db.query(
        `
        INSERT INTO mesas (
          id_restaurante,
          numero_mesa,
          descripcion,
          capacidad,
          estado
        ) VALUES (?, ?, ?, ?, ?)
        `,
        [
          idRestaurante,
          numero_mesa.toString().trim(),
          descripcion || null,
          Number(capacidad || 4),
          'libre'
        ]
      );

      return res.status(201).json({
        mensaje: 'Mesa creada correctamente',
        id_mesa: result.insertId
      });

    } catch (error) {
      console.error('Error creando mesa:', error);

      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          mensaje: 'Ya existe una mesa con ese número'
        });
      }

      return res.status(500).json({
        mensaje: 'Error creando mesa'
      });
    }
  }
);

// =====================================================
// MESAS - ACTUALIZAR
// =====================================================

app.put('/mesas/:id_mesa',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const { id_mesa } = req.params;

      const {
        numero_mesa,
        descripcion,
        capacidad,
        estado
      } = req.body;

      if (!numero_mesa || !numero_mesa.toString().trim()) {
        return res.status(400).json({
          mensaje: 'El número de mesa es obligatorio'
        });
      }

      const estadosPermitidos = ['libre', 'ocupada', 'reservada', 'en_limpieza'];

      if (estado && !estadosPermitidos.includes(estado)) {
        return res.status(400).json({
          mensaje: 'Estado de mesa no válido'
        });
      }

      const [result] = await db.query(
        `
        UPDATE mesas
        SET 
          numero_mesa = ?,
          descripcion = ?,
          capacidad = ?,
          estado = ?
        WHERE id_mesa = ?
        AND id_restaurante = ?
        `,
        [
          numero_mesa.toString().trim(),
          descripcion || null,
          Number(capacidad || 4),
          estado || 'libre',
          id_mesa,
          idRestaurante
        ]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          mensaje: 'Mesa no encontrada'
        });
      }

      return res.json({
        mensaje: 'Mesa actualizada correctamente'
      });

    } catch (error) {
      console.error('Error actualizando mesa:', error);

      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          mensaje: 'Ya existe una mesa con ese número'
        });
      }

      return res.status(500).json({
        mensaje: 'Error actualizando mesa'
      });
    }
  }
);

// =====================================================
// MESAS - CAMBIAR ESTADO
// =====================================================

app.patch('/mesas/:id_mesa/estado',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA', 'MESERO'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const { id_mesa } = req.params;
      const { estado } = req.body;

      const estadosPermitidos = ['libre', 'ocupada', 'reservada', 'en_limpieza'];

      if (!estado || !estadosPermitidos.includes(estado)) {
        return res.status(400).json({
          mensaje: 'Estado de mesa no válido'
        });
      }

      const [result] = await db.query(
        `
        UPDATE mesas
        SET estado = ?
        WHERE id_mesa = ?
        AND id_restaurante = ?
        `,
        [estado, id_mesa, idRestaurante]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          mensaje: 'Mesa no encontrada'
        });
      }

      return res.json({
        mensaje: 'Estado de mesa actualizado correctamente'
      });

    } catch (error) {
      console.error('Error cambiando estado de mesa:', error);

      return res.status(500).json({
        mensaje: 'Error cambiando estado de mesa'
      });
    }
  }
);

// =====================================================
// MESAS - ELIMINAR
// =====================================================

app.delete('/mesas/:id_mesa',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const { id_mesa } = req.params;

      const [mesa] = await db.query(
        `
        SELECT estado
        FROM mesas
        WHERE id_mesa = ?
        AND id_restaurante = ?
        LIMIT 1
        `,
        [id_mesa, idRestaurante]
      );

      if (mesa.length === 0) {
        return res.status(404).json({
          mensaje: 'Mesa no encontrada'
        });
      }

      if (mesa[0].estado === 'ocupada') {
        return res.status(400).json({
          mensaje: 'No puedes eliminar una mesa ocupada'
        });
      }

      const [pedidoActivo] = await db.query(
        `
        SELECT id_pedido
        FROM pedidos
        WHERE id_mesa = ?
        AND id_restaurante = ?
        AND estado IN ('abierto', 'en_cocina', 'preparando', 'listo', 'entregado')
        LIMIT 1
        `,
        [id_mesa, idRestaurante]
      );

      if (pedidoActivo.length > 0) {
        return res.status(400).json({
          mensaje: 'No puedes eliminar una mesa con pedido activo'
        });
      }

      await db.query(
        `
        DELETE FROM mesas
        WHERE id_mesa = ?
        AND id_restaurante = ?
        `,
        [id_mesa, idRestaurante]
      );

      return res.json({
        mensaje: 'Mesa eliminada correctamente'
      });

    } catch (error) {
      console.error('Error eliminando mesa:', error);

      return res.status(500).json({
        mensaje: 'Error eliminando mesa'
      });
    }
  }
);

// =====================================================
// CATEGORÍAS - LISTAR
// =====================================================

app.get(
  '/categorias',
  verificarToken,
  verificarUsuarioActivo,
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const [categorias] = await db.query(
        `
        SELECT 
          id_categoria,
          nombre,
          descripcion,
          estado
        FROM categorias
        WHERE id_restaurante = ?
        AND estado = 1
        ORDER BY nombre ASC
        `,
        [idRestaurante]
      );

      return res.json(categorias);

    } catch (error) {
      console.error('Error obteniendo categorías:', error);

      return res.status(500).json({
        mensaje: 'Error obteniendo categorías'
      });
    }
  }
);

// =====================================================
// CATEGORÍAS - CREAR
// =====================================================

app.post('/categorias',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const { nombre, descripcion } = req.body;

      if (!nombre) {
        return res.status(400).json({
          mensaje: 'El nombre de la categoría es obligatorio'
        });
      }

      const [result] = await db.query(
        `
        INSERT INTO categorias (
          id_restaurante,
          nombre,
          descripcion,
          estado
        ) VALUES (?, ?, ?, ?)
        `,
        [
          idRestaurante,
          nombre.trim(),
          descripcion || null,
          1
        ]
      );

      return res.status(201).json({
        mensaje: 'Categoría creada correctamente',
        id_categoria: result.insertId
      });

    } catch (error) {
      console.error('Error creando categoría:', error);

      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          mensaje: 'Ya existe una categoría con ese nombre'
        });
      }

      return res.status(500).json({
        mensaje: 'Error creando categoría'
      });
    }
  }
);

// =====================================================
// CATEGORÍAS - ACTUALIZAR
// =====================================================

app.put('/categorias/:id_categoria',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const { id_categoria } = req.params;
      const { nombre, descripcion, estado } = req.body;

      if (!nombre || !nombre.trim()) {
        return res.status(400).json({
          mensaje: 'El nombre de la categoría es obligatorio'
        });
      }

      const [result] = await db.query(
        `
        UPDATE categorias
        SET 
          nombre = ?,
          descripcion = ?,
          estado = ?
        WHERE id_categoria = ?
        AND id_restaurante = ?
        `,
        [
          nombre.trim(),
          descripcion || null,
          Number(estado) === 0 ? 0 : 1,
          id_categoria,
          idRestaurante
        ]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          mensaje: 'Categoría no encontrada'
        });
      }

      return res.json({
        mensaje: 'Categoría actualizada correctamente'
      });

    } catch (error) {
      console.error('Error actualizando categoría:', error);

      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          mensaje: 'Ya existe una categoría con ese nombre'
        });
      }

      return res.status(500).json({
        mensaje: 'Error actualizando categoría'
      });
    }
  }
);

// =====================================================
// CATEGORÍAS - CAMBIAR ESTADO
// =====================================================

app.patch('/categorias/:id_categoria/estado',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const { id_categoria } = req.params;
      const { estado } = req.body;

      const nuevoEstado = Number(estado) === 1 ? 1 : 0;

      const [result] = await db.query(
        `
        UPDATE categorias
        SET estado = ?
        WHERE id_categoria = ?
        AND id_restaurante = ?
        `,
        [nuevoEstado, id_categoria, idRestaurante]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          mensaje: 'Categoría no encontrada'
        });
      }

      return res.json({
        mensaje: nuevoEstado === 1
          ? 'Categoría activada correctamente'
          : 'Categoría desactivada correctamente'
      });

    } catch (error) {
      console.error('Error cambiando estado de categoría:', error);

      return res.status(500).json({
        mensaje: 'Error cambiando estado de categoría'
      });
    }
  }
);

// =====================================================
// CATEGORÍAS - ELIMINAR
// =====================================================

app.delete('/categorias/:id_categoria',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const { id_categoria } = req.params;

      const [productos] = await db.query(
        `
        SELECT id_producto
        FROM productos
        WHERE id_categoria = ?
        AND id_restaurante = ?
        LIMIT 1
        `,
        [id_categoria, idRestaurante]
      );

      if (productos.length > 0) {
        return res.status(400).json({
          mensaje: 'No puedes eliminar esta categoría porque tiene productos asignados. Puedes desactivarla.'
        });
      }

      const [result] = await db.query(
        `
        DELETE FROM categorias
        WHERE id_categoria = ?
        AND id_restaurante = ?
        `,
        [id_categoria, idRestaurante]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          mensaje: 'Categoría no encontrada'
        });
      }

      return res.json({
        mensaje: 'Categoría eliminada correctamente'
      });

    } catch (error) {
      console.error('Error eliminando categoría:', error);

      return res.status(500).json({
        mensaje: 'Error eliminando categoría'
      });
    }
  }
);

// =====================================================
// PRODUCTOS - LISTAR
// =====================================================

app.get(
  '/productos',
  verificarToken,
  verificarUsuarioActivo,
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const [productos] = await db.query(
        `
        SELECT 
          p.id_producto,
          p.id_restaurante,
          p.id_categoria,
          c.nombre AS categoria,
          p.nombre,
          p.descripcion,
          p.precio,
          p.costo,
          p.imagen,
          p.maneja_inventario,
          p.stock,
          p.estado,
          p.fecha_creacion
        FROM productos p
        LEFT JOIN categorias c
          ON p.id_categoria = c.id_categoria
        WHERE p.id_restaurante = ?
        ORDER BY p.estado DESC, c.nombre ASC, p.nombre ASC
        `,
        [idRestaurante]
      );

      return res.json(productos);

    } catch (error) {
      console.error('Error obteniendo productos:', error);

      return res.status(500).json({
        mensaje: 'Error obteniendo productos'
      });
    }
  }
);

// =====================================================
// PRODUCTOS - CREAR
// =====================================================

app.post(
  '/productos',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const {
        id_categoria,
        nombre,
        descripcion,
        precio,
        costo,
        imagen,
        maneja_inventario,
        stock
      } = req.body;

      if (!nombre || !nombre.trim()) {
        return res.status(400).json({
          mensaje: 'El nombre del producto es obligatorio'
        });
      }

      if (precio === undefined || precio === null || Number(precio) < 0) {
        return res.status(400).json({
          mensaje: 'El precio no es válido'
        });
      }

      const [result] = await db.query(
        `
        INSERT INTO productos (
          id_restaurante,
          id_categoria,
          nombre,
          descripcion,
          precio,
          costo,
          imagen,
          maneja_inventario,
          stock,
          estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          idRestaurante,
          id_categoria || null,
          nombre.trim(),
          descripcion || null,
          Number(precio),
          Number(costo || 0),
          imagen || null,
          Number(maneja_inventario) === 1 ? 1 : 0,
          Number(stock || 0),
          1
        ]
      );

      return res.status(201).json({
        mensaje: 'Producto creado correctamente',
        id_producto: result.insertId
      });

    } catch (error) {
      console.error('Error creando producto:', error);

      return res.status(500).json({
        mensaje: 'Error creando producto'
      });
    }
  }
);

// =====================================================
// PRODUCTOS - ACTUALIZAR
// =====================================================

app.put(
  '/productos/:id_producto',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const { id_producto } = req.params;

      const {
        id_categoria,
        nombre,
        descripcion,
        precio,
        costo,
        imagen,
        maneja_inventario,
        stock,
        estado
      } = req.body;

      if (!nombre || !nombre.trim()) {
        return res.status(400).json({
          mensaje: 'El nombre del producto es obligatorio'
        });
      }

      if (precio === undefined || precio === null || Number(precio) < 0) {
        return res.status(400).json({
          mensaje: 'El precio no es válido'
        });
      }

      const [result] = await db.query(
        `
        UPDATE productos
        SET 
          id_categoria = ?,
          nombre = ?,
          descripcion = ?,
          precio = ?,
          costo = ?,
          imagen = ?,
          maneja_inventario = ?,
          stock = ?,
          estado = ?
        WHERE id_producto = ?
        AND id_restaurante = ?
        `,
        [
          id_categoria || null,
          nombre.trim(),
          descripcion || null,
          Number(precio),
          Number(costo || 0),
          imagen || null,
          Number(maneja_inventario) === 1 ? 1 : 0,
          Number(stock || 0),
          Number(estado) === 0 ? 0 : 1,
          id_producto,
          idRestaurante
        ]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          mensaje: 'Producto no encontrado'
        });
      }

      return res.json({
        mensaje: 'Producto actualizado correctamente'
      });

    } catch (error) {
      console.error('Error actualizando producto:', error);

      return res.status(500).json({
        mensaje: 'Error actualizando producto'
      });
    }
  }
);

// =====================================================
// PRODUCTOS - CAMBIAR ESTADO
// =====================================================

app.patch('/productos/:id_producto/estado',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const { id_producto } = req.params;
      const { estado } = req.body;

      const nuevoEstado = Number(estado) === 1 ? 1 : 0;

      const [result] = await db.query(
        `
        UPDATE productos
        SET estado = ?
        WHERE id_producto = ?
        AND id_restaurante = ?
        `,
        [nuevoEstado, id_producto, idRestaurante]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          mensaje: 'Producto no encontrado'
        });
      }

      return res.json({
        mensaje: nuevoEstado === 1
          ? 'Producto activado correctamente'
          : 'Producto desactivado correctamente'
      });

    } catch (error) {
      console.error('Error cambiando estado del producto:', error);

      return res.status(500).json({
        mensaje: 'Error cambiando estado del producto'
      });
    }
  }
);

// =====================================================
// PRODUCTOS - ELIMINAR
// =====================================================

app.delete('/productos/:id_producto',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const { id_producto } = req.params;

      const [usado] = await db.query(
        `
        SELECT id_detalle
        FROM pedido_detalle
        WHERE id_producto = ?
        LIMIT 1
        `,
        [id_producto]
      );

      if (usado.length > 0) {
        return res.status(400).json({
          mensaje: 'No puedes eliminar este producto porque ya fue usado en pedidos. Puedes desactivarlo.'
        });
      }

      const [result] = await db.query(
        `
        DELETE FROM productos
        WHERE id_producto = ?
        AND id_restaurante = ?
        `,
        [id_producto, idRestaurante]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          mensaje: 'Producto no encontrado'
        });
      }

      return res.json({
        mensaje: 'Producto eliminado correctamente'
      });

    } catch (error) {
      console.error('Error eliminando producto:', error);

      return res.status(500).json({
        mensaje: 'Error eliminando producto'
      });
    }
  }
);

// =====================================================
// PRODUCTOS - SUBIR IMAGEN
// =====================================================

app.post('/productos/subir-imagen',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE'),
  (req, res) => {
    uploadProducto.single('imagen')(req, res, async (error) => {
      try {
        if (error) {
          console.error('Error de multer:', error);

          if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              mensaje: 'La imagen no debe superar 3MB'
            });
          }

          return res.status(400).json({
            mensaje: error.message || 'No se pudo subir la imagen'
          });
        }

        if (!req.file) {
          return res.status(400).json({
            mensaje: 'No se recibió ninguna imagen'
          });
        }

        const rutaImagen = `/uploads/productos/${req.file.filename}`;

        return res.json({
          mensaje: 'Imagen subida correctamente',
          imagen: rutaImagen
        });

      } catch (err) {
        console.error('Error subiendo imagen:', err);

        return res.status(500).json({
          mensaje: 'Error subiendo imagen'
        });
      }
    });
  }
);

// =====================================================
// NUEVO PEDIDO - DATOS INICIALES
// =====================================================

app.get(
  '/nuevo-pedido/datos',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA', 'MESERO'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const [mesas] = await db.query(
        `
        SELECT 
          id_mesa,
          numero_mesa,
          descripcion,
          capacidad,
          estado
        FROM mesas
        WHERE id_restaurante = ?
        ORDER BY CAST(numero_mesa AS UNSIGNED), numero_mesa
        `,
        [idRestaurante]
      );

      const [categorias] = await db.query(
        `
        SELECT 
          id_categoria,
          nombre
        FROM categorias
        WHERE id_restaurante = ?
        AND estado = 1
        ORDER BY nombre ASC
        `,
        [idRestaurante]
      );

      const [productos] = await db.query(
        `
        SELECT 
          p.id_producto,
          p.id_categoria,
          c.nombre AS categoria,
          p.nombre,
          p.descripcion,
          p.precio,
          p.imagen,
          p.maneja_inventario,
          p.stock,
          p.estado
        FROM productos p
        LEFT JOIN categorias c
          ON p.id_categoria = c.id_categoria
        WHERE p.id_restaurante = ?
        AND p.estado = 1
        ORDER BY c.nombre ASC, p.nombre ASC
        `,
        [idRestaurante]
      );

      return res.json({
        mesas,
        categorias,
        productos
      });

    } catch (error) {
      console.error('Error obteniendo datos para pedido:', error);

      return res.status(500).json({
        mensaje: 'Error obteniendo datos para crear pedido'
      });
    }
  }
);

// =====================================================
// PEDIDOS - CREAR NUEVO PEDIDO
// =====================================================

app.post('/pedidos',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA', 'MESERO'),
  async (req, res) => {
    const connection = await db.getConnection();

    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) {
        connection.release();
        return;
      }

      const idUsuario = req.user.id_usuario || req.user.id;

      const {
        id_mesa,
        id_cliente,
        tipo_pedido,
        cliente_nombre,
        cliente_telefono,
        direccion_delivery,
        descuento,
        propina,
        observaciones,
        productos
      } = req.body;

      if (!tipo_pedido) {
        connection.release();
        return res.status(400).json({
          mensaje: 'El tipo de pedido es obligatorio'
        });
      }

      const tiposPermitidos = ['mesa', 'para_llevar', 'delivery'];

      if (!tiposPermitidos.includes(tipo_pedido)) {
        connection.release();
        return res.status(400).json({
          mensaje: 'Tipo de pedido no válido'
        });
      }

      if (tipo_pedido === 'mesa' && !id_mesa) {
        connection.release();
        return res.status(400).json({
          mensaje: 'Debes seleccionar una mesa'
        });
      }

      if (!Array.isArray(productos) || productos.length === 0) {
        connection.release();
        return res.status(400).json({
          mensaje: 'Debes agregar al menos un producto al pedido'
        });
      }

      await connection.beginTransaction();

      if (tipo_pedido === 'mesa') {
        const [mesaRows] = await connection.query(
          `
          SELECT estado
          FROM mesas
          WHERE id_mesa = ?
          AND id_restaurante = ?
          LIMIT 1
          `,
          [id_mesa, idRestaurante]
        );

        if (mesaRows.length === 0) {
          await connection.rollback();
          connection.release();

          return res.status(404).json({
            mensaje: 'Mesa no encontrada'
          });
        }

        if (mesaRows[0].estado === 'ocupada') {
          await connection.rollback();
          connection.release();

          return res.status(400).json({
            mensaje: 'Esta mesa ya está ocupada'
          });
        }
      }

      let subtotal = 0;
      const productosValidos = [];

      for (const item of productos) {
        const cantidad = Number(item.cantidad || 0);

        if (!item.id_producto || cantidad <= 0) {
          await connection.rollback();
          connection.release();

          return res.status(400).json({
            mensaje: 'Hay productos con cantidad inválida'
          });
        }

        const [productoRows] = await connection.query(
          `
          SELECT 
            id_producto,
            nombre,
            precio,
            maneja_inventario,
            stock
          FROM productos
          WHERE id_producto = ?
          AND id_restaurante = ?
          AND estado = 1
          LIMIT 1
          `,
          [item.id_producto, idRestaurante]
        );

        if (productoRows.length === 0) {
          await connection.rollback();
          connection.release();

          return res.status(404).json({
            mensaje: 'Uno de los productos no existe o está inactivo'
          });
        }

        const producto = productoRows[0];

        if (Number(producto.maneja_inventario) === 1 && Number(producto.stock) < cantidad) {
          await connection.rollback();
          connection.release();

          return res.status(400).json({
            mensaje: `Stock insuficiente para ${producto.nombre}`
          });
        }

        const precioUnitario = Number(producto.precio || 0);
        const subtotalLinea = cantidad * precioUnitario;

        subtotal += subtotalLinea;

        productosValidos.push({
          id_producto: producto.id_producto,
          cantidad,
          precio_unitario: precioUnitario,
          subtotal: subtotalLinea,
          observaciones: item.observaciones || null,
          maneja_inventario: Number(producto.maneja_inventario),
          stock: Number(producto.stock || 0)
        });
      }

      const descuentoFinal = Number(descuento || 0);
      const propinaFinal = Number(propina || 0);
      const total = subtotal - descuentoFinal + propinaFinal;

      if (total < 0) {
        await connection.rollback();
        connection.release();

        return res.status(400).json({
          mensaje: 'El total del pedido no puede ser negativo'
        });
      }

      const [pedidoResult] = await connection.query(
        `
        INSERT INTO pedidos (
          id_restaurante,
          id_mesa,
          id_cliente,
          id_mesero,
          tipo_pedido,
          estado,
          cliente_nombre,
          cliente_telefono,
          direccion_delivery,
          subtotal,
          descuento,
          propina,
          total,
          total_pagado,
          saldo_pendiente,
          observaciones
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          idRestaurante,
          tipo_pedido === 'mesa' ? id_mesa : null,
          id_cliente || null,
          idUsuario,
          tipo_pedido,
          'en_cocina',
          cliente_nombre || null,
          cliente_telefono || null,
          direccion_delivery || null,
          subtotal,
          descuentoFinal,
          propinaFinal,
          total,
          0,
          total,
          observaciones || null
        ]
      );

      const idPedido = pedidoResult.insertId;

      for (const item of productosValidos) {
        await connection.query(
          `
          INSERT INTO pedido_detalle (
            id_pedido,
            id_producto,
            cantidad,
            precio_unitario,
            subtotal,
            observaciones,
            estado_cocina
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            idPedido,
            item.id_producto,
            item.cantidad,
            item.precio_unitario,
            item.subtotal,
            item.observaciones,
            'pendiente'
          ]
        );

        if (item.maneja_inventario === 1) {
          await connection.query(
            `
            UPDATE productos
            SET stock = stock - ?
            WHERE id_producto = ?
            AND id_restaurante = ?
            `,
            [
              item.cantidad,
              item.id_producto,
              idRestaurante
            ]
          );
        }
      }

      if (tipo_pedido === 'mesa') {
        await connection.query(
          `
          UPDATE mesas
          SET estado = 'ocupada'
          WHERE id_mesa = ?
          AND id_restaurante = ?
          `,
          [id_mesa, idRestaurante]
        );
      }

      await connection.query(
        `
        INSERT INTO bitacora_pedidos (
          id_restaurante,
          id_pedido,
          id_usuario,
          accion,
          descripcion
        ) VALUES (?, ?, ?, ?, ?)
        `,
        [
          idRestaurante,
          idPedido,
          idUsuario,
          'Pedido creado',
          'Pedido creado y enviado a cocina'
        ]
      );

      await connection.commit();
      connection.release();

      return res.status(201).json({
        mensaje: 'Pedido creado correctamente',
        id_pedido: idPedido,
        total
      });

    } catch (error) {
      await connection.rollback();
      connection.release();

      console.error('Error creando pedido:', error);

      return res.status(500).json({
        mensaje: 'Error creando pedido'
      });
    }
  }
);

// =====================================================
// COCINA - LISTAR PEDIDOS PENDIENTES
// =====================================================

app.get('/cocina/pedidos',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'COCINA', 'CAJA', 'MESERO'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const [pedidos] = await db.query(
        `
        SELECT 
          p.id_pedido,
          p.id_mesa,
          m.numero_mesa,
          p.tipo_pedido,
          p.estado,
          p.cliente_nombre,
          p.cliente_telefono,
          p.observaciones,
          p.fecha_pedido,
          p.total
        FROM pedidos p
        LEFT JOIN mesas m
          ON p.id_mesa = m.id_mesa
        WHERE p.id_restaurante = ?
        AND p.estado IN ('en_cocina', 'preparando', 'listo')
        ORDER BY p.fecha_pedido ASC
        `,
        [idRestaurante]
      );

      const [detalles] = await db.query(
        `
        SELECT
          d.id_detalle,
          d.id_pedido,
          d.id_producto,
          pr.nombre AS producto,
          d.cantidad,
          d.precio_unitario,
          d.subtotal,
          d.observaciones,
          d.estado_cocina,
          d.fecha_creacion,
          d.fecha_listo
        FROM pedido_detalle d
        INNER JOIN productos pr
          ON d.id_producto = pr.id_producto
        INNER JOIN pedidos p
          ON d.id_pedido = p.id_pedido
        WHERE p.id_restaurante = ?
        AND p.estado IN ('en_cocina', 'preparando', 'listo')
        ORDER BY d.id_detalle ASC
        `,
        [idRestaurante]
      );

      const pedidosConDetalle = pedidos.map((pedido) => ({
        ...pedido,
        detalles: detalles.filter((detalle) => detalle.id_pedido === pedido.id_pedido)
      }));

      return res.json(pedidosConDetalle);

    } catch (error) {
      console.error('Error obteniendo pedidos de cocina:', error);

      return res.status(500).json({
        mensaje: 'Error obteniendo pedidos de cocina'
      });
    }
  }
);

// =====================================================
// COCINA - CAMBIAR ESTADO DE PRODUCTO
// =====================================================

app.patch('/cocina/detalle/:id_detalle/estado',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'COCINA'),
  async (req, res) => {
    const connection = await db.getConnection();

    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) {
        connection.release();
        return;
      }

      const idUsuario = req.user.id_usuario || req.user.id;
      const { id_detalle } = req.params;
      const { estado_cocina } = req.body;

      const estadosPermitidos = ['pendiente', 'preparando', 'listo', 'entregado', 'cancelado'];

      if (!estado_cocina || !estadosPermitidos.includes(estado_cocina)) {
        connection.release();

        return res.status(400).json({
          mensaje: 'Estado de cocina no válido'
        });
      }

      await connection.beginTransaction();

      const [detalleRows] = await connection.query(
        `
        SELECT 
          d.id_detalle,
          d.id_pedido,
          d.estado_cocina,
          p.id_restaurante,
          p.estado AS estado_pedido
        FROM pedido_detalle d
        INNER JOIN pedidos p
          ON d.id_pedido = p.id_pedido
        WHERE d.id_detalle = ?
        AND p.id_restaurante = ?
        LIMIT 1
        `,
        [id_detalle, idRestaurante]
      );

      if (detalleRows.length === 0) {
        await connection.rollback();
        connection.release();

        return res.status(404).json({
          mensaje: 'Detalle no encontrado'
        });
      }

      const detalle = detalleRows[0];
      const idPedido = detalle.id_pedido;

      await connection.query(
        `
        UPDATE pedido_detalle
        SET 
          estado_cocina = ?,
          fecha_listo = CASE WHEN ? = 'listo' THEN NOW() ELSE fecha_listo END
        WHERE id_detalle = ?
        `,
        [estado_cocina, estado_cocina, id_detalle]
      );

      const [estadosDetalle] = await connection.query(
        `
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN estado_cocina = 'listo' THEN 1 ELSE 0 END) AS listos,
          SUM(CASE WHEN estado_cocina = 'preparando' THEN 1 ELSE 0 END) AS preparando,
          SUM(CASE WHEN estado_cocina = 'pendiente' THEN 1 ELSE 0 END) AS pendientes
        FROM pedido_detalle
        WHERE id_pedido = ?
        AND estado_cocina <> 'cancelado'
        `,
        [idPedido]
      );

      const resumen = estadosDetalle[0];

      let nuevoEstadoPedido = 'en_cocina';

      if (Number(resumen.total) > 0 && Number(resumen.listos) === Number(resumen.total)) {
        nuevoEstadoPedido = 'listo';
      } else if (Number(resumen.preparando) > 0 || estado_cocina === 'preparando') {
        nuevoEstadoPedido = 'preparando';
      }

      await connection.query(
        `
        UPDATE pedidos
        SET estado = ?
        WHERE id_pedido = ?
        AND id_restaurante = ?
        `,
        [nuevoEstadoPedido, idPedido, idRestaurante]
      );

      await connection.query(
        `
        INSERT INTO bitacora_pedidos (
          id_restaurante,
          id_pedido,
          id_usuario,
          accion,
          descripcion
        ) VALUES (?, ?, ?, ?, ?)
        `,
        [
          idRestaurante,
          idPedido,
          idUsuario,
          'Estado cocina actualizado',
          `Detalle ${id_detalle} cambiado a ${estado_cocina}`
        ]
      );

      await connection.commit();
      connection.release();

      return res.json({
        mensaje: 'Estado actualizado correctamente',
        estado_pedido: nuevoEstadoPedido
      });

    } catch (error) {
      await connection.rollback();
      connection.release();

      console.error('Error actualizando estado de cocina:', error);

      return res.status(500).json({
        mensaje: 'Error actualizando estado de cocina'
      });
    }
  }
);

// =====================================================
// COCINA - MARCAR PEDIDO COMPLETO COMO LISTO
// =====================================================

app.patch('/cocina/pedidos/:id_pedido/listo',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'COCINA'),
  async (req, res) => {
    const connection = await db.getConnection();

    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) {
        connection.release();
        return;
      }

      const idUsuario = req.user.id_usuario || req.user.id;
      const { id_pedido } = req.params;

      await connection.beginTransaction();

      const [pedidoRows] = await connection.query(
        `
        SELECT id_pedido
        FROM pedidos
        WHERE id_pedido = ?
        AND id_restaurante = ?
        AND estado IN ('en_cocina', 'preparando', 'listo')
        LIMIT 1
        `,
        [id_pedido, idRestaurante]
      );

      if (pedidoRows.length === 0) {
        await connection.rollback();
        connection.release();

        return res.status(404).json({
          mensaje: 'Pedido no encontrado en cocina'
        });
      }

      await connection.query(
        `
        UPDATE pedido_detalle
        SET 
          estado_cocina = 'listo',
          fecha_listo = NOW()
        WHERE id_pedido = ?
        AND estado_cocina <> 'cancelado'
        `,
        [id_pedido]
      );

      await connection.query(
        `
        UPDATE pedidos
        SET estado = 'listo'
        WHERE id_pedido = ?
        AND id_restaurante = ?
        `,
        [id_pedido, idRestaurante]
      );

      await connection.query(
        `
        INSERT INTO bitacora_pedidos (
          id_restaurante,
          id_pedido,
          id_usuario,
          accion,
          descripcion
        ) VALUES (?, ?, ?, ?, ?)
        `,
        [
          idRestaurante,
          id_pedido,
          idUsuario,
          'Pedido listo',
          'Pedido marcado como listo desde cocina'
        ]
      );

      await connection.commit();
      connection.release();

      return res.json({
        mensaje: 'Pedido marcado como listo'
      });

    } catch (error) {
      await connection.rollback();
      connection.release();

      console.error('Error marcando pedido como listo:', error);

      return res.status(500).json({
        mensaje: 'Error marcando pedido como listo'
      });
    }
  }
);

// =====================================================
// PEDIDOS - LISTAR
// =====================================================

app.get('/pedidos',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA', 'MESERO', 'COCINA'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const {
        estado,
        fecha_inicio,
        fecha_fin,
        buscar
      } = req.query;

      let condiciones = ['p.id_restaurante = ?'];
      let params = [idRestaurante];

      if (estado && estado !== 'todos') {
        condiciones.push('p.estado = ?');
        params.push(estado);
      }

      if (fecha_inicio) {
        condiciones.push('DATE(p.fecha_pedido) >= ?');
        params.push(fecha_inicio);
      }

      if (fecha_fin) {
        condiciones.push('DATE(p.fecha_pedido) <= ?');
        params.push(fecha_fin);
      }

      if (buscar && buscar.trim()) {
        condiciones.push(`
          (
            p.id_pedido LIKE ?
            OR p.cliente_nombre LIKE ?
            OR p.cliente_telefono LIKE ?
            OR m.numero_mesa LIKE ?
          )
        `);

        const busqueda = `%${buscar.trim()}%`;
        params.push(busqueda, busqueda, busqueda, busqueda);
      }

      const where = condiciones.join(' AND ');

      const [pedidos] = await db.query(
        `
        SELECT 
          p.id_pedido,
          p.id_restaurante,
          p.id_mesa,
          m.numero_mesa,
          p.id_cliente,
          c.nombre AS cliente_registrado,
          p.id_mesero,
          u.nombre AS mesero,
          p.id_cajero,
          p.tipo_pedido,
          p.estado,
          p.cliente_nombre,
          p.cliente_telefono,
          p.direccion_delivery,
          p.subtotal,
          p.descuento,
          p.propina,
          p.total,
          p.total_pagado,
          p.saldo_pendiente,
          p.observaciones,
          p.fecha_pedido,
          p.fecha_entregado,
          p.fecha_pagado,
          p.fecha_cancelado
        FROM pedidos p
        LEFT JOIN mesas m
          ON p.id_mesa = m.id_mesa
        LEFT JOIN clientes c
          ON p.id_cliente = c.id_cliente
        LEFT JOIN usuarios u
          ON p.id_mesero = u.id_usuario
        WHERE ${where}
        ORDER BY p.fecha_pedido DESC
        LIMIT 200
        `,
        params
      );

      return res.json(pedidos);

    } catch (error) {
      console.error('Error obteniendo pedidos:', error);

      return res.status(500).json({
        mensaje: 'Error obteniendo pedidos'
      });
    }
  }
);

// =====================================================
// PEDIDOS - VER DETALLE
// =====================================================

app.get('/pedidos/:id_pedido',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA', 'MESERO', 'COCINA'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const { id_pedido } = req.params;

      const [pedidoRows] = await db.query(
        `
        SELECT 
          p.*,
          m.numero_mesa,
          c.nombre AS cliente_registrado,
          u.nombre AS mesero,
          cajero.nombre AS cajero
        FROM pedidos p
        LEFT JOIN mesas m
          ON p.id_mesa = m.id_mesa
        LEFT JOIN clientes c
          ON p.id_cliente = c.id_cliente
        LEFT JOIN usuarios u
          ON p.id_mesero = u.id_usuario
        LEFT JOIN usuarios cajero
          ON p.id_cajero = cajero.id_usuario
        WHERE p.id_pedido = ?
        AND p.id_restaurante = ?
        LIMIT 1
        `,
        [id_pedido, idRestaurante]
      );

      if (pedidoRows.length === 0) {
        return res.status(404).json({
          mensaje: 'Pedido no encontrado'
        });
      }

      const pedido = pedidoRows[0];

      const [detalle] = await db.query(
        `
        SELECT 
          d.id_detalle,
          d.id_producto,
          pr.nombre AS producto,
          pr.descripcion AS descripcion_producto,
          d.cantidad,
          d.precio_unitario,
          d.subtotal,
          d.observaciones,
          d.estado_cocina,
          d.fecha_creacion,
          d.fecha_listo
        FROM pedido_detalle d
        INNER JOIN productos pr
          ON d.id_producto = pr.id_producto
        WHERE d.id_pedido = ?
        ORDER BY d.id_detalle ASC
        `,
        [id_pedido]
      );

      const [pagos] = await db.query(
        `
        SELECT 
          pg.id_pago,
          pg.metodo_pago,
          pg.monto,
          pg.referencia,
          pg.observaciones,
          pg.fecha_pago,
          u.nombre AS usuario
        FROM pagos pg
        LEFT JOIN usuarios u
          ON pg.id_usuario = u.id_usuario
        WHERE pg.id_pedido = ?
        AND pg.id_restaurante = ?
        ORDER BY pg.fecha_pago DESC
        `,
        [id_pedido, idRestaurante]
      );

      return res.json({
        pedido,
        detalle,
        pagos
      });

    } catch (error) {
      console.error('Error obteniendo detalle del pedido:', error);

      return res.status(500).json({
        mensaje: 'Error obteniendo detalle del pedido'
      });
    }
  }
);

// =====================================================
// PEDIDOS - MARCAR COMO ENTREGADO
// =====================================================

app.patch('/pedidos/:id_pedido/entregar',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA', 'MESERO'),
  async (req, res) => {
    const connection = await db.getConnection();

    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) {
        connection.release();
        return;
      }

      const idUsuario = req.user.id_usuario || req.user.id;
      const { id_pedido } = req.params;

      await connection.beginTransaction();

      const [pedidoRows] = await connection.query(
        `
        SELECT 
          id_pedido,
          id_mesa,
          tipo_pedido,
          estado
        FROM pedidos
        WHERE id_pedido = ?
        AND id_restaurante = ?
        LIMIT 1
        `,
        [id_pedido, idRestaurante]
      );

      if (pedidoRows.length === 0) {
        await connection.rollback();
        connection.release();

        return res.status(404).json({
          mensaje: 'Pedido no encontrado'
        });
      }

      const pedido = pedidoRows[0];

      if (pedido.estado === 'cancelado') {
        await connection.rollback();
        connection.release();

        return res.status(400).json({
          mensaje: 'No puedes entregar un pedido cancelado'
        });
      }

      if (pedido.estado === 'pagado') {
        await connection.rollback();
        connection.release();

        return res.status(400).json({
          mensaje: 'Este pedido ya fue pagado'
        });
      }

      await connection.query(
        `
        UPDATE pedidos
        SET 
          estado = 'entregado',
          fecha_entregado = NOW()
        WHERE id_pedido = ?
        AND id_restaurante = ?
        `,
        [id_pedido, idRestaurante]
      );

      await connection.query(
        `
        UPDATE pedido_detalle
        SET estado_cocina = 'entregado'
        WHERE id_pedido = ?
        AND estado_cocina <> 'cancelado'
        `,
        [id_pedido]
      );

      await connection.query(
        `
        INSERT INTO bitacora_pedidos (
          id_restaurante,
          id_pedido,
          id_usuario,
          accion,
          descripcion
        ) VALUES (?, ?, ?, ?, ?)
        `,
        [
          idRestaurante,
          id_pedido,
          idUsuario,
          'Pedido entregado',
          'Pedido marcado como entregado'
        ]
      );

      await connection.commit();
      connection.release();

      return res.json({
        mensaje: 'Pedido marcado como entregado'
      });

    } catch (error) {
      await connection.rollback();
      connection.release();

      console.error('Error entregando pedido:', error);

      return res.status(500).json({
        mensaje: 'Error marcando pedido como entregado'
      });
    }
  }
);

// =====================================================
// PEDIDOS - CANCELAR
// =====================================================

app.patch('/pedidos/:id_pedido/cancelar',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA'),
  async (req, res) => {
    const connection = await db.getConnection();

    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) {
        connection.release();
        return;
      }

      const idUsuario = req.user.id_usuario || req.user.id;
      const { id_pedido } = req.params;
      const { motivo } = req.body;

      await connection.beginTransaction();

      const [pedidoRows] = await connection.query(
        `
        SELECT 
          id_pedido,
          id_mesa,
          estado,
          total_pagado
        FROM pedidos
        WHERE id_pedido = ?
        AND id_restaurante = ?
        LIMIT 1
        `,
        [id_pedido, idRestaurante]
      );

      if (pedidoRows.length === 0) {
        await connection.rollback();
        connection.release();

        return res.status(404).json({
          mensaje: 'Pedido no encontrado'
        });
      }

      const pedido = pedidoRows[0];

      if (pedido.estado === 'pagado') {
        await connection.rollback();
        connection.release();

        return res.status(400).json({
          mensaje: 'No puedes cancelar un pedido pagado'
        });
      }

      if (Number(pedido.total_pagado || 0) > 0) {
        await connection.rollback();
        connection.release();

        return res.status(400).json({
          mensaje: 'No puedes cancelar un pedido con pagos registrados'
        });
      }

      const [detalle] = await connection.query(
        `
        SELECT 
          d.id_producto,
          d.cantidad,
          p.maneja_inventario
        FROM pedido_detalle d
        INNER JOIN productos p
          ON d.id_producto = p.id_producto
        WHERE d.id_pedido = ?
        `,
        [id_pedido]
      );

      for (const item of detalle) {
        if (Number(item.maneja_inventario) === 1) {
          await connection.query(
            `
            UPDATE productos
            SET stock = stock + ?
            WHERE id_producto = ?
            AND id_restaurante = ?
            `,
            [
              Number(item.cantidad || 0),
              item.id_producto,
              idRestaurante
            ]
          );
        }
      }

      await connection.query(
        `
        UPDATE pedidos
        SET 
          estado = 'cancelado',
          fecha_cancelado = NOW(),
          observaciones = CONCAT(
            IFNULL(observaciones, ''),
            '\nCancelado: ',
            ?
          )
        WHERE id_pedido = ?
        AND id_restaurante = ?
        `,
        [
          motivo || 'Sin motivo especificado',
          id_pedido,
          idRestaurante
        ]
      );

      await connection.query(
        `
        UPDATE pedido_detalle
        SET estado_cocina = 'cancelado'
        WHERE id_pedido = ?
        `,
        [id_pedido]
      );

      if (pedido.id_mesa) {
        await connection.query(
          `
          UPDATE mesas
          SET estado = 'libre'
          WHERE id_mesa = ?
          AND id_restaurante = ?
          `,
          [pedido.id_mesa, idRestaurante]
        );
      }

      await connection.query(
        `
        INSERT INTO bitacora_pedidos (
          id_restaurante,
          id_pedido,
          id_usuario,
          accion,
          descripcion
        ) VALUES (?, ?, ?, ?, ?)
        `,
        [
          idRestaurante,
          id_pedido,
          idUsuario,
          'Pedido cancelado',
          motivo || 'Sin motivo especificado'
        ]
      );

      await connection.commit();
      connection.release();

      return res.json({
        mensaje: 'Pedido cancelado correctamente'
      });

    } catch (error) {
      await connection.rollback();
      connection.release();

      console.error('Error cancelando pedido:', error);

      return res.status(500).json({
        mensaje: 'Error cancelando pedido'
      });
    }
  }
);

// =====================================================
// CAJA - LISTAR PEDIDOS PARA COBRAR
// =====================================================

app.get('/caja/pedidos',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const { buscar } = req.query;

      let condiciones = [
        'p.id_restaurante = ?',
        "p.estado IN ('listo', 'entregado', 'pagado')"
      ];

      let params = [idRestaurante];

      if (buscar && buscar.trim()) {
        condiciones.push(`
          (
            p.id_pedido LIKE ?
            OR p.cliente_nombre LIKE ?
            OR p.cliente_telefono LIKE ?
            OR m.numero_mesa LIKE ?
          )
        `);

        const texto = `%${buscar.trim()}%`;
        params.push(texto, texto, texto, texto);
      }

      const [pedidos] = await db.query(
        `
        SELECT 
          p.id_pedido,
          p.id_mesa,
          m.numero_mesa,
          p.tipo_pedido,
          p.estado,
          p.cliente_nombre,
          p.cliente_telefono,
          p.subtotal,
          p.descuento,
          p.propina,
          p.total,
          p.total_pagado,
          p.saldo_pendiente,
          p.fecha_pedido,
          p.fecha_entregado,
          p.fecha_pagado
        FROM pedidos p
        LEFT JOIN mesas m
          ON p.id_mesa = m.id_mesa
        WHERE ${condiciones.join(' AND ')}
        ORDER BY 
          CASE WHEN p.estado = 'pagado' THEN 1 ELSE 0 END ASC,
          p.fecha_pedido DESC
        LIMIT 200
        `,
        params
      );

      return res.json(pedidos);

    } catch (error) {
      console.error('Error obteniendo pedidos para caja:', error);

      return res.status(500).json({
        mensaje: 'Error obteniendo pedidos para caja'
      });
    }
  }
);

// =====================================================
// CAJA - DETALLE DE PEDIDO
// =====================================================

app.get('/caja/pedidos/:id_pedido',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const { id_pedido } = req.params;

      const [pedidoRows] = await db.query(
        `
        SELECT 
          p.*,
          m.numero_mesa,
          u.nombre AS mesero,
          cajero.nombre AS cajero,

          cf.id_cliente_facturacion,
          cf.nit,
          cf.nombre_facturacion,
          cf.direccion_facturacion,
          cf.correo_facturacion

        FROM pedidos p
        LEFT JOIN mesas m
          ON p.id_mesa = m.id_mesa
        LEFT JOIN usuarios u
          ON p.id_mesero = u.id_usuario
        LEFT JOIN usuarios cajero
          ON p.id_cajero = cajero.id_usuario
        LEFT JOIN clientes_facturacion cf
          ON p.id_cliente_facturacion = cf.id_cliente_facturacion
        WHERE p.id_pedido = ?
        AND p.id_restaurante = ?
        LIMIT 1
        `,
        [id_pedido, idRestaurante]
      );

      if (pedidoRows.length === 0) {
        return res.status(404).json({
          mensaje: 'Pedido no encontrado'
        });
      }

      const pedido = pedidoRows[0];

      const [detalle] = await db.query(
        `
        SELECT 
          d.id_detalle,
          d.id_producto,
          pr.nombre AS producto,
          d.cantidad,
          d.precio_unitario,
          d.subtotal,
          d.observaciones,
          d.estado_cocina
        FROM pedido_detalle d
        INNER JOIN productos pr
          ON d.id_producto = pr.id_producto
        WHERE d.id_pedido = ?
        ORDER BY d.id_detalle ASC
        `,
        [id_pedido]
      );

      const [pagos] = await db.query(
        `
        SELECT 
          pg.id_pago,
          pg.metodo_pago,
          pg.monto,
          pg.referencia,
          pg.observaciones,
          pg.fecha_pago,
          u.nombre AS usuario
        FROM pagos pg
        LEFT JOIN usuarios u
          ON pg.id_usuario = u.id_usuario
        WHERE pg.id_pedido = ?
        AND pg.id_restaurante = ?
        ORDER BY pg.fecha_pago DESC
        `,
        [id_pedido, idRestaurante]
      );

      return res.json({
        pedido,
        detalle,
        pagos
      });

    } catch (error) {
      console.error('Error obteniendo detalle para caja:', error);

      return res.status(500).json({
        mensaje: 'Error obteniendo detalle para caja'
      });
    }
  }
);
// =====================================================
// CAJA - REGISTRAR PAGO
// =====================================================

app.post('/caja/pagos',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA'),
  async (req, res) => {
    const connection = await db.getConnection();

    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) {
        connection.release();
        return;
      }

      const idUsuario = req.user.id_usuario || req.user.id;

      const {
        id_pedido,
        metodo_pago,
        monto,
        referencia,
        observaciones,

        nit_facturacion,
        nombre_facturacion,
        direccion_facturacion,
        correo_facturacion
      } = req.body;

      if (!id_pedido) {
        connection.release();
        return res.status(400).json({
          mensaje: 'El pedido es obligatorio'
        });
      }

      if (!metodo_pago) {
        connection.release();
        return res.status(400).json({
          mensaje: 'El método de pago es obligatorio'
        });
      }

      const metodosPermitidos = [
        'efectivo',
        'tarjeta',
        'transferencia',
        'mixto',
        'otro'
      ];

      if (!metodosPermitidos.includes(metodo_pago)) {
        connection.release();
        return res.status(400).json({
          mensaje: 'Método de pago no válido'
        });
      }

      const montoPago = Number(monto || 0);

      if (montoPago <= 0) {
        connection.release();
        return res.status(400).json({
          mensaje: 'El monto debe ser mayor a 0'
        });
      }

      await connection.beginTransaction();

      const [pedidoRows] = await connection.query(
        `
        SELECT 
          id_pedido,
          id_mesa,
          id_cliente,
          tipo_pedido,
          estado,
          total,
          total_pagado,
          saldo_pendiente
        FROM pedidos
        WHERE id_pedido = ?
        AND id_restaurante = ?
        LIMIT 1
        FOR UPDATE
        `,
        [id_pedido, idRestaurante]
      );

      if (pedidoRows.length === 0) {
        await connection.rollback();
        connection.release();

        return res.status(404).json({
          mensaje: 'Pedido no encontrado'
        });
      }

      const pedido = pedidoRows[0];

      if (pedido.estado === 'cancelado') {
        await connection.rollback();
        connection.release();

        return res.status(400).json({
          mensaje: 'No puedes cobrar un pedido cancelado'
        });
      }

      if (pedido.estado === 'pagado' || Number(pedido.saldo_pendiente || 0) <= 0) {
        await connection.rollback();
        connection.release();

        return res.status(400).json({
          mensaje: 'Este pedido ya está pagado'
        });
      }

      if (montoPago > Number(pedido.saldo_pendiente || 0)) {
        await connection.rollback();
        connection.release();

        return res.status(400).json({
          mensaje: 'El monto no puede ser mayor al saldo pendiente'
        });
      }

      const idClienteFacturacion = await obtenerOCrearClienteFacturacion(
        connection,
        {
          idRestaurante,
          idCliente: pedido.id_cliente,
          nit: nit_facturacion,
          nombreFacturacion: nombre_facturacion,
          direccionFacturacion: direccion_facturacion,
          correoFacturacion: correo_facturacion
        }
      );

      await connection.query(
        `
        INSERT INTO pagos (
          id_restaurante,
          id_pedido,
          id_usuario,
          metodo_pago,
          monto,
          referencia,
          observaciones
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          idRestaurante,
          id_pedido,
          idUsuario,
          metodo_pago,
          montoPago,
          referencia || null,
          observaciones || null
        ]
      );

      const nuevoTotalPagado = Number(pedido.total_pagado || 0) + montoPago;
      const nuevoSaldo = Number(pedido.total || 0) - nuevoTotalPagado;

      let nuevoEstado = pedido.estado;

      if (nuevoSaldo <= 0.0001) {
        nuevoEstado = 'pagado';
      }

      await connection.query(
        `
        UPDATE pedidos
        SET 
          total_pagado = ?,
          saldo_pendiente = ?,
          estado = ?,
          id_cajero = ?,
          id_cliente_facturacion = ?,
          fecha_pagado = CASE WHEN ? = 'pagado' THEN NOW() ELSE fecha_pagado END
        WHERE id_pedido = ?
        AND id_restaurante = ?
        `,
        [
          nuevoTotalPagado,
          nuevoSaldo <= 0.0001 ? 0 : nuevoSaldo,
          nuevoEstado,
          idUsuario,
          idClienteFacturacion,
          nuevoEstado,
          id_pedido,
          idRestaurante
        ]
      );

      if (nuevoEstado === 'pagado' && pedido.id_mesa) {
        const [[pendientesMesa]] = await connection.query(
          `
          SELECT COUNT(*) AS total_pendientes
          FROM pedidos
          WHERE id_restaurante = ?
          AND id_mesa = ?
          AND estado NOT IN ('pagado', 'cancelado')
          AND saldo_pendiente > 0
          `,
          [idRestaurante, pedido.id_mesa]
        );

        if (Number(pendientesMesa.total_pendientes || 0) === 0) {
          await connection.query(
            `
            UPDATE mesas
            SET estado = 'libre'
            WHERE id_mesa = ?
            AND id_restaurante = ?
            `,
            [pedido.id_mesa, idRestaurante]
          );
        }
      }

      await connection.query(
        `
        INSERT INTO bitacora_pedidos (
          id_restaurante,
          id_pedido,
          id_usuario,
          accion,
          descripcion
        ) VALUES (?, ?, ?, ?, ?)
        `,
        [
          idRestaurante,
          id_pedido,
          idUsuario,
          'Pago registrado',
          `Pago registrado por Q${montoPago.toFixed(2)}`
        ]
      );

      await connection.commit();
      connection.release();

      return res.status(201).json({
        mensaje: nuevoEstado === 'pagado'
          ? 'Pago registrado. Pedido pagado completamente.'
          : 'Pago parcial registrado correctamente.',
        estado: nuevoEstado,
        total_pagado: nuevoTotalPagado,
        saldo_pendiente: nuevoSaldo <= 0.0001 ? 0 : nuevoSaldo,
        id_cliente_facturacion: idClienteFacturacion
      });

    } catch (error) {
      await connection.rollback();
      connection.release();

      console.error('Error registrando pago:', error);

      return res.status(500).json({
        mensaje: 'Error registrando pago',
        error: error.message
      });
    }
  }
);
// =====================================================
// GASTOS - LISTAR
// =====================================================

app.get('/gastos',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const {
        fecha_inicio,
        fecha_fin,
        categoria,
        buscar
      } = req.query;

      let condiciones = ['g.id_restaurante = ?'];
      let params = [idRestaurante];

      if (fecha_inicio) {
        condiciones.push('DATE(g.fecha_gasto) >= ?');
        params.push(fecha_inicio);
      }

      if (fecha_fin) {
        condiciones.push('DATE(g.fecha_gasto) <= ?');
        params.push(fecha_fin);
      }

      if (categoria && categoria !== 'todas') {
        condiciones.push('g.categoria = ?');
        params.push(categoria);
      }

      if (buscar && buscar.trim()) {
        condiciones.push(`
          (
            g.descripcion LIKE ?
            OR g.categoria LIKE ?
            OR g.referencia LIKE ?
          )
        `);

        const texto = `%${buscar.trim()}%`;
        params.push(texto, texto, texto);
      }

      const [gastos] = await db.query(
  `
  SELECT 
    g.id_gasto,
    g.id_restaurante,
    g.id_usuario,
    u.nombre AS usuario,
    g.categoria,
    g.descripcion,
    g.monto,
    g.referencia,
    g.metodo_pago,
    g.fecha_gasto
  FROM gastos g
  LEFT JOIN usuarios u
    ON g.id_usuario = u.id_usuario
  WHERE ${condiciones.join(' AND ')}
  ORDER BY g.fecha_gasto DESC, g.id_gasto DESC
  LIMIT 300
  `,
  params
);

      const [[totales]] = await db.query(
        `
        SELECT 
          COUNT(*) AS total_gastos,
          SUM(g.monto) AS monto_total
        FROM gastos g
        WHERE ${condiciones.join(' AND ')}
        `,
        params
      );

      return res.json({
        gastos,
        resumen: {
          total_gastos: Number(totales.total_gastos || 0),
          monto_total: Number(totales.monto_total || 0)
        }
      });

    } catch (error) {
      console.error('Error obteniendo gastos:', error);

      return res.status(500).json({
        mensaje: 'Error obteniendo gastos'
      });
    }
  }
);

// =====================================================
// GASTOS - CREAR
// =====================================================

app.post('/gastos',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const idUsuario = req.user.id_usuario || req.user.id;

      const {
        categoria,
        descripcion,
        monto,
        referencia,
        metodo_pago,
        fecha_gasto
      } = req.body;

      if (!categoria || !categoria.trim()) {
        return res.status(400).json({
          mensaje: 'La categoría del gasto es obligatoria'
        });
      }

      if (!descripcion || !descripcion.trim()) {
        return res.status(400).json({
          mensaje: 'La descripción del gasto es obligatoria'
        });
      }

      if (Number(monto || 0) <= 0) {
        return res.status(400).json({
          mensaje: 'El monto debe ser mayor a 0'
        });
      }

      const [result] = await db.query(
        `
        INSERT INTO gastos (
          id_restaurante,
          id_usuario,
          categoria,
          descripcion,
          monto,
          referencia,
          metodo_pago,
          fecha_gasto
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          idRestaurante,
          idUsuario,
          categoria.trim(),
          descripcion.trim(),
          Number(monto),
          referencia || null,
          metodo_pago || 'efectivo',
          fecha_gasto || new Date()
        ]
      );

      return res.status(201).json({
        mensaje: 'Gasto registrado correctamente',
        id_gasto: result.insertId
      });

    } catch (error) {
      console.error('Error creando gasto:', error);

      return res.status(500).json({
        mensaje: 'Error creando gasto'
      });
    }
  }
);

// =====================================================
// GASTOS - ACTUALIZAR
// =====================================================

app.put('/gastos/:id_gasto',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const { id_gasto } = req.params;

      const {
        categoria,
        descripcion,
        monto,
        referencia,
        metodo_pago,
        fecha_gasto
      } = req.body;

      if (!categoria || !categoria.trim()) {
        return res.status(400).json({
          mensaje: 'La categoría del gasto es obligatoria'
        });
      }

      if (!descripcion || !descripcion.trim()) {
        return res.status(400).json({
          mensaje: 'La descripción del gasto es obligatoria'
        });
      }

      if (Number(monto || 0) <= 0) {
        return res.status(400).json({
          mensaje: 'El monto debe ser mayor a 0'
        });
      }

      const [result] = await db.query(
        `
        UPDATE gastos
        SET 
          categoria = ?,
          descripcion = ?,
          monto = ?,
          referencia = ?,
          metodo_pago = ?,
          fecha_gasto = ?
        WHERE id_gasto = ?
        AND id_restaurante = ?
        `,
        [
          categoria.trim(),
          descripcion.trim(),
          Number(monto),
          referencia || null,
          metodo_pago || 'efectivo',
          fecha_gasto || new Date(),
          id_gasto,
          idRestaurante
        ]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          mensaje: 'Gasto no encontrado'
        });
      }

      return res.json({
        mensaje: 'Gasto actualizado correctamente'
      });

    } catch (error) {
      console.error('Error actualizando gasto:', error);

      return res.status(500).json({
        mensaje: 'Error actualizando gasto'
      });
    }
  }
);

// =====================================================
// GASTOS - ELIMINAR
// =====================================================

app.delete('/gastos/:id_gasto',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const { id_gasto } = req.params;

      const [result] = await db.query(
        `
        DELETE FROM gastos
        WHERE id_gasto = ?
        AND id_restaurante = ?
        `,
        [id_gasto, idRestaurante]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          mensaje: 'Gasto no encontrado'
        });
      }

      return res.json({
        mensaje: 'Gasto eliminado correctamente'
      });

    } catch (error) {
      console.error('Error eliminando gasto:', error);

      return res.status(500).json({
        mensaje: 'Error eliminando gasto'
      });
    }
  }
);

// =====================================================
// REPORTES - RESUMEN GENERAL
// =====================================================

app.get('/reportes/resumen',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const fechaActual = new Date();
      const anio = Number(req.query.anio) || fechaActual.getFullYear();
      const mes = Number(req.query.mes) || fechaActual.getMonth() + 1;

      const fechaInicio = `${anio}-${String(mes).padStart(2, '0')}-01`;
      const fechaFin = new Date(anio, mes, 1).toISOString().slice(0, 10);

      const [[ventas]] = await db.query(
        `
        SELECT
          COUNT(*) AS pedidos_pagados,
          SUM(total) AS ventas_total,
          SUM(subtotal) AS subtotal_total,
          SUM(descuento) AS descuentos_total,
          SUM(propina) AS propinas_total,
          SUM(total_pagado) AS pagos_total,
          SUM(saldo_pendiente) AS saldo_pendiente
        FROM pedidos
        WHERE id_restaurante = ?
        AND fecha_pedido >= ?
        AND fecha_pedido < ?
        AND estado = 'pagado'
        `,
        [idRestaurante, fechaInicio, fechaFin]
      );

      const [[pedidos]] = await db.query(
        `
        SELECT
          COUNT(*) AS total_pedidos,
          SUM(CASE WHEN estado = 'en_cocina' THEN 1 ELSE 0 END) AS en_cocina,
          SUM(CASE WHEN estado = 'preparando' THEN 1 ELSE 0 END) AS preparando,
          SUM(CASE WHEN estado = 'listo' THEN 1 ELSE 0 END) AS listos,
          SUM(CASE WHEN estado = 'entregado' THEN 1 ELSE 0 END) AS entregados,
          SUM(CASE WHEN estado = 'pagado' THEN 1 ELSE 0 END) AS pagados,
          SUM(CASE WHEN estado = 'cancelado' THEN 1 ELSE 0 END) AS cancelados
        FROM pedidos
        WHERE id_restaurante = ?
        AND fecha_pedido >= ?
        AND fecha_pedido < ?
        `,
        [idRestaurante, fechaInicio, fechaFin]
      );

      const [[pagos]] = await db.query(
        `
        SELECT
          SUM(monto) AS total_pagos,
          SUM(CASE WHEN metodo_pago = 'efectivo' THEN monto ELSE 0 END) AS efectivo,
          SUM(CASE WHEN metodo_pago = 'tarjeta' THEN monto ELSE 0 END) AS tarjeta,
          SUM(CASE WHEN metodo_pago = 'transferencia' THEN monto ELSE 0 END) AS transferencia,
          SUM(CASE WHEN metodo_pago = 'mixto' THEN monto ELSE 0 END) AS mixto,
          SUM(CASE WHEN metodo_pago = 'otro' THEN monto ELSE 0 END) AS otro
        FROM pagos
        WHERE id_restaurante = ?
        AND fecha_pago >= ?
        AND fecha_pago < ?
        `,
        [idRestaurante, fechaInicio, fechaFin]
      );

      const [[gastos]] = await db.query(
        `
        SELECT
          COUNT(*) AS total_gastos,
          SUM(monto) AS gastos_total
        FROM gastos
        WHERE id_restaurante = ?
        AND fecha_gasto >= ?
        AND fecha_gasto < ?
        `,
        [idRestaurante, fechaInicio, fechaFin]
      );

      const ventasTotal = Number(ventas.ventas_total || 0);
      const gastosTotal = Number(gastos.gastos_total || 0);
      const ganancia = ventasTotal - gastosTotal;

      return res.json({
        periodo: {
          anio,
          mes,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin
        },
        resumen: {
          total_pedidos: Number(pedidos.total_pedidos || 0),
          pedidos_pagados: Number(ventas.pedidos_pagados || 0),
          ventas_total: ventasTotal,
          subtotal_total: Number(ventas.subtotal_total || 0),
          descuentos_total: Number(ventas.descuentos_total || 0),
          propinas_total: Number(ventas.propinas_total || 0),
          pagos_total: Number(pagos.total_pagos || 0),
          gastos_total: gastosTotal,
          ganancia,
          saldo_pendiente: Number(ventas.saldo_pendiente || 0),
          total_gastos: Number(gastos.total_gastos || 0)
        },
        estados_pedidos: {
          en_cocina: Number(pedidos.en_cocina || 0),
          preparando: Number(pedidos.preparando || 0),
          listos: Number(pedidos.listos || 0),
          entregados: Number(pedidos.entregados || 0),
          pagados: Number(pedidos.pagados || 0),
          cancelados: Number(pedidos.cancelados || 0)
        },
        pagos: {
          efectivo: Number(pagos.efectivo || 0),
          tarjeta: Number(pagos.tarjeta || 0),
          transferencia: Number(pagos.transferencia || 0),
          mixto: Number(pagos.mixto || 0),
          otro: Number(pagos.otro || 0)
        }
      });

    } catch (error) {
      console.error('Error obteniendo reporte resumen:', error);

      return res.status(500).json({
        mensaje: 'Error obteniendo reporte resumen'
      });
    }
  }
);

// =====================================================
// REPORTES - PRODUCTOS MÁS VENDIDOS
// =====================================================

app.get('/reportes/productos',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const fechaActual = new Date();
      const anio = Number(req.query.anio) || fechaActual.getFullYear();
      const mes = Number(req.query.mes) || fechaActual.getMonth() + 1;

      const fechaInicio = `${anio}-${String(mes).padStart(2, '0')}-01`;
      const fechaFin = new Date(anio, mes, 1).toISOString().slice(0, 10);

      const [productos] = await db.query(
        `
        SELECT
          pr.id_producto,
          pr.nombre AS producto,
          c.nombre AS categoria,
          SUM(d.cantidad) AS cantidad_vendida,
          SUM(d.subtotal) AS total_vendido
        FROM pedido_detalle d
        INNER JOIN pedidos p
          ON d.id_pedido = p.id_pedido
        INNER JOIN productos pr
          ON d.id_producto = pr.id_producto
        LEFT JOIN categorias c
          ON pr.id_categoria = c.id_categoria
        WHERE p.id_restaurante = ?
        AND p.fecha_pedido >= ?
        AND p.fecha_pedido < ?
        AND p.estado = 'pagado'
        AND d.estado_cocina <> 'cancelado'
        GROUP BY pr.id_producto, pr.nombre, c.nombre
        ORDER BY cantidad_vendida DESC, total_vendido DESC
        LIMIT 20
        `,
        [idRestaurante, fechaInicio, fechaFin]
      );

      return res.json(productos);

    } catch (error) {
      console.error('Error obteniendo reporte de productos:', error);

      return res.status(500).json({
        mensaje: 'Error obteniendo reporte de productos'
      });
    }
  }
);

// =====================================================
// REPORTES - GASTOS POR CATEGORÍA
// =====================================================

app.get('/reportes/gastos',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const fechaActual = new Date();
      const anio = Number(req.query.anio) || fechaActual.getFullYear();
      const mes = Number(req.query.mes) || fechaActual.getMonth() + 1;

      const fechaInicio = `${anio}-${String(mes).padStart(2, '0')}-01`;
      const fechaFin = new Date(anio, mes, 1).toISOString().slice(0, 10);

      const [gastos] = await db.query(
        `
        SELECT
          categoria,
          COUNT(*) AS cantidad,
          SUM(monto) AS total
        FROM gastos
        WHERE id_restaurante = ?
        AND fecha_gasto >= ?
        AND fecha_gasto < ?
        GROUP BY categoria
        ORDER BY total DESC
        `,
        [idRestaurante, fechaInicio, fechaFin]
      );

      return res.json(gastos);

    } catch (error) {
      console.error('Error obteniendo reporte de gastos:', error);

      return res.status(500).json({
        mensaje: 'Error obteniendo reporte de gastos'
      });
    }
  }
);

// =====================================================
// USUARIOS - LISTAR
// =====================================================

app.get('/usuarios',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const [usuarios] = await db.query(
        `
        SELECT 
          id_usuario,
          id_restaurante,
          nombre,
          usuario,
          rol,
          estado,
          fecha_creacion
        FROM usuarios
        WHERE id_restaurante = ?
        ORDER BY estado DESC, rol ASC, nombre ASC
        `,
        [idRestaurante]
      );

      return res.json(usuarios);

    } catch (error) {
      console.error('Error obteniendo usuarios:', error);

      return res.status(500).json({
        mensaje: 'Error obteniendo usuarios'
      });
    }
  }
);

// =====================================================
// USUARIOS - CREAR
// =====================================================

app.post('/usuarios',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const {
        nombre,
        usuario,
        password,
        rol
      } = req.body;

      if (!nombre || !nombre.trim()) {
        return res.status(400).json({
          mensaje: 'El nombre es obligatorio'
        });
      }

      if (!usuario || !usuario.trim()) {
        return res.status(400).json({
          mensaje: 'El usuario es obligatorio'
        });
      }

      if (!password || password.length < 8) {
        return res.status(400).json({
          mensaje: 'La contraseña debe tener al menos 8 caracteres'
        });
      }

      const rolesPermitidos = [
        'ADMINISTRADOR',
        'GERENTE',
        'CAJA',
        'MESERO',
        'COCINA'
      ];

      if (!rol || !rolesPermitidos.includes(rol)) {
        return res.status(400).json({
          mensaje: 'Rol no válido'
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const [result] = await db.query(
        `
        INSERT INTO usuarios (
          id_restaurante,
          nombre,
          usuario,
          password,
          rol,
          estado
        ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          idRestaurante,
          nombre.trim(),
          usuario.trim(),
          passwordHash,
          rol,
          1
        ]
      );

      return res.status(201).json({
        mensaje: 'Usuario creado correctamente',
        id_usuario: result.insertId
      });

    } catch (error) {
      console.error('Error creando usuario:', error);

      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          mensaje: 'Ya existe un usuario con ese nombre de usuario'
        });
      }

      return res.status(500).json({
        mensaje: 'Error creando usuario'
      });
    }
  }
);

// =====================================================
// USUARIOS - ACTUALIZAR
// =====================================================

app.put('/usuarios/:id_usuario',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const { id_usuario } = req.params;

      const {
        nombre,
        usuario,
        password,
        rol,
        estado
      } = req.body;

      if (!nombre || !nombre.trim()) {
        return res.status(400).json({
          mensaje: 'El nombre es obligatorio'
        });
      }

      if (!usuario || !usuario.trim()) {
        return res.status(400).json({
          mensaje: 'El usuario es obligatorio'
        });
      }

      const rolesPermitidos = [
        'ADMINISTRADOR',
        'GERENTE',
        'CAJA',
        'MESERO',
        'COCINA'
      ];

      if (!rol || !rolesPermitidos.includes(rol)) {
        return res.status(400).json({
          mensaje: 'Rol no válido'
        });
      }

      if (password && password.length < 8) {
        return res.status(400).json({
          mensaje: 'La contraseña debe tener al menos 8 caracteres'
        });
      }

      if (password) {
        const passwordHash = await bcrypt.hash(password, 10);

        const [result] = await db.query(
          `
          UPDATE usuarios
          SET 
            nombre = ?,
            usuario = ?,
            password = ?,
            rol = ?,
            estado = ?
          WHERE id_usuario = ?
          AND id_restaurante = ?
          `,
          [
            nombre.trim(),
            usuario.trim(),
            passwordHash,
            rol,
            Number(estado) === 0 ? 0 : 1,
            id_usuario,
            idRestaurante
          ]
        );

        if (result.affectedRows === 0) {
          return res.status(404).json({
            mensaje: 'Usuario no encontrado'
          });
        }

      } else {
        const [result] = await db.query(
          `
          UPDATE usuarios
          SET 
            nombre = ?,
            usuario = ?,
            rol = ?,
            estado = ?
          WHERE id_usuario = ?
          AND id_restaurante = ?
          `,
          [
            nombre.trim(),
            usuario.trim(),
            rol,
            Number(estado) === 0 ? 0 : 1,
            id_usuario,
            idRestaurante
          ]
        );

        if (result.affectedRows === 0) {
          return res.status(404).json({
            mensaje: 'Usuario no encontrado'
          });
        }
      }

      return res.json({
        mensaje: 'Usuario actualizado correctamente'
      });

    } catch (error) {
      console.error('Error actualizando usuario:', error);

      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          mensaje: 'Ya existe otro usuario con ese nombre de usuario'
        });
      }

      return res.status(500).json({
        mensaje: 'Error actualizando usuario'
      });
    }
  }
);

// =====================================================
// USUARIOS - CAMBIAR ESTADO
// =====================================================

app.patch('/usuarios/:id_usuario/estado',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const idUsuarioActual = req.user.id_usuario || req.user.id;
      const { id_usuario } = req.params;
      const { estado } = req.body;

      if (Number(id_usuario) === Number(idUsuarioActual) && Number(estado) === 0) {
        return res.status(400).json({
          mensaje: 'No puedes desactivar tu propio usuario'
        });
      }

      const nuevoEstado = Number(estado) === 1 ? 1 : 0;

      const [result] = await db.query(
        `
        UPDATE usuarios
        SET estado = ?
        WHERE id_usuario = ?
        AND id_restaurante = ?
        `,
        [nuevoEstado, id_usuario, idRestaurante]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          mensaje: 'Usuario no encontrado'
        });
      }

      return res.json({
        mensaje: nuevoEstado === 1
          ? 'Usuario activado correctamente'
          : 'Usuario desactivado correctamente'
      });

    } catch (error) {
      console.error('Error cambiando estado del usuario:', error);

      return res.status(500).json({
        mensaje: 'Error cambiando estado del usuario'
      });
    }
  }
);

// =====================================================
// USUARIOS - ELIMINAR
// =====================================================

app.delete('/usuarios/:id_usuario',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const idUsuarioActual = req.user.id_usuario || req.user.id;
      const { id_usuario } = req.params;

      if (Number(id_usuario) === Number(idUsuarioActual)) {
        return res.status(400).json({
          mensaje: 'No puedes eliminar tu propio usuario'
        });
      }

      const [usadoPedidos] = await db.query(
        `
        SELECT id_pedido
        FROM pedidos
        WHERE id_mesero = ?
        OR id_cajero = ?
        LIMIT 1
        `,
        [id_usuario, id_usuario]
      );

      if (usadoPedidos.length > 0) {
        return res.status(400).json({
          mensaje: 'No puedes eliminar este usuario porque ya tiene pedidos relacionados. Puedes desactivarlo.'
        });
      }

      const [usadoGastos] = await db.query(
        `
        SELECT id_gasto
        FROM gastos
        WHERE id_usuario = ?
        LIMIT 1
        `,
        [id_usuario]
      );

      if (usadoGastos.length > 0) {
        return res.status(400).json({
          mensaje: 'No puedes eliminar este usuario porque ya tiene gastos relacionados. Puedes desactivarlo.'
        });
      }

      const [result] = await db.query(
        `
        DELETE FROM usuarios
        WHERE id_usuario = ?
        AND id_restaurante = ?
        `,
        [id_usuario, idRestaurante]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          mensaje: 'Usuario no encontrado'
        });
      }

      return res.json({
        mensaje: 'Usuario eliminado correctamente'
      });

    } catch (error) {
      console.error('Error eliminando usuario:', error);

      return res.status(500).json({
        mensaje: 'Error eliminando usuario'
      });
    }
  }
);

// =====================================================
// CLIENTES - LISTAR
// =====================================================

app.get('/clientes',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA', 'MESERO'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const { buscar } = req.query;

      let condiciones = ['id_restaurante = ?'];
      let params = [idRestaurante];

      if (buscar && buscar.trim()) {
        condiciones.push(`
          (
            nombre LIKE ?
            OR telefono LIKE ?
            OR nit LIKE ?
            OR direccion LIKE ?
          )
        `);

        const texto = `%${buscar.trim()}%`;
        params.push(texto, texto, texto, texto);
      }

      const [clientes] = await db.query(
        `
        SELECT 
          id_cliente,
          id_restaurante,
          nombre,
          telefono,
          direccion,
          nit,
          correo,
          estado,
          fecha_creacion
        FROM clientes
        WHERE ${condiciones.join(' AND ')}
        ORDER BY estado DESC, nombre ASC
        LIMIT 300
        `,
        params
      );

      return res.json(clientes);

    } catch (error) {
      console.error('Error obteniendo clientes:', error);

      return res.status(500).json({
        mensaje: 'Error obteniendo clientes'
      });
    }
  }
);

// =====================================================
// CLIENTES - CREAR
// =====================================================

app.post('/clientes',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA', 'MESERO'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const {
        nombre,
        telefono,
        direccion,
        nit,
        correo
      } = req.body;

      if (!nombre || !nombre.trim()) {
        return res.status(400).json({
          mensaje: 'El nombre del cliente es obligatorio'
        });
      }

      const [result] = await db.query(
        `
        INSERT INTO clientes (
          id_restaurante,
          nombre,
          telefono,
          direccion,
          nit,
          correo,
          estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          idRestaurante,
          nombre.trim(),
          telefono || null,
          direccion || null,
          nit || 'CF',
          correo || null,
          1
        ]
      );

      return res.status(201).json({
        mensaje: 'Cliente creado correctamente',
        id_cliente: result.insertId
      });

    } catch (error) {
      console.error('Error creando cliente:', error);

      return res.status(500).json({
        mensaje: 'Error creando cliente'
      });
    }
  }
);

// =====================================================
// CLIENTES - ACTUALIZAR
// =====================================================

app.put('/clientes/:id_cliente',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA', 'MESERO'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const { id_cliente } = req.params;

      const {
        nombre,
        telefono,
        direccion,
        nit,
        correo,
        estado
      } = req.body;

      if (!nombre || !nombre.trim()) {
        return res.status(400).json({
          mensaje: 'El nombre del cliente es obligatorio'
        });
      }

      const [result] = await db.query(
        `
        UPDATE clientes
        SET
          nombre = ?,
          telefono = ?,
          direccion = ?,
          nit = ?,
          correo = ?,
          estado = ?
        WHERE id_cliente = ?
        AND id_restaurante = ?
        `,
        [
          nombre.trim(),
          telefono || null,
          direccion || null,
          nit || 'CF',
          correo || null,
          Number(estado) === 0 ? 0 : 1,
          id_cliente,
          idRestaurante
        ]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          mensaje: 'Cliente no encontrado'
        });
      }

      return res.json({
        mensaje: 'Cliente actualizado correctamente'
      });

    } catch (error) {
      console.error('Error actualizando cliente:', error);

      return res.status(500).json({
        mensaje: 'Error actualizando cliente'
      });
    }
  }
);

// =====================================================
// CLIENTES - CAMBIAR ESTADO
// =====================================================

app.patch('/clientes/:id_cliente/estado',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA', 'MESERO'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const { id_cliente } = req.params;
      const { estado } = req.body;

      const nuevoEstado = Number(estado) === 1 ? 1 : 0;

      const [result] = await db.query(
        `
        UPDATE clientes
        SET estado = ?
        WHERE id_cliente = ?
        AND id_restaurante = ?
        `,
        [nuevoEstado, id_cliente, idRestaurante]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          mensaje: 'Cliente no encontrado'
        });
      }

      return res.json({
        mensaje: nuevoEstado === 1
          ? 'Cliente activado correctamente'
          : 'Cliente desactivado correctamente'
      });

    } catch (error) {
      console.error('Error cambiando estado del cliente:', error);

      return res.status(500).json({
        mensaje: 'Error cambiando estado del cliente'
      });
    }
  }
);

// =====================================================
// CLIENTES - ELIMINAR
// =====================================================

app.delete('/clientes/:id_cliente',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const { id_cliente } = req.params;

      const [usado] = await db.query(
        `
        SELECT id_pedido
        FROM pedidos
        WHERE id_cliente = ?
        AND id_restaurante = ?
        LIMIT 1
        `,
        [id_cliente, idRestaurante]
      );

      if (usado.length > 0) {
        return res.status(400).json({
          mensaje: 'No puedes eliminar este cliente porque ya tiene pedidos relacionados. Puedes desactivarlo.'
        });
      }

      const [result] = await db.query(
        `
        DELETE FROM clientes
        WHERE id_cliente = ?
        AND id_restaurante = ?
        `,
        [id_cliente, idRestaurante]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          mensaje: 'Cliente no encontrado'
        });
      }

      return res.json({
        mensaje: 'Cliente eliminado correctamente'
      });

    } catch (error) {
      console.error('Error eliminando cliente:', error);

      return res.status(500).json({
        mensaje: 'Error eliminando cliente'
      });
    }
  }
);

// =====================================================
// CONFIGURACIÓN - OBTENER
// =====================================================

app.get('/configuracion',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const [restauranteRows] = await db.query(
        `
        SELECT 
          id_restaurante,
          nombre,
          telefono,
          direccion,
          nit,
          logo,
          estado
        FROM restaurantes
        WHERE id_restaurante = ?
        LIMIT 1
        `,
        [idRestaurante]
      );

      if (restauranteRows.length === 0) {
        return res.status(404).json({
          mensaje: 'Restaurante no encontrado'
        });
      }

      let [configRows] = await db.query(
        `
        SELECT 
          id_configuracion,
          id_restaurante,
          cobra_propina,
          porcentaje_propina,
          imprime_comanda,
          imprime_ticket,
          moneda
        FROM configuracion_restaurante
        WHERE id_restaurante = ?
        LIMIT 1
        `,
        [idRestaurante]
      );

      if (configRows.length === 0) {
        await db.query(
          `
          INSERT INTO configuracion_restaurante (
            id_restaurante,
            cobra_propina,
            porcentaje_propina,
            imprime_comanda,
            imprime_ticket,
            moneda
          ) VALUES (?, ?, ?, ?, ?, ?)
          `,
          [idRestaurante, 0, 0, 0, 0, 'Q']
        );

        [configRows] = await db.query(
          `
          SELECT 
            id_configuracion,
            id_restaurante,
            cobra_propina,
            porcentaje_propina,
            imprime_comanda,
            imprime_ticket,
            moneda
          FROM configuracion_restaurante
          WHERE id_restaurante = ?
          LIMIT 1
          `,
          [idRestaurante]
        );
      }

      return res.json({
        restaurante: restauranteRows[0],
        configuracion: configRows[0]
      });

    } catch (error) {
      console.error('Error obteniendo configuración:', error);

      return res.status(500).json({
        mensaje: 'Error obteniendo configuración'
      });
    }
  }
);

// =====================================================
// CONFIGURACIÓN - ACTUALIZAR RESTAURANTE
// =====================================================

app.put('/configuracion/restaurante',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const {
        nombre,
        telefono,
        direccion,
        nit,
        logo
      } = req.body;

      if (!nombre || !nombre.trim()) {
        return res.status(400).json({
          mensaje: 'El nombre del restaurante es obligatorio'
        });
      }

      const [result] = await db.query(
        `
        UPDATE restaurantes
        SET 
          nombre = ?,
          telefono = ?,
          direccion = ?,
          nit = ?,
          logo = ?
        WHERE id_restaurante = ?
        `,
        [
          nombre.trim(),
          telefono || null,
          direccion || null,
          nit || 'CF',
          logo || null,
          idRestaurante
        ]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          mensaje: 'Restaurante no encontrado'
        });
      }

      return res.json({
        mensaje: 'Datos del restaurante actualizados correctamente'
      });

    } catch (error) {
      console.error('Error actualizando restaurante:', error);

      return res.status(500).json({
        mensaje: 'Error actualizando datos del restaurante'
      });
    }
  }
);

// =====================================================
// CONFIGURACIÓN - ACTUALIZAR OPCIONES
// =====================================================

app.put('/configuracion/opciones',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const {
        cobra_propina,
        porcentaje_propina,
        imprime_comanda,
        imprime_ticket,
        moneda
      } = req.body;

      const cobraPropina = Number(cobra_propina) === 1 ? 1 : 0;
      const porcentajePropina = Number(porcentaje_propina || 0);
      const imprimeComanda = Number(imprime_comanda) === 1 ? 1 : 0;
      const imprimeTicket = Number(imprime_ticket) === 1 ? 1 : 0;

      if (porcentajePropina < 0) {
        return res.status(400).json({
          mensaje: 'El porcentaje de propina no puede ser negativo'
        });
      }

      const [existe] = await db.query(
        `
        SELECT id_configuracion
        FROM configuracion_restaurante
        WHERE id_restaurante = ?
        LIMIT 1
        `,
        [idRestaurante]
      );

      if (existe.length === 0) {
        await db.query(
          `
          INSERT INTO configuracion_restaurante (
            id_restaurante,
            cobra_propina,
            porcentaje_propina,
            imprime_comanda,
            imprime_ticket,
            moneda
          ) VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            idRestaurante,
            cobraPropina,
            porcentajePropina,
            imprimeComanda,
            imprimeTicket,
            moneda || 'Q'
          ]
        );
      } else {
        await db.query(
          `
          UPDATE configuracion_restaurante
          SET 
            cobra_propina = ?,
            porcentaje_propina = ?,
            imprime_comanda = ?,
            imprime_ticket = ?,
            moneda = ?
          WHERE id_restaurante = ?
          `,
          [
            cobraPropina,
            porcentajePropina,
            imprimeComanda,
            imprimeTicket,
            moneda || 'Q',
            idRestaurante
          ]
        );
      }

      return res.json({
        mensaje: 'Configuración actualizada correctamente'
      });

    } catch (error) {
      console.error('Error actualizando configuración:', error);

      return res.status(500).json({
        mensaje: 'Error actualizando configuración'
      });
    }
  }
);

// =====================================================
// PAGOS - LISTAR
// =====================================================

app.get('/pagos',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const {
        fecha_inicio,
        fecha_fin,
        metodo_pago,
        buscar
      } = req.query;

      let condiciones = ['pg.id_restaurante = ?'];
      let params = [idRestaurante];

      if (fecha_inicio) {
        condiciones.push('DATE(pg.fecha_pago) >= ?');
        params.push(fecha_inicio);
      }

      if (fecha_fin) {
        condiciones.push('DATE(pg.fecha_pago) <= ?');
        params.push(fecha_fin);
      }

      if (metodo_pago && metodo_pago !== 'todos') {
        condiciones.push('pg.metodo_pago = ?');
        params.push(metodo_pago);
      }

      if (buscar && buscar.trim()) {
        condiciones.push(`
          (
            pg.id_pedido LIKE ?
            OR pg.referencia LIKE ?
            OR pg.observaciones LIKE ?
            OR p.cliente_nombre LIKE ?
            OR p.cliente_telefono LIKE ?
            OR m.numero_mesa LIKE ?
            OR u.nombre LIKE ?
          )
        `);

        const texto = `%${buscar.trim()}%`;
        params.push(texto, texto, texto, texto, texto, texto, texto);
      }

      const [pagos] = await db.query(
        `
        SELECT 
          pg.id_pago,
          pg.id_restaurante,
          pg.id_pedido,
          pg.id_usuario,
          u.nombre AS usuario,
          pg.metodo_pago,
          pg.monto,
          pg.referencia,
          pg.observaciones,
          pg.fecha_pago,
          p.tipo_pedido,
          p.estado AS estado_pedido,
          p.cliente_nombre,
          p.cliente_telefono,
          p.total,
          p.total_pagado,
          p.saldo_pendiente,
          m.numero_mesa
        FROM pagos pg
        INNER JOIN pedidos p
          ON pg.id_pedido = p.id_pedido
        LEFT JOIN usuarios u
          ON pg.id_usuario = u.id_usuario
        LEFT JOIN mesas m
          ON p.id_mesa = m.id_mesa
        WHERE ${condiciones.join(' AND ')}
        ORDER BY pg.fecha_pago DESC, pg.id_pago DESC
        LIMIT 500
        `,
        params
      );

      const [[resumen]] = await db.query(
        `
        SELECT 
          COUNT(*) AS total_pagos,
          SUM(pg.monto) AS monto_total,
          SUM(CASE WHEN pg.metodo_pago = 'efectivo' THEN pg.monto ELSE 0 END) AS efectivo,
          SUM(CASE WHEN pg.metodo_pago = 'tarjeta' THEN pg.monto ELSE 0 END) AS tarjeta,
          SUM(CASE WHEN pg.metodo_pago = 'transferencia' THEN pg.monto ELSE 0 END) AS transferencia,
          SUM(CASE WHEN pg.metodo_pago = 'mixto' THEN pg.monto ELSE 0 END) AS mixto,
          SUM(CASE WHEN pg.metodo_pago = 'otro' THEN pg.monto ELSE 0 END) AS otro
        FROM pagos pg
        INNER JOIN pedidos p
          ON pg.id_pedido = p.id_pedido
        LEFT JOIN usuarios u
          ON pg.id_usuario = u.id_usuario
        LEFT JOIN mesas m
          ON p.id_mesa = m.id_mesa
        WHERE ${condiciones.join(' AND ')}
        `,
        params
      );

      return res.json({
        pagos,
        resumen: {
          total_pagos: Number(resumen.total_pagos || 0),
          monto_total: Number(resumen.monto_total || 0),
          efectivo: Number(resumen.efectivo || 0),
          tarjeta: Number(resumen.tarjeta || 0),
          transferencia: Number(resumen.transferencia || 0),
          mixto: Number(resumen.mixto || 0),
          otro: Number(resumen.otro || 0)
        }
      });

    } catch (error) {
      console.error('Error obteniendo pagos:', error);

      return res.status(500).json({
        mensaje: 'Error obteniendo pagos'
      });
    }
  }
);

// =====================================================
// PAGOS - VER DETALLE
// =====================================================

app.get('/pagos/:id_pago',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const { id_pago } = req.params;

      const [pagoRows] = await db.query(
        `
        SELECT 
          pg.id_pago,
          pg.id_restaurante,
          pg.id_pedido,
          pg.id_usuario,
          u.nombre AS usuario,
          pg.metodo_pago,
          pg.monto,
          pg.referencia,
          pg.observaciones,
          pg.fecha_pago,
          p.tipo_pedido,
          p.estado AS estado_pedido,
          p.cliente_nombre,
          p.cliente_telefono,
          p.subtotal,
          p.descuento,
          p.propina,
          p.total,
          p.total_pagado,
          p.saldo_pendiente,
          m.numero_mesa
        FROM pagos pg
        INNER JOIN pedidos p
          ON pg.id_pedido = p.id_pedido
        LEFT JOIN usuarios u
          ON pg.id_usuario = u.id_usuario
        LEFT JOIN mesas m
          ON p.id_mesa = m.id_mesa
        WHERE pg.id_pago = ?
        AND pg.id_restaurante = ?
        LIMIT 1
        `,
        [id_pago, idRestaurante]
      );

      if (pagoRows.length === 0) {
        return res.status(404).json({
          mensaje: 'Pago no encontrado'
        });
      }

      return res.json(pagoRows[0]);

    } catch (error) {
      console.error('Error obteniendo detalle del pago:', error);

      return res.status(500).json({
        mensaje: 'Error obteniendo detalle del pago'
      });
    }
  }
);

// =====================================================
// PEDIDOS - CREAR NUEVA ORDEN PARA LA MISMA MESA
// =====================================================

app.post('/pedidos/:id_pedido/agregar-productos',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA', 'MESERO'),
  async (req, res) => {
    const connection = await db.getConnection();

    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) {
        connection.release();
        return;
      }

      const idUsuario = req.user.id_usuario || req.user.id;
      const { id_pedido } = req.params;
      const { productos } = req.body;

      if (!Array.isArray(productos) || productos.length === 0) {
        connection.release();
        return res.status(400).json({
          mensaje: 'Debes enviar al menos un producto'
        });
      }

      await connection.beginTransaction();

      // Buscar el pedido original para copiar mesa y cliente
      const [pedidoRows] = await connection.query(
        `
        SELECT 
          id_pedido,
          id_restaurante,
          id_mesa,
          id_cliente,
          id_mesero,
          tipo_pedido,
          estado,
          cliente_nombre,
          cliente_telefono
        FROM pedidos
        WHERE id_pedido = ?
        AND id_restaurante = ?
        LIMIT 1
        `,
        [id_pedido, idRestaurante]
      );

      if (pedidoRows.length === 0) {
        await connection.rollback();
        connection.release();

        return res.status(404).json({
          mensaje: 'Pedido original no encontrado'
        });
      }

      const pedidoOriginal = pedidoRows[0];

      if (pedidoOriginal.estado === 'cancelado') {
        await connection.rollback();
        connection.release();

        return res.status(400).json({
          mensaje: 'No puedes crear una nueva orden desde un pedido cancelado'
        });
      }

      let subtotalNuevo = 0;
      const productosParaDetalle = [];

      for (const item of productos) {
        const idProducto = Number(item.id_producto);
        const cantidad = Number(item.cantidad || 0);
        const observaciones = item.observaciones || null;

        if (!idProducto || cantidad <= 0) {
          await connection.rollback();
          connection.release();

          return res.status(400).json({
            mensaje: 'Producto o cantidad inválida'
          });
        }

        const [productoRows] = await connection.query(
          `
          SELECT 
            id_producto,
            nombre,
            precio,
            estado
          FROM productos
          WHERE id_producto = ?
          AND id_restaurante = ?
          LIMIT 1
          `,
          [idProducto, idRestaurante]
        );

        if (productoRows.length === 0) {
          await connection.rollback();
          connection.release();

          return res.status(404).json({
            mensaje: 'Producto no encontrado'
          });
        }

        const producto = productoRows[0];

        if (Number(producto.estado) !== 1) {
          await connection.rollback();
          connection.release();

          return res.status(400).json({
            mensaje: `El producto "${producto.nombre}" está inactivo`
          });
        }

        const precioUnitario = Number(producto.precio || 0);
        const subtotalLinea = precioUnitario * cantidad;

        subtotalNuevo += subtotalLinea;

        productosParaDetalle.push({
          id_producto: idProducto,
          cantidad,
          precio_unitario: precioUnitario,
          subtotal: subtotalLinea,
          observaciones
        });
      }

      const descuento = 0;
      const propina = 0;
      const totalNuevo = subtotalNuevo - descuento + propina;

      // Crear nuevo pedido independiente para la misma mesa
      const [pedidoNuevoResult] = await connection.query(
        `
        INSERT INTO pedidos (
          id_restaurante,
          id_mesa,
          id_cliente,
          id_mesero,
          tipo_pedido,
          estado,
          cliente_nombre,
          cliente_telefono,
          subtotal,
          descuento,
          propina,
          total,
          total_pagado,
          saldo_pendiente
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          idRestaurante,
          pedidoOriginal.id_mesa || null,
          pedidoOriginal.id_cliente || null,
          idUsuario,
          pedidoOriginal.tipo_pedido || 'mesa',
          'en_cocina',
          pedidoOriginal.cliente_nombre || null,
          pedidoOriginal.cliente_telefono || null,
          subtotalNuevo,
          descuento,
          propina,
          totalNuevo,
          0,
          totalNuevo
        ]
      );

      const idPedidoNuevo = pedidoNuevoResult.insertId;

      // Insertar productos en el detalle del nuevo pedido
      for (const item of productosParaDetalle) {
        await connection.query(
          `
          INSERT INTO pedido_detalle (
            id_pedido,
            id_producto,
            cantidad,
            precio_unitario,
            subtotal,
            observaciones,
            estado_cocina
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            idPedidoNuevo,
            item.id_producto,
            item.cantidad,
            item.precio_unitario,
            item.subtotal,
            item.observaciones,
            'pendiente'
          ]
        );
      }

      // Mantener la mesa ocupada
      if (pedidoOriginal.id_mesa) {
        await connection.query(
          `
          UPDATE mesas
          SET estado = 'ocupada'
          WHERE id_mesa = ?
          AND id_restaurante = ?
          `,
          [pedidoOriginal.id_mesa, idRestaurante]
        );
      }

      // Guardar bitácora si existe y coincide
      try {
        await connection.query(
          `
          INSERT INTO bitacora_pedidos (
            id_pedido,
            id_usuario,
            accion,
            descripcion
          ) VALUES (?, ?, ?, ?)
          `,
          [
            idPedidoNuevo,
            idUsuario,
            'NUEVA_ORDEN_MISMA_MESA',
            `Se creó una nueva orden para la misma mesa desde el pedido #${id_pedido}`
          ]
        );
      } catch (bitacoraError) {
        console.log('No se pudo guardar bitácora, pero la nueva orden sí fue creada');
      }

      await connection.commit();
      connection.release();

      return res.status(201).json({
        mensaje: 'Nueva orden creada correctamente para la misma mesa',
        id_pedido_original: Number(id_pedido),
        id_pedido_nuevo: idPedidoNuevo,
        subtotal: subtotalNuevo,
        total: totalNuevo,
        saldo_pendiente: totalNuevo
      });

    } catch (error) {
      await connection.rollback();
      connection.release();

      console.error('Error creando nueva orden para la misma mesa:', error);

      return res.status(500).json({
        mensaje: 'Error creando nueva orden para la misma mesa',
        error: error.message
      });
    }
  }
);

// =====================================================
// CAJA - ACTUALIZAR PROPINA DEL PEDIDO
// =====================================================

app.patch('/caja/pedidos/:id_pedido/propina',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const { id_pedido } = req.params;
      const { propina } = req.body;

      const nuevaPropina = Number(propina || 0);

      if (nuevaPropina < 0) {
        return res.status(400).json({
          mensaje: 'La propina no puede ser negativa'
        });
      }

      const [pedidoRows] = await db.query(
        `
        SELECT 
          id_pedido,
          subtotal,
          descuento,
          total_pagado,
          estado
        FROM pedidos
        WHERE id_pedido = ?
        AND id_restaurante = ?
        LIMIT 1
        `,
        [id_pedido, idRestaurante]
      );

      if (pedidoRows.length === 0) {
        return res.status(404).json({
          mensaje: 'Pedido no encontrado'
        });
      }

      const pedido = pedidoRows[0];

      if (pedido.estado === 'pagado' || pedido.estado === 'cancelado') {
        return res.status(400).json({
          mensaje: 'No puedes modificar la propina de un pedido pagado o cancelado'
        });
      }

      const subtotal = Number(pedido.subtotal || 0);
      const descuento = Number(pedido.descuento || 0);
      const totalPagado = Number(pedido.total_pagado || 0);

      const nuevoTotal = subtotal - descuento + nuevaPropina;
      const nuevoSaldoPendiente = nuevoTotal - totalPagado;

      await db.query(
        `
        UPDATE pedidos
        SET 
          propina = ?,
          total = ?,
          saldo_pendiente = ?
        WHERE id_pedido = ?
        AND id_restaurante = ?
        `,
        [
          nuevaPropina,
          nuevoTotal,
          nuevoSaldoPendiente,
          id_pedido,
          idRestaurante
        ]
      );

      return res.json({
        mensaje: 'Propina actualizada correctamente',
        propina: nuevaPropina,
        total: nuevoTotal,
        saldo_pendiente: nuevoSaldoPendiente
      });

    } catch (error) {
      console.error('Error actualizando propina:', error);

      return res.status(500).json({
        mensaje: 'Error actualizando propina'
      });
    }
  }
);

// =====================================================
// CAJA - COBRAR VARIOS PEDIDOS EN UNA SOLA CUENTA
// =====================================================

app.post('/caja/pagos-multiple',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA'),
  async (req, res) => {
    const connection = await db.getConnection();

    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) {
        connection.release();
        return;
      }

      const idUsuario = req.user.id_usuario || req.user.id;

      const {
        pedidos,
        metodo_pago,
        monto,
        referencia,
        observaciones,

        nit_facturacion,
        nombre_facturacion,
        direccion_facturacion,
        correo_facturacion
      } = req.body;

      if (!Array.isArray(pedidos) || pedidos.length === 0) {
        connection.release();
        return res.status(400).json({
          mensaje: 'Debes seleccionar al menos un pedido'
        });
      }

      const montoPago = Number(monto || 0);

      if (montoPago <= 0) {
        connection.release();
        return res.status(400).json({
          mensaje: 'El monto debe ser mayor a 0'
        });
      }

      const metodosPermitidos = [
        'efectivo',
        'tarjeta',
        'transferencia',
        'mixto',
        'otro'
      ];

      if (!metodo_pago || !metodosPermitidos.includes(metodo_pago)) {
        connection.release();
        return res.status(400).json({
          mensaje: 'Método de pago no válido'
        });
      }

      const idsPedidos = pedidos.map((id) => Number(id)).filter(Boolean);

      if (idsPedidos.length === 0) {
        connection.release();
        return res.status(400).json({
          mensaje: 'Pedidos inválidos'
        });
      }

      await connection.beginTransaction();

      const placeholders = idsPedidos.map(() => '?').join(',');

      const [pedidoRows] = await connection.query(
        `
        SELECT 
          id_pedido,
          id_restaurante,
          id_mesa,
          id_cliente,
          estado,
          total,
          total_pagado,
          saldo_pendiente
        FROM pedidos
        WHERE id_restaurante = ?
        AND id_pedido IN (${placeholders})
        FOR UPDATE
        `,
        [idRestaurante, ...idsPedidos]
      );

      if (pedidoRows.length !== idsPedidos.length) {
        await connection.rollback();
        connection.release();

        return res.status(404).json({
          mensaje: 'Uno o más pedidos no fueron encontrados'
        });
      }

      const pedidosOrdenados = pedidoRows.sort((a, b) => {
        return idsPedidos.indexOf(Number(a.id_pedido)) - idsPedidos.indexOf(Number(b.id_pedido));
      });

      for (const pedido of pedidosOrdenados) {
        if (pedido.estado === 'pagado' || pedido.estado === 'cancelado') {
          await connection.rollback();
          connection.release();

          return res.status(400).json({
            mensaje: `El pedido #${pedido.id_pedido} ya está pagado o cancelado`
          });
        }
      }

      const totalPendiente = pedidosOrdenados.reduce((acc, pedido) => {
        return acc + Number(pedido.saldo_pendiente || 0);
      }, 0);

      if (montoPago > totalPendiente) {
        await connection.rollback();
        connection.release();

        return res.status(400).json({
          mensaje: `El monto no puede ser mayor al total pendiente de la cuenta: Q${totalPendiente.toFixed(2)}`
        });
      }

      const idClienteFacturacion = await obtenerOCrearClienteFacturacion(
        connection,
        {
          idRestaurante,
          idCliente: pedidosOrdenados[0]?.id_cliente || null,
          nit: nit_facturacion,
          nombreFacturacion: nombre_facturacion,
          direccionFacturacion: direccion_facturacion,
          correoFacturacion: correo_facturacion
        }
      );

      let restante = montoPago;
      const pagosRegistrados = [];

      for (const pedido of pedidosOrdenados) {
        if (restante <= 0) break;

        const saldoPedido = Number(pedido.saldo_pendiente || 0);

        if (saldoPedido <= 0) continue;

        const montoAplicado = Math.min(restante, saldoPedido);
        const nuevoTotalPagado = Number(pedido.total_pagado || 0) + montoAplicado;
        const nuevoSaldo = saldoPedido - montoAplicado;
        const nuevoEstado = nuevoSaldo <= 0.0001 ? 'pagado' : pedido.estado;

        await connection.query(
          `
          INSERT INTO pagos (
            id_restaurante,
            id_pedido,
            id_usuario,
            metodo_pago,
            monto,
            referencia,
            observaciones
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            idRestaurante,
            pedido.id_pedido,
            idUsuario,
            metodo_pago,
            montoAplicado,
            referencia || null,
            observaciones
              ? `${observaciones} | Cuenta unificada`
              : 'Pago por cuenta unificada'
          ]
        );

        await connection.query(
          `
          UPDATE pedidos
          SET 
            total_pagado = ?,
            saldo_pendiente = ?,
            estado = ?,
            id_cajero = ?,
            id_cliente_facturacion = ?,
            fecha_pagado = CASE WHEN ? = 'pagado' THEN NOW() ELSE fecha_pagado END
          WHERE id_pedido = ?
          AND id_restaurante = ?
          `,
          [
            nuevoTotalPagado,
            nuevoSaldo <= 0.0001 ? 0 : nuevoSaldo,
            nuevoEstado,
            idUsuario,
            idClienteFacturacion,
            nuevoEstado,
            pedido.id_pedido,
            idRestaurante
          ]
        );

        pagosRegistrados.push({
          id_pedido: pedido.id_pedido,
          monto_aplicado: montoAplicado,
          saldo_restante: nuevoSaldo <= 0.0001 ? 0 : nuevoSaldo,
          estado: nuevoEstado
        });

        restante -= montoAplicado;

        try {
          await connection.query(
            `
            INSERT INTO bitacora_pedidos (
              id_restaurante,
              id_pedido,
              id_usuario,
              accion,
              descripcion
            ) VALUES (?, ?, ?, ?, ?)
            `,
            [
              idRestaurante,
              pedido.id_pedido,
              idUsuario,
              'PAGO_CUENTA_UNIFICADA',
              `Se aplicó pago de Q${montoAplicado.toFixed(2)} desde una cuenta unificada`
            ]
          );
        } catch (bitacoraError) {
          console.log('No se pudo guardar bitácora del pago unificado');
        }
      }

      const mesasARevisar = [
        ...new Set(
          pedidosOrdenados
            .map((pedido) => pedido.id_mesa)
            .filter((idMesa) => idMesa !== null && idMesa !== undefined)
        )
      ];

      for (const idMesa of mesasARevisar) {
        const [[pendientesMesa]] = await connection.query(
          `
          SELECT COUNT(*) AS total_pendientes
          FROM pedidos
          WHERE id_restaurante = ?
          AND id_mesa = ?
          AND estado NOT IN ('pagado', 'cancelado')
          AND saldo_pendiente > 0
          `,
          [idRestaurante, idMesa]
        );

        if (Number(pendientesMesa.total_pendientes || 0) === 0) {
          await connection.query(
            `
            UPDATE mesas
            SET estado = 'libre'
            WHERE id_mesa = ?
            AND id_restaurante = ?
            `,
            [idMesa, idRestaurante]
          );
        }
      }

      await connection.commit();
      connection.release();

      return res.json({
        mensaje: 'Cuenta unificada cobrada correctamente',
        total_cuenta: totalPendiente,
        monto_pagado: montoPago,
        id_cliente_facturacion: idClienteFacturacion,
        pagos_registrados: pagosRegistrados
      });

    } catch (error) {
      await connection.rollback();
      connection.release();

      console.error('Error cobrando cuenta unificada:', error);

      return res.status(500).json({
        mensaje: 'Error cobrando cuenta unificada',
        error: error.message
      });
    }
  }
);

// =====================================================
// MENU DEL RESTAURANTE
// =====================================================

app.get(
  '/menu-restaurante',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA', 'MESERO', 'COCINA'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const [productos] = await db.query(
        `
        SELECT 
          p.id_producto,
          p.id_restaurante,
          p.id_categoria,
          p.nombre,
          p.descripcion,
          p.precio,
          p.imagen,
          p.estado,
          c.nombre AS categoria
        FROM productos p
        LEFT JOIN categorias c
          ON p.id_categoria = c.id_categoria
        WHERE p.id_restaurante = ?
          AND p.estado = 1
        ORDER BY c.nombre ASC, p.nombre ASC
        `,
        [idRestaurante]
      );

      return res.json(productos);

    } catch (error) {
      console.error('Error obteniendo menú del restaurante:', error);

      return res.status(500).json({
        mensaje: 'Error obteniendo menú del restaurante'
      });
    }
  }
);

// =====================================================
// CLIENTES FACTURACIÓN - BUSCAR POR NIT
// =====================================================

app.get('/clientes-facturacion/buscar',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA', 'MESERO'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const { nit } = req.query;

      if (!nit || !nit.trim()) {
        return res.status(400).json({
          mensaje: 'El NIT es obligatorio'
        });
      }

      const nitLimpio = nit.trim().toUpperCase();

      const [rows] = await db.query(
        `
        SELECT 
          id_cliente_facturacion,
          id_restaurante,
          id_cliente,
          nit,
          nombre_facturacion,
          direccion_facturacion,
          correo_facturacion,
          estado
        FROM clientes_facturacion
        WHERE id_restaurante = ?
        AND nit = ?
        AND estado = 1
        LIMIT 1
        `,
        [idRestaurante, nitLimpio]
      );

      if (rows.length === 0) {
        return res.json(null);
      }

      return res.json(rows[0]);

    } catch (error) {
      console.error('Error buscando cliente por NIT:', error);

      return res.status(500).json({
        mensaje: 'Error buscando cliente por NIT'
      });
    }
  }
);

// =====================================================
// CLIENTES FACTURACIÓN - LISTAR CLIENTES CON RESUMEN
// =====================================================

app.get('/clientes-facturacion',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const { buscar } = req.query;

      let whereBuscar = '';
      const params = [idRestaurante];

      if (buscar && buscar.trim()) {
        whereBuscar = `
          AND (
            cf.nit LIKE ?
            OR cf.nombre_facturacion LIKE ?
            OR cf.correo_facturacion LIKE ?
            OR cf.direccion_facturacion LIKE ?
          )
        `;

        const texto = `%${buscar.trim()}%`;

        params.push(texto, texto, texto, texto);
      }

      const [clientes] = await db.query(
        `
        SELECT 
          cf.id_cliente_facturacion,
          cf.id_restaurante,
          cf.id_cliente,
          cf.nit,
          cf.nombre_facturacion,
          cf.direccion_facturacion,
          cf.correo_facturacion,
          cf.estado,
          cf.fecha_creacion,
          cf.fecha_actualizacion,

          COUNT(p.id_pedido) AS total_pedidos,
          COALESCE(SUM(p.total), 0) AS total_consumido,
          COALESCE(SUM(p.total_pagado), 0) AS total_pagado,
          COALESCE(SUM(p.saldo_pendiente), 0) AS saldo_pendiente,
          MAX(p.fecha_pedido) AS ultima_compra

        FROM clientes_facturacion cf
        LEFT JOIN pedidos p
          ON cf.id_cliente_facturacion = p.id_cliente_facturacion
          AND p.id_restaurante = cf.id_restaurante
          AND p.estado <> 'cancelado'

        WHERE cf.id_restaurante = ?
        ${whereBuscar}

        GROUP BY 
          cf.id_cliente_facturacion,
          cf.id_restaurante,
          cf.id_cliente,
          cf.nit,
          cf.nombre_facturacion,
          cf.direccion_facturacion,
          cf.correo_facturacion,
          cf.estado,
          cf.fecha_creacion,
          cf.fecha_actualizacion

        ORDER BY 
          ultima_compra DESC,
          cf.fecha_actualizacion DESC
        `,
        params
      );

      return res.json(clientes);

    } catch (error) {
      console.error('Error obteniendo clientes de facturación:', error);

      return res.status(500).json({
        mensaje: 'Error obteniendo clientes de facturación',
        error: error.message
      });
    }
  }
);


// =====================================================
// CLIENTES FACTURACIÓN - PEDIDOS DEL CLIENTE
// =====================================================

app.get('/clientes-facturacion/:id_cliente_facturacion/pedidos',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const { id_cliente_facturacion } = req.params;

      const [clienteRows] = await db.query(
        `
        SELECT 
          id_cliente_facturacion,
          nit,
          nombre_facturacion,
          direccion_facturacion,
          correo_facturacion
        FROM clientes_facturacion
        WHERE id_cliente_facturacion = ?
        AND id_restaurante = ?
        LIMIT 1
        `,
        [id_cliente_facturacion, idRestaurante]
      );

      if (clienteRows.length === 0) {
        return res.status(404).json({
          mensaje: 'Cliente no encontrado'
        });
      }

      const [pedidos] = await db.query(
        `
        SELECT 
          p.id_pedido,
          p.id_restaurante,
          p.id_mesa,
          m.numero_mesa,
          p.id_cliente_facturacion,
          p.tipo_pedido,
          p.estado,
          p.cliente_nombre,
          p.cliente_telefono,
          p.subtotal,
          p.descuento,
          p.propina,
          p.total,
          p.total_pagado,
          p.saldo_pendiente,
          p.fecha_pedido,
          p.fecha_pagado,
          u.nombre AS mesero,
          cajero.nombre AS cajero
        FROM pedidos p
        LEFT JOIN mesas m
          ON p.id_mesa = m.id_mesa
        LEFT JOIN usuarios u
          ON p.id_mesero = u.id_usuario
        LEFT JOIN usuarios cajero
          ON p.id_cajero = cajero.id_usuario
        WHERE p.id_restaurante = ?
        AND p.id_cliente_facturacion = ?
        ORDER BY p.fecha_pedido DESC
        `,
        [idRestaurante, id_cliente_facturacion]
      );

      return res.json({
        cliente: clienteRows[0],
        pedidos
      });

    } catch (error) {
      console.error('Error obteniendo pedidos del cliente:', error);

      return res.status(500).json({
        mensaje: 'Error obteniendo pedidos del cliente',
        error: error.message
      });
    }
  }
);


// =====================================================
// CLIENTES FACTURACIÓN - DETALLE DE PEDIDO
// =====================================================

app.get('/clientes-facturacion/pedidos/:id_pedido',
  verificarToken,
  verificarUsuarioActivo,
  permitirRoles('ADMINISTRADOR', 'GERENTE', 'CAJA'),
  async (req, res) => {
    try {
      const idRestaurante = obtenerIdRestaurante(req, res);
      if (!idRestaurante) return;

      const { id_pedido } = req.params;

      const [pedidoRows] = await db.query(
        `
        SELECT 
          p.*,
          m.numero_mesa,
          u.nombre AS mesero,
          cajero.nombre AS cajero,
          cf.nit,
          cf.nombre_facturacion,
          cf.direccion_facturacion,
          cf.correo_facturacion
        FROM pedidos p
        LEFT JOIN mesas m
          ON p.id_mesa = m.id_mesa
        LEFT JOIN usuarios u
          ON p.id_mesero = u.id_usuario
        LEFT JOIN usuarios cajero
          ON p.id_cajero = cajero.id_usuario
        LEFT JOIN clientes_facturacion cf
          ON p.id_cliente_facturacion = cf.id_cliente_facturacion
        WHERE p.id_pedido = ?
        AND p.id_restaurante = ?
        LIMIT 1
        `,
        [id_pedido, idRestaurante]
      );

      if (pedidoRows.length === 0) {
        return res.status(404).json({
          mensaje: 'Pedido no encontrado'
        });
      }

      const [detalle] = await db.query(
        `
        SELECT 
          d.id_detalle,
          d.id_producto,
          pr.nombre AS producto,
          d.cantidad,
          d.precio_unitario,
          d.subtotal,
          d.observaciones,
          d.estado_cocina
        FROM pedido_detalle d
        INNER JOIN productos pr
          ON d.id_producto = pr.id_producto
        WHERE d.id_pedido = ?
        ORDER BY d.id_detalle ASC
        `,
        [id_pedido]
      );

      const [pagos] = await db.query(
        `
        SELECT 
          pg.id_pago,
          pg.metodo_pago,
          pg.monto,
          pg.referencia,
          pg.observaciones,
          pg.fecha_pago,
          u.nombre AS usuario
        FROM pagos pg
        LEFT JOIN usuarios u
          ON pg.id_usuario = u.id_usuario
        WHERE pg.id_pedido = ?
        AND pg.id_restaurante = ?
        ORDER BY pg.fecha_pago DESC
        `,
        [id_pedido, idRestaurante]
      );

      return res.json({
        pedido: pedidoRows[0],
        detalle,
        pagos
      });

    } catch (error) {
      console.error('Error obteniendo detalle del pedido del cliente:', error);

      return res.status(500).json({
        mensaje: 'Error obteniendo detalle del pedido del cliente',
        error: error.message
      });
    }
  }
);



app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);

  db.query('SELECT DATABASE() AS dbname, @@port AS port')
    .then(([rows]) => {
      console.log('✅ BASE CONECTADA:', rows[0].dbname);
      console.log('✅ PUERTO MYSQL:', rows[0].port);
    })
    .catch((err) => {
      console.error('Error comprobando base:', err);
    });
});