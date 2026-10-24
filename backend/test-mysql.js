require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  try {
    console.log("Conectando a la BD...");
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });

    console.log("✅ Conexión establecida.");

    const [lotes] = await connection.query("SELECT * FROM lotes");
    console.log("Contenido de la tabla 'lotes':", lotes);

    const [join] = await connection.query(`
      SELECT
        lotes.*,
        medicamentos.nombre,
        medicamentos.descripcion,
        medicamentos.codigo_barra,
        medicamentos.modulo,
        medicamentos.tipo_venta,
        proveedores.nombre AS proveedor_nombre
      FROM lotes
      JOIN medicamentos ON lotes.id_medicamento = medicamentos.id_medicamento
      JOIN proveedores ON lotes.id_proveedor = proveedores.id_proveedor
    `);
    console.log("Resultado del JOIN:", join);

    await connection.end();
  } catch (err) {
    console.error("❌ Error en test-directo:", err);
  }
})();
