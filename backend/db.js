// db.js
const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

const config = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// SSL solo si estás en producción y tienes certificado configurado
if (process.env.NODE_ENV === 'production' && process.env.SSL_CERT) {
  config.ssl = {
    ca: fs.readFileSync(process.env.SSL_CERT)
  };
}

const pool = mysql.createPool(config);

// Prueba de conexión
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conectado exitosamente a la base de datos');
    connection.release();
  } catch (error) {
    console.error('❌ Error conectando a la base de datos:', error.message);
  }
})();

module.exports = pool;