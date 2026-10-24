import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AuthContext from './AuthContext';
import Sidebar from './sidebar';
import Navbar from './Navbar';
import './Caja.css';

const URL = process.env.REACT_APP_URL_BACKEND || 'http://localhost:3001';

function Caja() {
  const { token, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const pedidoDesdeUrl = searchParams.get('pedido');

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [pedidos, setPedidos] = useState([]);
  const [buscar, setBuscar] = useState('');

  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const [detalle, setDetalle] = useState([]);
  const [pagos, setPagos] = useState([]);

  const [pedidosCuenta, setPedidosCuenta] = useState([]);

  const [pago, setPago] = useState({
    metodo_pago: 'efectivo',
    monto: '',
    referencia: '',
    observaciones: ''
  });

  const authToken = token || localStorage.getItem('token');

  const getConfig = () => ({
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  });

  const toggleSidebar = () => {
    setSidebarOpen(!isSidebarOpen);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const cargarPedidos = async () => {
    try {
      setCargando(true);

      const params = new URLSearchParams();

      if (buscar.trim()) {
        params.append('buscar', buscar.trim());
      }

      const response = await axios.get(
        `${URL}/caja/pedidos?${params.toString()}`,
        getConfig()
      );

      setPedidos(response.data || []);

    } catch (error) {
      console.error('Error cargando caja:', error);

      if (error.response?.status === 401 || error.response?.status === 403) {
        Swal.fire('Sesión vencida', 'Inicia sesión nuevamente', 'warning');
        logout();
        navigate('/login');
        return;
      }

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudieron cargar los pedidos de caja',
        'error'
      );

    } finally {
      setCargando(false);
    }
  };

  const cargarDetallePedido = async (idPedido) => {
    try {
      setCargando(true);

      const response = await axios.get(
        `${URL}/caja/pedidos/${idPedido}`,
        getConfig()
      );

      setPedidoSeleccionado(response.data.pedido);
      setDetalle(response.data.detalle || []);
      setPagos(response.data.pagos || []);

      const saldo = Number(response.data.pedido?.saldo_pendiente || 0);

      setPago({
        metodo_pago: 'efectivo',
        monto: saldo > 0 ? saldo.toFixed(2) : '',
        referencia: '',
        observaciones: ''
      });

    } catch (error) {
      console.error('Error cargando detalle de caja:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo cargar el detalle del pedido',
        'error'
      );

    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarPedidos();

    if (pedidoDesdeUrl) {
      cargarDetallePedido(pedidoDesdeUrl);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoDesdeUrl]);

  const handlePagoChange = (e) => {
    const { name, value } = e.target;

    setPago({
      ...pago,
      [name]: value
    });
  };

  const seleccionarPedido = (pedido) => {
    cargarDetallePedido(pedido.id_pedido);
  };

  const formatearMoneda = (valor) => {
    return `Q${Number(valor || 0).toFixed(2)}`;
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return 'Sin fecha';

    const fechaObj = new Date(fecha);

    if (Number.isNaN(fechaObj.getTime())) return 'Sin fecha';

    return fechaObj.toLocaleString('es-GT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const traducirEstado = (estado) => {
    const estados = {
      abierto: 'Abierto',
      en_cocina: 'En cocina',
      preparando: 'Preparando',
      listo: 'Listo',
      entregado: 'Entregado',
      pagado: 'Pagado',
      cancelado: 'Cancelado'
    };

    return estados[estado] || estado;
  };

  const traducirTipo = (tipo) => {
    const tipos = {
      mesa: 'Mesa',
      para_llevar: 'Para llevar',
      delivery: 'Delivery'
    };

    return tipos[tipo] || tipo;
  };

  const escaparHtml = (texto) => {
    if (!texto) return '';

    return String(texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const buscarNitFacturacion = async (nit) => {
    try {
      if (!nit || !nit.trim()) {
        return null;
      }

      const nitLimpio = nit.trim().toUpperCase();

      if (nitLimpio === 'CF') {
        return {
          nit: 'CF',
          nombre_facturacion: 'Consumidor final',
          direccion_facturacion: '',
          correo_facturacion: ''
        };
      }

      const response = await axios.get(
        `${URL}/clientes-facturacion/buscar?nit=${encodeURIComponent(nitLimpio)}`,
        getConfig()
      );

      return response.data || null;

    } catch (error) {
      console.error('Error buscando NIT:', error);
      return null;
    }
  };

  const generarHtmlPagoMixto = (totalMaximo) => {
    return `
      <div 
        id="swal-pago-mixto-box"
        style="
          display:none;
          background:#fff7ed;
          border:1px solid #fed7aa;
          border-radius:12px;
          padding:12px;
          margin:10px 0 14px;
        "
      >
        <h4 style="
          margin:0 0 10px;
          font-size:16px;
          font-weight:900;
          color:#9a3412;
        ">
          Distribución del pago mixto
        </h4>

        <p style="margin:0 0 10px; color:#7c2d12; font-size:13px;">
          Selecciona qué métodos usará el cliente y cuánto pagará con cada uno.
        </p>

        <div style="
          display:grid;
          grid-template-columns: 120px 1fr 1fr;
          gap:8px;
          align-items:center;
          margin-bottom:8px;
          font-weight:800;
          color:#374151;
          font-size:13px;
        ">
          <span>Método</span>
          <span>Monto</span>
          <span>Referencia</span>
        </div>

        ${['efectivo', 'tarjeta', 'transferencia', 'otro'].map((metodo) => {
          const labels = {
            efectivo: 'Efectivo',
            tarjeta: 'Tarjeta',
            transferencia: 'Transfer.',
            otro: 'Otro'
          };

          const placeholders = {
            efectivo: 'Opcional',
            tarjeta: 'Voucher / autorización',
            transferencia: 'No. transferencia',
            otro: 'Referencia'
          };

          return `
            <div style="
              display:grid;
              grid-template-columns: 120px 1fr 1fr;
              gap:8px;
              align-items:center;
              margin-bottom:8px;
            ">
              <label style="font-weight:700">
                <input type="checkbox" id="mixto-usar-${metodo}" />
                ${labels[metodo]}
              </label>

              <input 
                id="mixto-monto-${metodo}"
                type="number"
                min="0"
                step="0.01"
                class="swal2-input"
                style="width:100%; margin:0"
                value="0.00"
                disabled
              />

              <input 
                id="mixto-ref-${metodo}"
                type="text"
                class="swal2-input"
                style="width:100%; margin:0"
                placeholder="${placeholders[metodo]}"
                disabled
              />
            </div>
          `;
        }).join('')}

        <div style="
          display:flex;
          justify-content:space-between;
          gap:10px;
          background:white;
          border-radius:10px;
          padding:10px;
          font-size:15px;
          font-weight:900;
        ">
          <span>Total mixto:</span>
          <span id="mixto-total-texto">Q0.00</span>
        </div>

        <div style="
          display:flex;
          justify-content:space-between;
          gap:10px;
          margin-top:8px;
          color:#6b7280;
          font-size:13px;
          font-weight:700;
        ">
          <span>Total permitido:</span>
          <span>Q${Number(totalMaximo || 0).toFixed(2)}</span>
        </div>
      </div>
    `;
  };

  const configurarPagoMixto = () => {
    const metodoSelect = document.getElementById('swal-metodo-pago');
    const montoPagoInput = document.getElementById('swal-monto-pago');
    const referenciaPagoInput = document.getElementById('swal-referencia-pago');
    const mixtoBox = document.getElementById('swal-pago-mixto-box');
    const mixtoTotalTexto = document.getElementById('mixto-total-texto');

    const metodos = ['efectivo', 'tarjeta', 'transferencia', 'otro'];

    const actualizarTotalMixto = () => {
      let total = 0;

      metodos.forEach((metodo) => {
        const usar = document.getElementById(`mixto-usar-${metodo}`);
        const monto = document.getElementById(`mixto-monto-${metodo}`);

        if (usar?.checked) {
          total += Number(monto?.value || 0);
        }
      });

      if (mixtoTotalTexto) {
        mixtoTotalTexto.innerHTML = `Q${total.toFixed(2)}`;
      }

      if (montoPagoInput && metodoSelect?.value === 'mixto') {
        montoPagoInput.value = total.toFixed(2);
      }
    };

    const actualizarVistaMixto = () => {
      const esMixto = metodoSelect?.value === 'mixto';

      if (mixtoBox) {
        mixtoBox.style.display = esMixto ? 'block' : 'none';
      }

      if (montoPagoInput) {
        montoPagoInput.readOnly = esMixto;
        montoPagoInput.style.background = esMixto ? '#f3f4f6' : '#ffffff';
      }

      if (referenciaPagoInput) {
        referenciaPagoInput.disabled = esMixto;
        referenciaPagoInput.placeholder = esMixto
          ? 'Se usará la referencia de cada método'
          : 'Opcional';
      }

      actualizarTotalMixto();
    };

    metodos.forEach((metodo) => {
      const usar = document.getElementById(`mixto-usar-${metodo}`);
      const monto = document.getElementById(`mixto-monto-${metodo}`);
      const referencia = document.getElementById(`mixto-ref-${metodo}`);

      if (usar) {
        usar.addEventListener('change', () => {
          const activo = usar.checked;

          if (monto) {
            monto.disabled = !activo;

            if (!activo) {
              monto.value = '0.00';
            }
          }

          if (referencia) {
            referencia.disabled = !activo;

            if (!activo) {
              referencia.value = '';
            }
          }

          actualizarTotalMixto();
        });
      }

      if (monto) {
        monto.addEventListener('input', actualizarTotalMixto);
      }
    });

    if (metodoSelect) {
      metodoSelect.addEventListener('change', actualizarVistaMixto);
    }

    actualizarVistaMixto();
  };

  const obtenerPagosMixtosDesdeSwal = () => {
    const metodos = ['efectivo', 'tarjeta', 'transferencia', 'otro'];

    return metodos
      .map((metodo) => {
        const usar = document.getElementById(`mixto-usar-${metodo}`);
        const monto = document.getElementById(`mixto-monto-${metodo}`);
        const referencia = document.getElementById(`mixto-ref-${metodo}`);

        if (!usar?.checked) return null;

        return {
          metodo_pago: metodo,
          monto: Number(monto?.value || 0),
          referencia: referencia?.value || ''
        };
      })
      .filter((item) => item && item.monto > 0);
  };

  const textoMetodoPago = (datosPago) => {
    if (datosPago.metodo_pago !== 'mixto') {
      return datosPago.metodo_pago;
    }

    return datosPago.pagos_mixtos
      .map((item) => `${item.metodo_pago}: Q${Number(item.monto).toFixed(2)}`)
      .join(' / ');
  };

  const textoReferenciaPago = (datosPago) => {
    if (datosPago.metodo_pago !== 'mixto') {
      return datosPago.referencia;
    }

    return datosPago.pagos_mixtos
      .filter((item) => item.referencia)
      .map((item) => `${item.metodo_pago}: ${item.referencia}`)
      .join(' / ');
  };

  const imprimirReciboPago = ({
    pedido,
    detallePedido,
    montoPagado,
    metodoPago,
    referencia,
    observaciones,
    saldoDespues,
    datosFacturacion
  }) => {
    const fecha = new Date().toLocaleString('es-GT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const productosHtml = detallePedido.map((item) => {
      return `
        <tr>
          <td class="cantidad">${Number(item.cantidad)}</td>
          <td>
            <strong>${escaparHtml(item.producto)}</strong>
            ${
              item.observaciones
                ? `<br><small>Obs: ${escaparHtml(item.observaciones)}</small>`
                : ''
            }
          </td>
          <td class="precio">Q${Number(item.subtotal || 0).toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Recibo pedido #${pedido.id_pedido}</title>

          <style>
            * { box-sizing: border-box; }

            body {
              margin: 0;
              padding: 0;
              font-family: Arial, Helvetica, sans-serif;
              color: #000;
              background: #fff;
            }

            .ticket {
              width: 80mm;
              padding: 10px;
              margin: 0 auto;
            }

            .centrado { text-align: center; }

            h1 {
              margin: 0;
              font-size: 18px;
              font-weight: 800;
              text-transform: uppercase;
            }

            h2 {
              margin: 6px 0 4px;
              font-size: 15px;
              font-weight: 800;
            }

            p {
              margin: 3px 0;
              font-size: 12px;
            }

            .linea {
              border-top: 1px dashed #000;
              margin: 8px 0;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }

            td {
              padding: 4px 0;
              vertical-align: top;
            }

            .cantidad {
              width: 24px;
              font-weight: 800;
            }

            .precio {
              width: 60px;
              text-align: right;
              font-weight: 800;
            }

            small { font-size: 10px; }

            .totales div {
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              padding: 2px 0;
              gap: 8px;
            }

            .totales span {
              flex: 1;
            }

            .totales strong {
              text-align: right;
            }

            .total-final {
              font-size: 15px !important;
              font-weight: 900;
              border-top: 1px solid #000;
              margin-top: 5px;
              padding-top: 6px !important;
            }

            .footer {
              margin-top: 10px;
              text-align: center;
              font-size: 11px;
            }

            @media print {
              @page {
                size: 80mm auto;
                margin: 0;
              }

              body { margin: 0; }

              .ticket {
                width: 80mm;
                margin: 0;
              }
            }
          </style>
        </head>

        <body>
          <div class="ticket">
            <div class="centrado">
              <h1>Restaurante</h1>
              <p>Recibo de pago</p>
            </div>

            <div class="linea"></div>

            <p><strong>Pedido:</strong> #${pedido.id_pedido}</p>
            <p><strong>Fecha:</strong> ${fecha}</p>
            <p><strong>Tipo:</strong> ${traducirTipo(pedido.tipo_pedido)}</p>

            ${
              pedido.numero_mesa
                ? `<p><strong>Mesa:</strong> ${escaparHtml(pedido.numero_mesa)}</p>`
                : ''
            }

            <p><strong>Cliente:</strong> ${
              pedido.cliente_nombre
                ? escaparHtml(pedido.cliente_nombre)
                : 'Consumidor final'
            }</p>

            ${
              pedido.cliente_telefono
                ? `<p><strong>Tel:</strong> ${escaparHtml(pedido.cliente_telefono)}</p>`
                : ''
            }

            <div class="linea"></div>

            <p><strong>NIT:</strong> ${escaparHtml(datosFacturacion.nit_facturacion || 'CF')}</p>
            <p><strong>Nombre factura:</strong> ${escaparHtml(datosFacturacion.nombre_facturacion || 'Consumidor final')}</p>

            ${
              datosFacturacion.direccion_facturacion
                ? `<p><strong>Dirección:</strong> ${escaparHtml(datosFacturacion.direccion_facturacion)}</p>`
                : ''
            }

            ${
              datosFacturacion.correo_facturacion
                ? `<p><strong>Correo:</strong> ${escaparHtml(datosFacturacion.correo_facturacion)}</p>`
                : ''
            }

            <div class="linea"></div>

            <h2>Detalle</h2>

            <table>
              <tbody>
                ${productosHtml}
              </tbody>
            </table>

            <div class="linea"></div>

            <div class="totales">
              <div>
                <span>Subtotal</span>
                <strong>Q${Number(pedido.subtotal || 0).toFixed(2)}</strong>
              </div>

              <div>
                <span>Descuento</span>
                <strong>Q${Number(pedido.descuento || 0).toFixed(2)}</strong>
              </div>

              <div>
                <span>Propina</span>
                <strong>Q${Number(pedido.propina || 0).toFixed(2)}</strong>
              </div>

              <div>
                <span>Total pedido</span>
                <strong>Q${Number(pedido.total || 0).toFixed(2)}</strong>
              </div>

              <div>
                <span>Método</span>
                <strong>${escaparHtml(metodoPago)}</strong>
              </div>

              ${
                referencia
                  ? `
                    <div>
                      <span>Referencia</span>
                      <strong>${escaparHtml(referencia)}</strong>
                    </div>
                  `
                  : ''
              }

              <div class="total-final">
                <span>Pagado ahora</span>
                <strong>Q${Number(montoPagado || 0).toFixed(2)}</strong>
              </div>

              <div>
                <span>Saldo restante</span>
                <strong>Q${Number(saldoDespues || 0).toFixed(2)}</strong>
              </div>
            </div>

            ${
              observaciones
                ? `
                  <div class="linea"></div>
                  <p><strong>Observaciones:</strong></p>
                  <p>${escaparHtml(observaciones)}</p>
                `
                : ''
            }

            <div class="linea"></div>

            <div class="footer">
              <p>Gracias por su compra</p>
            </div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.focus();
                window.print();
              }, 300);
            };

            window.onafterprint = function() {
              window.close();
            };
          </script>
        </body>
      </html>
    `;

    const ventana = window.open('', '_blank', 'width=420,height=650');

    if (!ventana) {
      Swal.fire(
        'Impresión bloqueada',
        'El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio.',
        'warning'
      );
      return;
    }

    ventana.document.open();
    ventana.document.write(html);
    ventana.document.close();
  };

  const imprimirReciboCuentaUnida = ({
    pedidosCuentaImprimir,
    metodoPago,
    montoPagado,
    referencia,
    observaciones,
    datosFacturacion
  }) => {
    const fecha = new Date().toLocaleString('es-GT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const totalCuenta = pedidosCuentaImprimir.reduce((acc, item) => {
      return acc + Number(item.saldo_pendiente || 0);
    }, 0);

    const pedidosHtml = pedidosCuentaImprimir.map((pedido) => {
      return `
        <tr>
          <td>
            <strong>Pedido #${pedido.id_pedido}</strong>
            ${
              pedido.numero_mesa
                ? `<br><small>Mesa ${escaparHtml(pedido.numero_mesa)}</small>`
                : ''
            }
            <br>
            <small>${escaparHtml(pedido.cliente_nombre || 'Consumidor final')}</small>
          </td>
          <td class="precio">Q${Number(pedido.saldo_pendiente || 0).toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const saldoDespues = totalCuenta - Number(montoPagado || 0);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Recibo cuenta unificada</title>

          <style>
            * { box-sizing: border-box; }

            body {
              margin: 0;
              padding: 0;
              font-family: Arial, Helvetica, sans-serif;
              color: #000;
              background: #fff;
            }

            .ticket {
              width: 80mm;
              padding: 10px;
              margin: 0 auto;
            }

            .centrado { text-align: center; }

            h1 {
              margin: 0;
              font-size: 18px;
              font-weight: 800;
              text-transform: uppercase;
            }

            h2 {
              margin: 6px 0 4px;
              font-size: 15px;
              font-weight: 800;
            }

            p {
              margin: 3px 0;
              font-size: 12px;
            }

            .linea {
              border-top: 1px dashed #000;
              margin: 8px 0;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }

            td {
              padding: 5px 0;
              vertical-align: top;
            }

            .precio {
              width: 70px;
              text-align: right;
              font-weight: 800;
            }

            small { font-size: 10px; }

            .totales div {
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              padding: 2px 0;
              gap: 8px;
            }

            .totales span {
              flex: 1;
            }

            .totales strong {
              text-align: right;
            }

            .total-final {
              font-size: 15px !important;
              font-weight: 900;
              border-top: 1px solid #000;
              margin-top: 5px;
              padding-top: 6px !important;
            }

            .footer {
              margin-top: 10px;
              text-align: center;
              font-size: 11px;
            }

            @media print {
              @page {
                size: 80mm auto;
                margin: 0;
              }

              body { margin: 0; }

              .ticket {
                width: 80mm;
                margin: 0;
              }
            }
          </style>
        </head>

        <body>
          <div class="ticket">
            <div class="centrado">
              <h1>Restaurante</h1>
              <p>Recibo de cuenta unificada</p>
            </div>

            <div class="linea"></div>

            <p><strong>Fecha:</strong> ${fecha}</p>
            <p><strong>Pedidos:</strong> ${pedidosCuentaImprimir.length}</p>

            <div class="linea"></div>

            <p><strong>NIT:</strong> ${escaparHtml(datosFacturacion.nit_facturacion || 'CF')}</p>
            <p><strong>Nombre factura:</strong> ${escaparHtml(datosFacturacion.nombre_facturacion || 'Consumidor final')}</p>

            ${
              datosFacturacion.direccion_facturacion
                ? `<p><strong>Dirección:</strong> ${escaparHtml(datosFacturacion.direccion_facturacion)}</p>`
                : ''
            }

            ${
              datosFacturacion.correo_facturacion
                ? `<p><strong>Correo:</strong> ${escaparHtml(datosFacturacion.correo_facturacion)}</p>`
                : ''
            }

            <div class="linea"></div>

            <h2>Pedidos cobrados</h2>

            <table>
              <tbody>
                ${pedidosHtml}
              </tbody>
            </table>

            <div class="linea"></div>

            <div class="totales">
              <div>
                <span>Total cuenta</span>
                <strong>Q${Number(totalCuenta || 0).toFixed(2)}</strong>
              </div>

              <div>
                <span>Método</span>
                <strong>${escaparHtml(metodoPago)}</strong>
              </div>

              ${
                referencia
                  ? `
                    <div>
                      <span>Referencia</span>
                      <strong>${escaparHtml(referencia)}</strong>
                    </div>
                  `
                  : ''
              }

              <div class="total-final">
                <span>Pagado ahora</span>
                <strong>Q${Number(montoPagado || 0).toFixed(2)}</strong>
              </div>

              <div>
                <span>Saldo restante</span>
                <strong>Q${Number(saldoDespues || 0).toFixed(2)}</strong>
              </div>
            </div>

            ${
              observaciones
                ? `
                  <div class="linea"></div>
                  <p><strong>Observaciones:</strong></p>
                  <p>${escaparHtml(observaciones)}</p>
                `
                : ''
            }

            <div class="linea"></div>

            <div class="footer">
              <p>Gracias por su compra</p>
            </div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.focus();
                window.print();
              }, 300);
            };

            window.onafterprint = function() {
              window.close();
            };
          </script>
        </body>
      </html>
    `;

    const ventana = window.open('', '_blank', 'width=420,height=650');

    if (!ventana) {
      Swal.fire(
        'Impresión bloqueada',
        'El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio.',
        'warning'
      );
      return;
    }

    ventana.document.open();
    ventana.document.write(html);
    ventana.document.close();
  };

  const registrarPago = async (e) => {
    e.preventDefault();

    if (!pedidoSeleccionado) {
      Swal.fire('Pedido requerido', 'Selecciona un pedido para cobrar', 'warning');
      return;
    }

    if (Number(pago.monto || 0) <= 0) {
      Swal.fire('Monto inválido', 'Ingresa un monto mayor a 0', 'warning');
      return;
    }

    if (Number(pago.monto) > Number(pedidoSeleccionado.saldo_pendiente || 0)) {
      Swal.fire(
        'Monto inválido',
        'El monto no puede ser mayor al saldo pendiente',
        'warning'
      );
      return;
    }

    const saldoPendiente = Number(pedidoSeleccionado.saldo_pendiente || 0);

    const { value: datosPago } = await Swal.fire({
      title: 'Registrar pago',
      width: 850,
      html: `
        <div style="text-align:left">
          <p style="font-size:18px">
            <strong>Total pedido:</strong> Q${Number(pedidoSeleccionado.total || 0).toFixed(2)}
          </p>

          <p style="font-size:18px">
            <strong>Saldo pendiente:</strong> Q${saldoPendiente.toFixed(2)}
          </p>

          <hr />

          <h4 style="
            margin:0 0 12px;
            font-size:17px;
            font-weight:800;
            color:#111827;
          ">
            Datos de facturación
          </h4>

          <label style="font-weight:700">NIT</label>
          <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
            <input 
              id="swal-nit-facturacion" 
              type="text" 
              class="swal2-input" 
              style="width:70%; margin:0"
              value="${escaparHtml(pedidoSeleccionado?.nit || 'CF')}"
              placeholder="CF o NIT"
            />

            <button 
              type="button"
              id="btn-buscar-nit-facturacion"
              style="
                height:44px;
                padding:0 14px;
                border:none;
                border-radius:8px;
                background:#6b7280;
                color:white;
                font-weight:800;
                cursor:pointer;
              "
            >
              Buscar NIT
            </button>
          </div>

          <div 
            id="mensaje-busqueda-nit"
            style="
              display:none;
              margin-bottom:10px;
              padding:8px 10px;
              border-radius:8px;
              font-size:13px;
              font-weight:600;
            "
          ></div>

          <label style="font-weight:700">Nombre factura</label>
          <input 
            id="swal-nombre-facturacion" 
            type="text" 
            class="swal2-input" 
            style="width:95%; margin:6px 0 10px"
            value="${escaparHtml(
              pedidoSeleccionado?.nombre_facturacion ||
              pedidoSeleccionado?.cliente_nombre ||
              'Consumidor final'
            )}"
            placeholder="Nombre del cliente"
          />

          <label style="font-weight:700">Dirección factura</label>
          <input 
            id="swal-direccion-facturacion" 
            type="text" 
            class="swal2-input" 
            style="width:95%; margin:6px 0 10px"
            value="${escaparHtml(pedidoSeleccionado?.direccion_facturacion || '')}"
            placeholder="Opcional"
          />

          <label style="font-weight:700">Correo factura</label>
          <input 
            id="swal-correo-facturacion" 
            type="email" 
            class="swal2-input" 
            style="width:95%; margin:6px 0 10px"
            value="${escaparHtml(pedidoSeleccionado?.correo_facturacion || '')}"
            placeholder="Opcional"
          />

          <hr />

          <h4 style="
            margin:0 0 12px;
            font-size:17px;
            font-weight:800;
            color:#111827;
          ">
            Datos del pago
          </h4>

          <label style="font-weight:700">Método de pago</label>
          <select id="swal-metodo-pago" class="swal2-input" style="width:95%; margin:6px 0 10px">
            <option value="efectivo" ${pago.metodo_pago === 'efectivo' ? 'selected' : ''}>Efectivo</option>
            <option value="tarjeta" ${pago.metodo_pago === 'tarjeta' ? 'selected' : ''}>Tarjeta</option>
            <option value="transferencia" ${pago.metodo_pago === 'transferencia' ? 'selected' : ''}>Transferencia</option>
            <option value="mixto" ${pago.metodo_pago === 'mixto' ? 'selected' : ''}>Mixto</option>
            <option value="otro" ${pago.metodo_pago === 'otro' ? 'selected' : ''}>Otro</option>
          </select>

          ${generarHtmlPagoMixto(saldoPendiente)}

          <label style="font-weight:700">Monto a cobrar</label>
          <input 
            id="swal-monto-pago" 
            type="number" 
            min="0.01" 
            step="0.01" 
            class="swal2-input" 
            style="width:95%; margin:6px 0 10px"
            value="${Number(pago.monto || 0).toFixed(2)}"
          />

          <label style="font-weight:700">Referencia</label>
          <input 
            id="swal-referencia-pago" 
            type="text" 
            class="swal2-input" 
            style="width:95%; margin:6px 0 10px"
            value="${escaparHtml(pago.referencia || '')}"
            placeholder="Opcional"
          />

          <label style="font-weight:700">Observaciones</label>
          <input 
            id="swal-observaciones-pago" 
            type="text" 
            class="swal2-input" 
            style="width:95%; margin:6px 0 10px"
            value="${escaparHtml(pago.observaciones || '')}"
            placeholder="Opcional"
          />
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Registrar pago',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ea580c',
      cancelButtonColor: '#6b7280',

      didOpen: () => {
        const nitInput = document.getElementById('swal-nit-facturacion');
        const nombreInput = document.getElementById('swal-nombre-facturacion');
        const direccionInput = document.getElementById('swal-direccion-facturacion');
        const correoInput = document.getElementById('swal-correo-facturacion');
        const btnBuscar = document.getElementById('btn-buscar-nit-facturacion');
        const mensaje = document.getElementById('mensaje-busqueda-nit');

        const mostrarMensaje = (texto, tipo) => {
          mensaje.style.display = 'block';
          mensaje.innerHTML = texto;

          if (tipo === 'success') {
            mensaje.style.background = '#ecfdf5';
            mensaje.style.color = '#166534';
            mensaje.style.border = '1px solid #bbf7d0';
          } else if (tipo === 'warning') {
            mensaje.style.background = '#fff7ed';
            mensaje.style.color = '#9a3412';
            mensaje.style.border = '1px solid #fed7aa';
          } else if (tipo === 'error') {
            mensaje.style.background = '#fef2f2';
            mensaje.style.color = '#991b1b';
            mensaje.style.border = '1px solid #fecaca';
          } else {
            mensaje.style.background = '#eff6ff';
            mensaje.style.color = '#1d4ed8';
            mensaje.style.border = '1px solid #bfdbfe';
          }
        };

        const ejecutarBusquedaNit = async () => {
          const nit = nitInput.value.trim();

          if (!nit) {
            mostrarMensaje('Ingresa un NIT o CF.', 'error');
            return;
          }

          mostrarMensaje('Buscando datos del NIT...', 'info');

          const datos = await buscarNitFacturacion(nit);

          if (!datos) {
            mostrarMensaje(
              'NIT no encontrado. Puedes llenar los datos manualmente y se guardarán al cobrar.',
              'warning'
            );

            if (nit.toUpperCase() !== 'CF') {
              nombreInput.value = '';
              direccionInput.value = '';
              correoInput.value = '';
            }

            return;
          }

          nitInput.value = datos.nit || nit.toUpperCase();
          nombreInput.value = datos.nombre_facturacion || 'Consumidor final';
          direccionInput.value = datos.direccion_facturacion || '';
          correoInput.value = datos.correo_facturacion || '';

          mostrarMensaje('Datos encontrados y cargados correctamente.', 'success');
        };

        btnBuscar.addEventListener('click', ejecutarBusquedaNit);

        nitInput.addEventListener('blur', async () => {
          const nit = nitInput.value.trim();

          if (nit) {
            await ejecutarBusquedaNit();
          }
        });

        nitInput.addEventListener('keydown', async (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            await ejecutarBusquedaNit();
          }
        });

        configurarPagoMixto();
      },

      preConfirm: () => {
        const nit_facturacion = document.getElementById('swal-nit-facturacion').value.trim().toUpperCase();
        const nombre_facturacion = document.getElementById('swal-nombre-facturacion').value.trim();
        const direccion_facturacion = document.getElementById('swal-direccion-facturacion').value.trim();
        const correo_facturacion = document.getElementById('swal-correo-facturacion').value.trim();

        const metodo_pago = document.getElementById('swal-metodo-pago').value;
        const monto = Number(document.getElementById('swal-monto-pago').value || 0);
        const referencia = document.getElementById('swal-referencia-pago').value || '';
        const observaciones = document.getElementById('swal-observaciones-pago').value || '';

        let pagos_mixtos = [];

        if (!nit_facturacion) {
          Swal.showValidationMessage('El NIT es obligatorio. Puedes usar CF para consumidor final.');
          return false;
        }

        if (!nombre_facturacion) {
          Swal.showValidationMessage('El nombre de factura es obligatorio.');
          return false;
        }

        if (metodo_pago === 'mixto') {
          pagos_mixtos = obtenerPagosMixtosDesdeSwal();

          if (pagos_mixtos.length < 2) {
            Swal.showValidationMessage('Para pago mixto selecciona al menos 2 métodos con monto mayor a 0.');
            return false;
          }

          const totalMixto = pagos_mixtos.reduce((acc, item) => {
            return acc + Number(item.monto || 0);
          }, 0);

          if (totalMixto <= 0) {
            Swal.showValidationMessage('El total del pago mixto debe ser mayor a 0.');
            return false;
          }

          if (totalMixto > saldoPendiente) {
            Swal.showValidationMessage('El total mixto no puede ser mayor al saldo pendiente.');
            return false;
          }
        } else {
          if (monto <= 0) {
            Swal.showValidationMessage('El monto debe ser mayor a 0.');
            return false;
          }

          if (monto > saldoPendiente) {
            Swal.showValidationMessage('El monto no puede ser mayor al saldo pendiente.');
            return false;
          }
        }

        return {
          nit_facturacion,
          nombre_facturacion,
          direccion_facturacion,
          correo_facturacion,
          metodo_pago,
          monto,
          referencia,
          observaciones,
          pagos_mixtos
        };
      }
    });

    if (!datosPago) return;

    const confirmar = await Swal.fire({
      title: '¿Confirmar pago?',
      html: `
        <div style="text-align:left">
          <p>Se registrará un pago de <strong>Q${Number(datosPago.monto).toFixed(2)}</strong>.</p>
          <p><strong>Método:</strong> ${escaparHtml(textoMetodoPago(datosPago))}</p>
          <p><strong>NIT:</strong> ${escaparHtml(datosPago.nit_facturacion)}</p>
          <p><strong>Nombre:</strong> ${escaparHtml(datosPago.nombre_facturacion)}</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, registrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ea580c',
      cancelButtonColor: '#6b7280'
    });

    if (!confirmar.isConfirmed) return;

    try {
      setCargando(true);

      let response = null;

      if (datosPago.metodo_pago === 'mixto') {
        for (const item of datosPago.pagos_mixtos) {
          response = await axios.post(
            `${URL}/caja/pagos`,
            {
              id_pedido: pedidoSeleccionado.id_pedido,
              metodo_pago: item.metodo_pago,
              monto: Number(item.monto),
              referencia: item.referencia || '',
              observaciones: datosPago.observaciones,
              nit_facturacion: datosPago.nit_facturacion || 'CF',
              nombre_facturacion: datosPago.nombre_facturacion || 'Consumidor final',
              direccion_facturacion: datosPago.direccion_facturacion || null,
              correo_facturacion: datosPago.correo_facturacion || null
            },
            getConfig()
          );
        }
      } else {
        response = await axios.post(
          `${URL}/caja/pagos`,
          {
            id_pedido: pedidoSeleccionado.id_pedido,
            metodo_pago: datosPago.metodo_pago,
            monto: Number(datosPago.monto),
            referencia: datosPago.referencia,
            observaciones: datosPago.observaciones,
            nit_facturacion: datosPago.nit_facturacion || 'CF',
            nombre_facturacion: datosPago.nombre_facturacion || 'Consumidor final',
            direccion_facturacion: datosPago.direccion_facturacion || null,
            correo_facturacion: datosPago.correo_facturacion || null
          },
          getConfig()
        );
      }

      await Swal.fire({
        title: 'Pago registrado',
        text: 'El pago fue registrado correctamente',
        icon: 'success',
        confirmButtonText: 'Imprimir recibo',
        confirmButtonColor: '#ea580c',
        allowOutsideClick: false,
        allowEscapeKey: false
      });

      imprimirReciboPago({
        pedido: pedidoSeleccionado,
        detallePedido: detalle,
        montoPagado: Number(datosPago.monto),
        metodoPago: textoMetodoPago(datosPago),
        referencia: textoReferenciaPago(datosPago),
        observaciones: datosPago.observaciones,
        saldoDespues: response?.data?.saldo_pendiente || 0,
        datosFacturacion: datosPago
      });

      setPago({
        metodo_pago: 'efectivo',
        monto: '',
        referencia: '',
        observaciones: ''
      });

      await cargarPedidos();
      await cargarDetallePedido(pedidoSeleccionado.id_pedido);

    } catch (error) {
      console.error('Error registrando pago:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo registrar el pago',
        'error'
      );

    } finally {
      setCargando(false);
    }
  };

  const actualizarPropina = async () => {
    if (!pedidoSeleccionado) {
      Swal.fire('Selecciona un pedido', 'Primero selecciona un pedido para cobrar', 'warning');
      return;
    }

    if (pedidoSeleccionado.estado === 'pagado') {
      Swal.fire('Pedido pagado', 'No puedes modificar la propina de un pedido pagado', 'warning');
      return;
    }

    if (pedidoSeleccionado.estado === 'cancelado') {
      Swal.fire('Pedido cancelado', 'No puedes modificar la propina de un pedido cancelado', 'warning');
      return;
    }

    const { value: propina } = await Swal.fire({
      title: `Agregar propina al pedido #${pedidoSeleccionado.id_pedido}`,
      html: `
        <div style="text-align:left">
          <p><strong>Subtotal:</strong> Q${Number(pedidoSeleccionado.subtotal || 0).toFixed(2)}</p>
          <p><strong>Descuento:</strong> Q${Number(pedidoSeleccionado.descuento || 0).toFixed(2)}</p>
          <p><strong>Propina actual:</strong> Q${Number(pedidoSeleccionado.propina || 0).toFixed(2)}</p>
          <p><strong>Total actual:</strong> Q${Number(pedidoSeleccionado.total || 0).toFixed(2)}</p>

          <hr />

          <label style="font-weight:700">Nueva propina</label>
          <input 
            id="swal-propina" 
            type="number" 
            min="0" 
            step="0.01" 
            class="swal2-input" 
            value="${Number(pedidoSeleccionado.propina || 0).toFixed(2)}"
          />
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Guardar propina',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ea580c',
      cancelButtonColor: '#6b7280',
      preConfirm: () => {
        const valor = Number(document.getElementById('swal-propina').value || 0);

        if (valor < 0) {
          Swal.showValidationMessage('La propina no puede ser negativa');
          return false;
        }

        return valor;
      }
    });

    if (propina === undefined) return;

    try {
      setCargando(true);

      const response = await axios.patch(
        `${URL}/caja/pedidos/${pedidoSeleccionado.id_pedido}/propina`,
        { propina },
        getConfig()
      );

      Swal.fire(
        'Propina actualizada',
        'La propina fue agregada correctamente al pedido',
        'success'
      );

      await cargarPedidos();
      await cargarDetallePedido(pedidoSeleccionado.id_pedido);

      setPago({
        ...pago,
        monto: Number(response.data.saldo_pendiente || 0).toFixed(2)
      });

    } catch (error) {
      console.error('Error actualizando propina:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo actualizar la propina',
        'error'
      );

    } finally {
      setCargando(false);
    }
  };

  const pagoRapidoCompleto = () => {
    if (!pedidoSeleccionado) return;

    setPago({
      ...pago,
      monto: Number(pedidoSeleccionado.saldo_pendiente || 0).toFixed(2)
    });
  };

  const pedidoEstaEnCuenta = (idPedido) => {
    return pedidosCuenta.some((item) => Number(item.id_pedido) === Number(idPedido));
  };

  const togglePedidoCuenta = (e, pedido) => {
    e.stopPropagation();

    if (Number(pedido.saldo_pendiente || 0) <= 0) {
      Swal.fire('Pedido sin saldo', 'Este pedido no tiene saldo pendiente', 'warning');
      return;
    }

    if (pedido.estado === 'pagado' || pedido.estado === 'cancelado') {
      Swal.fire('Pedido no válido', 'No puedes agregar un pedido pagado o cancelado', 'warning');
      return;
    }

    if (pedidoEstaEnCuenta(pedido.id_pedido)) {
      setPedidosCuenta(
        pedidosCuenta.filter((item) => Number(item.id_pedido) !== Number(pedido.id_pedido))
      );
    } else {
      setPedidosCuenta([...pedidosCuenta, pedido]);
    }
  };

  const limpiarCuentaUnida = () => {
    setPedidosCuenta([]);
  };

  const totalCuentaUnida = () => {
    return pedidosCuenta.reduce((acc, pedido) => {
      return acc + Number(pedido.saldo_pendiente || 0);
    }, 0);
  };

  const cobrarCuentaUnida = async () => {
    if (pedidosCuenta.length === 0) {
      Swal.fire('Sin pedidos', 'Selecciona al menos un pedido para cobrar junto', 'warning');
      return;
    }

    const totalCuenta = totalCuentaUnida();

    const listaPedidosHtml = pedidosCuenta.map((pedido) => {
      return `
        <div style="
          display:flex;
          justify-content:space-between;
          gap:10px;
          padding:8px 0;
          border-bottom:1px solid #e5e7eb;
        ">
          <span>
            Pedido #${pedido.id_pedido}
            ${pedido.numero_mesa ? ` - Mesa ${pedido.numero_mesa}` : ''}
            <br>
            <small>${pedido.cliente_nombre || 'Consumidor final'}</small>
          </span>
          <strong>Q${Number(pedido.saldo_pendiente || 0).toFixed(2)}</strong>
        </div>
      `;
    }).join('');

    const { value: datosPago } = await Swal.fire({
      title: 'Cobrar cuenta unificada',
      width: 850,
      html: `
        <div style="text-align:left">
          <p><strong>Pedidos seleccionados:</strong> ${pedidosCuenta.length}</p>

          <div style="
            background:#f9fafb;
            border:1px solid #e5e7eb;
            border-radius:12px;
            padding:12px;
            margin-bottom:12px;
          ">
            ${listaPedidosHtml}
          </div>

          <p style="font-size:18px">
            <strong>Total cuenta:</strong> Q${Number(totalCuenta).toFixed(2)}
          </p>

          <hr />

          <h4 style="
            margin:0 0 12px;
            font-size:17px;
            font-weight:800;
            color:#111827;
          ">
            Datos de facturación
          </h4>

          <label style="font-weight:700">NIT</label>
          <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
            <input 
              id="swal-nit-facturacion" 
              type="text" 
              class="swal2-input" 
              style="width:70%; margin:0"
              value="CF"
              placeholder="CF o NIT"
            />

            <button 
              type="button"
              id="btn-buscar-nit-facturacion"
              style="
                height:44px;
                padding:0 14px;
                border:none;
                border-radius:8px;
                background:#6b7280;
                color:white;
                font-weight:800;
                cursor:pointer;
              "
            >
              Buscar NIT
            </button>
          </div>

          <div 
            id="mensaje-busqueda-nit"
            style="
              display:none;
              margin-bottom:10px;
              padding:8px 10px;
              border-radius:8px;
              font-size:13px;
              font-weight:600;
            "
          ></div>

          <label style="font-weight:700">Nombre factura</label>
          <input 
            id="swal-nombre-facturacion" 
            type="text" 
            class="swal2-input" 
            style="width:95%; margin:6px 0 10px"
            value="Consumidor final"
            placeholder="Nombre del cliente"
          />

          <label style="font-weight:700">Dirección factura</label>
          <input 
            id="swal-direccion-facturacion" 
            type="text" 
            class="swal2-input" 
            style="width:95%; margin:6px 0 10px"
            placeholder="Opcional"
          />

          <label style="font-weight:700">Correo factura</label>
          <input 
            id="swal-correo-facturacion" 
            type="email" 
            class="swal2-input" 
            style="width:95%; margin:6px 0 10px"
            placeholder="Opcional"
          />

          <hr />

          <h4 style="
            margin:0 0 12px;
            font-size:17px;
            font-weight:800;
            color:#111827;
          ">
            Datos del pago
          </h4>

          <label style="font-weight:700">Método de pago</label>
          <select id="swal-metodo-pago" class="swal2-input" style="width:95%; margin:6px 0 10px">
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="transferencia">Transferencia</option>
            <option value="mixto">Mixto</option>
            <option value="otro">Otro</option>
          </select>

          ${generarHtmlPagoMixto(totalCuenta)}

          <label style="font-weight:700">Monto a cobrar</label>
          <input 
            id="swal-monto-pago" 
            type="number" 
            min="0.01" 
            step="0.01" 
            class="swal2-input" 
            style="width:95%; margin:6px 0 10px"
            value="${Number(totalCuenta).toFixed(2)}"
          />

          <label style="font-weight:700">Referencia</label>
          <input 
            id="swal-referencia-pago" 
            type="text" 
            class="swal2-input" 
            style="width:95%; margin:6px 0 10px"
            placeholder="Opcional"
          />

          <label style="font-weight:700">Observaciones</label>
          <input 
            id="swal-observaciones-pago" 
            type="text" 
            class="swal2-input" 
            style="width:95%; margin:6px 0 10px"
            placeholder="Opcional"
          />
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Cobrar cuenta',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ea580c',
      cancelButtonColor: '#6b7280',

      didOpen: () => {
        const nitInput = document.getElementById('swal-nit-facturacion');
        const nombreInput = document.getElementById('swal-nombre-facturacion');
        const direccionInput = document.getElementById('swal-direccion-facturacion');
        const correoInput = document.getElementById('swal-correo-facturacion');
        const btnBuscar = document.getElementById('btn-buscar-nit-facturacion');
        const mensaje = document.getElementById('mensaje-busqueda-nit');

        const mostrarMensaje = (texto, tipo) => {
          mensaje.style.display = 'block';
          mensaje.innerHTML = texto;

          if (tipo === 'success') {
            mensaje.style.background = '#ecfdf5';
            mensaje.style.color = '#166534';
            mensaje.style.border = '1px solid #bbf7d0';
          } else if (tipo === 'warning') {
            mensaje.style.background = '#fff7ed';
            mensaje.style.color = '#9a3412';
            mensaje.style.border = '1px solid #fed7aa';
          } else if (tipo === 'error') {
            mensaje.style.background = '#fef2f2';
            mensaje.style.color = '#991b1b';
            mensaje.style.border = '1px solid #fecaca';
          } else {
            mensaje.style.background = '#eff6ff';
            mensaje.style.color = '#1d4ed8';
            mensaje.style.border = '1px solid #bfdbfe';
          }
        };

        const ejecutarBusquedaNit = async () => {
          const nit = nitInput.value.trim();

          if (!nit) {
            mostrarMensaje('Ingresa un NIT o CF.', 'error');
            return;
          }

          mostrarMensaje('Buscando datos del NIT...', 'info');

          const datos = await buscarNitFacturacion(nit);

          if (!datos) {
            mostrarMensaje(
              'NIT no encontrado. Puedes llenar los datos manualmente y se guardarán al cobrar.',
              'warning'
            );

            if (nit.toUpperCase() !== 'CF') {
              nombreInput.value = '';
              direccionInput.value = '';
              correoInput.value = '';
            }

            return;
          }

          nitInput.value = datos.nit || nit.toUpperCase();
          nombreInput.value = datos.nombre_facturacion || 'Consumidor final';
          direccionInput.value = datos.direccion_facturacion || '';
          correoInput.value = datos.correo_facturacion || '';

          mostrarMensaje('Datos encontrados y cargados correctamente.', 'success');
        };

        btnBuscar.addEventListener('click', ejecutarBusquedaNit);

        nitInput.addEventListener('blur', async () => {
          const nit = nitInput.value.trim();

          if (nit) {
            await ejecutarBusquedaNit();
          }
        });

        nitInput.addEventListener('keydown', async (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            await ejecutarBusquedaNit();
          }
        });

        configurarPagoMixto();
      },

      preConfirm: () => {
        const nit_facturacion = document.getElementById('swal-nit-facturacion').value.trim().toUpperCase();
        const nombre_facturacion = document.getElementById('swal-nombre-facturacion').value.trim();
        const direccion_facturacion = document.getElementById('swal-direccion-facturacion').value.trim();
        const correo_facturacion = document.getElementById('swal-correo-facturacion').value.trim();

        const metodo_pago = document.getElementById('swal-metodo-pago').value;
        const monto = Number(document.getElementById('swal-monto-pago').value || 0);
        const referencia = document.getElementById('swal-referencia-pago').value || '';
        const observaciones = document.getElementById('swal-observaciones-pago').value || '';

        let pagos_mixtos = [];

        if (!nit_facturacion) {
          Swal.showValidationMessage('El NIT es obligatorio. Puedes usar CF para consumidor final.');
          return false;
        }

        if (!nombre_facturacion) {
          Swal.showValidationMessage('El nombre de factura es obligatorio.');
          return false;
        }

        if (metodo_pago === 'mixto') {
          pagos_mixtos = obtenerPagosMixtosDesdeSwal();

          if (pagos_mixtos.length < 2) {
            Swal.showValidationMessage('Para pago mixto selecciona al menos 2 métodos con monto mayor a 0.');
            return false;
          }

          const totalMixto = pagos_mixtos.reduce((acc, item) => {
            return acc + Number(item.monto || 0);
          }, 0);

          if (totalMixto <= 0) {
            Swal.showValidationMessage('El total del pago mixto debe ser mayor a 0.');
            return false;
          }

          if (totalMixto > totalCuenta) {
            Swal.showValidationMessage('El total mixto no puede ser mayor al total de la cuenta.');
            return false;
          }
        } else {
          if (monto <= 0) {
            Swal.showValidationMessage('El monto debe ser mayor a 0.');
            return false;
          }

          if (monto > totalCuenta) {
            Swal.showValidationMessage('El monto no puede ser mayor al total de la cuenta.');
            return false;
          }
        }

        return {
          nit_facturacion,
          nombre_facturacion,
          direccion_facturacion,
          correo_facturacion,
          metodo_pago,
          monto,
          referencia,
          observaciones,
          pagos_mixtos
        };
      }
    });

    if (!datosPago) return;

    const confirmar = await Swal.fire({
      title: '¿Confirmar cobro?',
      html: `
        <div style="text-align:left">
          <p>Se cobrará <strong>Q${Number(datosPago.monto).toFixed(2)}</strong> para ${pedidosCuenta.length} pedido(s).</p>
          <p><strong>Método:</strong> ${escaparHtml(textoMetodoPago(datosPago))}</p>
          <p><strong>NIT:</strong> ${escaparHtml(datosPago.nit_facturacion)}</p>
          <p><strong>Nombre:</strong> ${escaparHtml(datosPago.nombre_facturacion)}</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, cobrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ea580c',
      cancelButtonColor: '#6b7280'
    });

    if (!confirmar.isConfirmed) return;

    try {
      setCargando(true);

      const pedidosCuentaImprimir = [...pedidosCuenta];

      if (datosPago.metodo_pago === 'mixto') {
        for (const item of datosPago.pagos_mixtos) {
          await axios.post(
            `${URL}/caja/pagos-multiple`,
            {
              pedidos: pedidosCuenta.map((pedido) => pedido.id_pedido),
              metodo_pago: item.metodo_pago,
              monto: Number(item.monto),
              referencia: item.referencia || '',
              observaciones: datosPago.observaciones,
              nit_facturacion: datosPago.nit_facturacion || 'CF',
              nombre_facturacion: datosPago.nombre_facturacion || 'Consumidor final',
              direccion_facturacion: datosPago.direccion_facturacion || null,
              correo_facturacion: datosPago.correo_facturacion || null
            },
            getConfig()
          );
        }
      } else {
        await axios.post(
          `${URL}/caja/pagos-multiple`,
          {
            pedidos: pedidosCuenta.map((pedido) => pedido.id_pedido),
            metodo_pago: datosPago.metodo_pago,
            monto: Number(datosPago.monto),
            referencia: datosPago.referencia,
            observaciones: datosPago.observaciones,
            nit_facturacion: datosPago.nit_facturacion || 'CF',
            nombre_facturacion: datosPago.nombre_facturacion || 'Consumidor final',
            direccion_facturacion: datosPago.direccion_facturacion || null,
            correo_facturacion: datosPago.correo_facturacion || null
          },
          getConfig()
        );
      }

      await Swal.fire({
        title: 'Cuenta cobrada',
        text: 'La cuenta unificada fue cobrada correctamente',
        icon: 'success',
        confirmButtonText: 'Imprimir recibo',
        confirmButtonColor: '#ea580c',
        allowOutsideClick: false,
        allowEscapeKey: false
      });

      imprimirReciboCuentaUnida({
        pedidosCuentaImprimir,
        metodoPago: textoMetodoPago(datosPago),
        montoPagado: Number(datosPago.monto),
        referencia: textoReferenciaPago(datosPago),
        observaciones: datosPago.observaciones,
        datosFacturacion: {
          nit_facturacion: datosPago.nit_facturacion || 'CF',
          nombre_facturacion: datosPago.nombre_facturacion || 'Consumidor final',
          direccion_facturacion: datosPago.direccion_facturacion || '',
          correo_facturacion: datosPago.correo_facturacion || ''
        }
      });

      limpiarCuentaUnida();

      await cargarPedidos();

      if (pedidoSeleccionado) {
        await cargarDetallePedido(pedidoSeleccionado.id_pedido);
      }

    } catch (error) {
      console.error('Error cobrando cuenta unificada:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo cobrar la cuenta unificada',
        'error'
      );

    } finally {
      setCargando(false);
    }
  };

  return (
    <div>
      <div className={`d-flex ${isSidebarOpen ? 'toggled' : ''}`} id="wrapper">

        <Sidebar isOpen={isSidebarOpen} />

        {isSidebarOpen && (
          <div
            className="overlay"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        <div id="page-content-wrapper">
          <Navbar
            toggleSidebar={toggleSidebar}
            handleLogout={handleLogout}
          />

          <div className="container-fluid caja-container">

            <div className="caja-header mt-4">
              <div>
                <span className="caja-badge">Caja</span>
                <h2>Cobro de pedidos</h2>
                <p>
                  Registra pagos completos, parciales o mixtos y libera la mesa cuando el pedido quede pagado.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-caja-refresh"
                onClick={cargarPedidos}
                disabled={cargando}
              >
                {cargando ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>

            <div className="caja-layout mt-4">

              <section className="caja-panel">
                <div className="caja-panel-title">
                  <h4>Pedidos para cobrar</h4>

                  {pedidosCuenta.length > 0 && (
                    <div className="cuenta-unida-box">
                      <div>
                        <span>Cuenta unificada</span>
                        <h5>{pedidosCuenta.length} pedido(s)</h5>
                        <p>Total: {formatearMoneda(totalCuentaUnida())}</p>
                      </div>

                      <div className="cuenta-unida-actions">
                        <button
                          type="button"
                          className="btn btn-caja-save btn-sm"
                          onClick={cobrarCuentaUnida}
                          disabled={cargando}
                        >
                          Cobrar cuenta
                        </button>

                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={limpiarCuentaUnida}
                          disabled={cargando}
                        >
                          Limpiar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="caja-busqueda">
                  <input
                    type="text"
                    className="form-control"
                    value={buscar}
                    onChange={(e) => setBuscar(e.target.value)}
                    placeholder="Buscar pedido, cliente o mesa..."
                  />

                  <button
                    type="button"
                    className="btn btn-caja-save"
                    onClick={cargarPedidos}
                  >
                    Buscar
                  </button>
                </div>

                <div className="caja-pedidos-lista">
                  {cargando && pedidos.length === 0 && (
                    <div className="caja-empty">
                      Cargando pedidos...
                    </div>
                  )}

                  {!cargando && pedidos.length === 0 && (
                    <div className="caja-empty">
                      No hay pedidos pendientes de cobro.
                    </div>
                  )}

                  {pedidos.map((pedido) => (
                    <div
                      key={pedido.id_pedido}
                      className={`caja-pedido-card ${pedidoSeleccionado?.id_pedido === pedido.id_pedido ? 'seleccionado' : ''} ${pedidoEstaEnCuenta(pedido.id_pedido) ? 'en-cuenta-unida' : ''}`}
                      onClick={() => seleccionarPedido(pedido)}
                    >
                      <div className="caja-pedido-top">
                        <div>
                          <span>Pedido</span>
                          <h5>#{pedido.id_pedido}</h5>
                        </div>

                        <strong>{formatearMoneda(pedido.total)}</strong>
                      </div>

                      <div className="caja-pedido-info">
                        <span>{traducirTipo(pedido.tipo_pedido)}</span>

                        {pedido.numero_mesa && (
                          <span>Mesa {pedido.numero_mesa}</span>
                        )}

                        <span className={`estado-caja estado-${pedido.estado}`}>
                          {traducirEstado(pedido.estado)}
                        </span>
                      </div>

                      <p>
                        {pedido.cliente_nombre || 'Consumidor final'}
                      </p>

                      <div className="caja-saldo">
                        <span>Pagado: {formatearMoneda(pedido.total_pagado)}</span>
                        <span>Saldo: {formatearMoneda(pedido.saldo_pendiente)}</span>
                      </div>

                      <div className="caja-card-actions">
                        <button
                          type="button"
                          className={`btn btn-sm ${pedidoEstaEnCuenta(pedido.id_pedido) ? 'btn-warning' : 'btn-outline-warning'}`}
                          onClick={(e) => togglePedidoCuenta(e, pedido)}
                          disabled={
                            Number(pedido.saldo_pendiente || 0) <= 0 ||
                            pedido.estado === 'pagado' ||
                            pedido.estado === 'cancelado'
                          }
                        >
                          {pedidoEstaEnCuenta(pedido.id_pedido) ? 'Quitar de cuenta' : 'Agregar a cuenta'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="caja-panel caja-detalle-panel">
                {!pedidoSeleccionado && (
                  <div className="caja-empty caja-empty-detalle">
                    Selecciona un pedido para ver el detalle y registrar pago.
                  </div>
                )}

                {pedidoSeleccionado && (
                  <>
                    <div className="detalle-caja-header">
                      <div>
                        <span className="caja-badge-small">
                          Pedido seleccionado
                        </span>
                        <h3>Pedido #{pedidoSeleccionado.id_pedido}</h3>
                        <p>
                          {traducirTipo(pedidoSeleccionado.tipo_pedido)}
                          {pedidoSeleccionado.numero_mesa
                            ? ` - Mesa ${pedidoSeleccionado.numero_mesa}`
                            : ''}
                        </p>
                      </div>

                      <span className={`estado-caja estado-${pedidoSeleccionado.estado}`}>
                        {traducirEstado(pedidoSeleccionado.estado)}
                      </span>
                    </div>

                    <div className="resumen-cobro-grid">
                      <div>
                        <span>Subtotal</span>
                        <strong>{formatearMoneda(pedidoSeleccionado.subtotal)}</strong>
                      </div>

                      <div>
                        <span>Descuento</span>
                        <strong>{formatearMoneda(pedidoSeleccionado.descuento)}</strong>
                      </div>

                      <div>
                        <span>Propina</span>
                        <strong>{formatearMoneda(pedidoSeleccionado.propina)}</strong>
                      </div>

                      <div>
                        <span>Total</span>
                        <strong>{formatearMoneda(pedidoSeleccionado.total)}</strong>
                      </div>

                      <div>
                        <span>Pagado</span>
                        <strong>{formatearMoneda(pedidoSeleccionado.total_pagado)}</strong>
                      </div>

                      <div className="saldo-pendiente-box">
                        <span>Saldo pendiente</span>
                        <strong>{formatearMoneda(pedidoSeleccionado.saldo_pendiente)}</strong>
                      </div>
                    </div>

                    <div className="detalle-productos-caja">
                      <h4>Productos</h4>

                      {detalle.map((item) => (
                        <div key={item.id_detalle} className="producto-cobro-item">
                          <div>
                            <strong>{Number(item.cantidad)} x {item.producto}</strong>

                            {item.observaciones && (
                              <p>{item.observaciones}</p>
                            )}
                          </div>

                          <span>{formatearMoneda(item.subtotal)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pagos-caja">
                      <h4>Pagos registrados</h4>

                      {pagos.length === 0 && (
                        <div className="caja-empty">
                          Sin pagos registrados.
                        </div>
                      )}

                      {pagos.map((item) => (
                        <div key={item.id_pago} className="pago-item">
                          <div>
                            <strong>{item.metodo_pago}</strong>
                            <p>{formatearFecha(item.fecha_pago)}</p>
                            {item.referencia && <p>Ref: {item.referencia}</p>}
                          </div>

                          <span>{formatearMoneda(item.monto)}</span>
                        </div>
                      ))}
                    </div>

                    {Number(pedidoSeleccionado.saldo_pendiente || 0) > 0 && (
                      <form className="form-pago-caja" onSubmit={registrarPago}>
                        <h4>Registrar pago</h4>

                        <div className="row">
                          <div className="col-md-4 mb-3">
                            <label>Método</label>
                            <select
                              name="metodo_pago"
                              className="form-control"
                              value={pago.metodo_pago}
                              onChange={handlePagoChange}
                            >
                              <option value="efectivo">Efectivo</option>
                              <option value="tarjeta">Tarjeta</option>
                              <option value="transferencia">Transferencia</option>
                              <option value="mixto">Mixto</option>
                              <option value="otro">Otro</option>
                            </select>
                          </div>

                          <div className="col-md-4 mb-3">
                            <label>Monto</label>
                            <input
                              type="number"
                              name="monto"
                              className="form-control"
                              value={pago.monto}
                              onChange={handlePagoChange}
                              min="0.01"
                              step="0.01"
                            />
                          </div>

                          <div className="col-md-4 mb-3">
                            <label>Referencia</label>
                            <input
                              type="text"
                              name="referencia"
                              className="form-control"
                              value={pago.referencia}
                              onChange={handlePagoChange}
                              placeholder="Opcional"
                            />
                          </div>

                          <div className="col-md-12 mb-3">
                            <label>Observaciones</label>
                            <input
                              type="text"
                              name="observaciones"
                              className="form-control"
                              value={pago.observaciones}
                              onChange={handlePagoChange}
                              placeholder="Opcional"
                            />
                          </div>
                        </div>

                        <div className="caja-actions">
                          <button
                            type="button"
                            className="btn btn-outline-warning"
                            onClick={actualizarPropina}
                            disabled={
                              cargando ||
                              !pedidoSeleccionado ||
                              pedidoSeleccionado.estado === 'pagado' ||
                              pedidoSeleccionado.estado === 'cancelado'
                            }
                          >
                            Agregar propina
                          </button>

                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={pagoRapidoCompleto}
                            disabled={cargando}
                          >
                            Cobrar saldo completo
                          </button>

                          <button
                            type="submit"
                            className="btn btn-caja-save"
                            disabled={cargando}
                          >
                            {cargando ? 'Registrando...' : 'Registrar pago'}
                          </button>
                        </div>
                      </form>
                    )}

                    {Number(pedidoSeleccionado.saldo_pendiente || 0) <= 0 && (
                      <div className="pedido-pagado-box">
                        Este pedido ya está pagado completamente.
                      </div>
                    )}
                  </>
                )}
              </section>

            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default Caja;