import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import AuthContext from './AuthContext';
import Sidebar from './sidebar';
import Navbar from './Navbar';
import './Clientes.css';

const URL = process.env.REACT_APP_URL_BACKEND || 'http://localhost:3001';

function Clientes() {
  const { token, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [pedidosCliente, setPedidosCliente] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');

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

  const cargarClientes = async () => {
    try {
      setCargando(true);

      const params = new URLSearchParams();

      if (busqueda.trim()) {
        params.append('buscar', busqueda.trim());
      }

      const response = await axios.get(
        `${URL}/clientes-facturacion?${params.toString()}`,
        getConfig()
      );

      setClientes(response.data || []);

    } catch (error) {
      console.error('Error cargando clientes:', error);

      if (error.response?.status === 401 || error.response?.status === 403) {
        Swal.fire('Sesión vencida', 'Inicia sesión nuevamente', 'warning');
        logout();
        navigate('/login');
        return;
      }

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudieron cargar los clientes',
        'error'
      );

    } finally {
      setCargando(false);
    }
  };

  const cargarPedidosCliente = async (cliente) => {
    try {
      setCargando(true);

      const response = await axios.get(
        `${URL}/clientes-facturacion/${cliente.id_cliente_facturacion}/pedidos`,
        getConfig()
      );

      setClienteSeleccionado(response.data.cliente);
      setPedidosCliente(response.data.pedidos || []);

    } catch (error) {
      console.error('Error cargando pedidos del cliente:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudieron cargar los pedidos del cliente',
        'error'
      );

    } finally {
      setCargando(false);
    }
  };

  const verDetallePedido = async (idPedido) => {
    try {
      setCargando(true);

      const response = await axios.get(
        `${URL}/clientes-facturacion/pedidos/${idPedido}`,
        getConfig()
      );

      const pedido = response.data.pedido;
      const detalle = response.data.detalle || [];
      const pagos = response.data.pagos || [];

      const detalleHtml = detalle.map((item) => {
        return `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;">
              ${Number(item.cantidad)}
            </td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;">
              <strong>${item.producto}</strong>
              ${item.observaciones ? `<br><small>${item.observaciones}</small>` : ''}
            </td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">
              Q${Number(item.precio_unitario || 0).toFixed(2)}
            </td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">
              Q${Number(item.subtotal || 0).toFixed(2)}
            </td>
          </tr>
        `;
      }).join('');

      const pagosHtml = pagos.length > 0
        ? pagos.map((item) => {
            return `
              <div style="
                display:flex;
                justify-content:space-between;
                gap:10px;
                padding:8px 0;
                border-bottom:1px solid #e5e7eb;
              ">
                <div>
                  <strong>${item.metodo_pago}</strong>
                  <br>
                  <small>${formatearFecha(item.fecha_pago)}</small>
                  ${item.referencia ? `<br><small>Ref: ${item.referencia}</small>` : ''}
                </div>
                <strong>Q${Number(item.monto || 0).toFixed(2)}</strong>
              </div>
            `;
          }).join('')
        : '<p>Sin pagos registrados.</p>';

      await Swal.fire({
        title: `Pedido #${pedido.id_pedido}`,
        width: 850,
        html: `
          <div style="text-align:left">
            <div style="
              display:grid;
              grid-template-columns:repeat(2, 1fr);
              gap:10px;
              margin-bottom:15px;
            ">
              <div>
                <strong>Cliente:</strong><br>
                ${pedido.nombre_facturacion || pedido.cliente_nombre || 'Consumidor final'}
              </div>

              <div>
                <strong>NIT:</strong><br>
                ${pedido.nit || 'CF'}
              </div>

              <div>
                <strong>Tipo:</strong><br>
                ${traducirTipo(pedido.tipo_pedido)}
                ${pedido.numero_mesa ? ` - Mesa ${pedido.numero_mesa}` : ''}
              </div>

              <div>
                <strong>Estado:</strong><br>
                ${traducirEstado(pedido.estado)}
              </div>

              <div>
                <strong>Fecha pedido:</strong><br>
                ${formatearFecha(pedido.fecha_pedido)}
              </div>

              <div>
                <strong>Fecha pagado:</strong><br>
                ${formatearFecha(pedido.fecha_pagado)}
              </div>
            </div>

            <hr />

            <h4>Productos</h4>

            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <thead>
                <tr>
                  <th style="padding:8px;text-align:left;border-bottom:2px solid #111827;">Cant.</th>
                  <th style="padding:8px;text-align:left;border-bottom:2px solid #111827;">Producto</th>
                  <th style="padding:8px;text-align:right;border-bottom:2px solid #111827;">Precio</th>
                  <th style="padding:8px;text-align:right;border-bottom:2px solid #111827;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${detalleHtml}
              </tbody>
            </table>

            <hr />

            <div style="
              display:grid;
              grid-template-columns:repeat(2, 1fr);
              gap:10px;
              margin-bottom:15px;
            ">
              <div><strong>Subtotal:</strong> Q${Number(pedido.subtotal || 0).toFixed(2)}</div>
              <div><strong>Descuento:</strong> Q${Number(pedido.descuento || 0).toFixed(2)}</div>
              <div><strong>Propina:</strong> Q${Number(pedido.propina || 0).toFixed(2)}</div>
              <div><strong>Total:</strong> Q${Number(pedido.total || 0).toFixed(2)}</div>
              <div><strong>Pagado:</strong> Q${Number(pedido.total_pagado || 0).toFixed(2)}</div>
              <div><strong>Saldo:</strong> Q${Number(pedido.saldo_pendiente || 0).toFixed(2)}</div>
            </div>

            <hr />

            <h4>Pagos</h4>
            ${pagosHtml}
          </div>
        `,
        confirmButtonText: 'Cerrar',
        confirmButtonColor: '#ea580c'
      });

    } catch (error) {
      console.error('Error viendo detalle:', error);

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
    cargarClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clientesFiltrados = clientes.filter((cliente) => {
    const texto = `
      ${cliente.nit || ''}
      ${cliente.nombre_facturacion || ''}
      ${cliente.direccion_facturacion || ''}
      ${cliente.correo_facturacion || ''}
    `.toLowerCase();

    return texto.includes(busqueda.toLowerCase());
  });

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

          <div className="container-fluid clientes-container">

            <div className="clientes-header mt-4">
              <div>
                <span className="clientes-badge">Facturación</span>
                <h2>Clientes</h2>
                <p>
                  Consulta los clientes registrados desde caja, sus pedidos y el detalle de sus compras.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-clientes-refresh"
                onClick={cargarClientes}
                disabled={cargando}
              >
                {cargando ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>

            <div className="clientes-toolbar mt-4">
              <div>
                <h4>Clientes registrados en cobros</h4>
                <span>{clientesFiltrados.length} clientes encontrados</span>
              </div>

              <div className="clientes-search-box">
                <input
                  type="text"
                  className="form-control clientes-busqueda"
                  placeholder="Buscar por NIT, nombre, correo o dirección..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      cargarClientes();
                    }
                  }}
                />

                <button
                  type="button"
                  className="btn btn-clientes-save"
                  onClick={cargarClientes}
                  disabled={cargando}
                >
                  Buscar
                </button>
              </div>
            </div>

            <div className="clientes-grid mt-4">
              {cargando && clientes.length === 0 && (
                <div className="clientes-empty">
                  Cargando clientes...
                </div>
              )}

              {!cargando && clientesFiltrados.length === 0 && (
                <div className="clientes-empty">
                  No hay clientes registrados desde caja.
                </div>
              )}

              {clientesFiltrados.map((cliente) => (
                <div
                  key={cliente.id_cliente_facturacion}
                  className="cliente-card cliente-activo"
                  onClick={() => cargarPedidosCliente(cliente)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="cliente-card-top">
                    <div>
                      <span className="cliente-label">
                        Cliente facturación
                      </span>
                      <h3>{cliente.nombre_facturacion || 'Consumidor final'}</h3>
                      <p>NIT: {cliente.nit || 'CF'}</p>
                    </div>

                    <span className="cliente-estado estado-activo">
                      {Number(cliente.total_pedidos || 0)} pedido(s)
                    </span>
                  </div>

                  <div className="cliente-info">
                    {cliente.correo_facturacion && (
                      <span>{cliente.correo_facturacion}</span>
                    )}

                    <span>
                      Total consumido: {formatearMoneda(cliente.total_consumido)}
                    </span>

                    <span>
                      Total pagado: {formatearMoneda(cliente.total_pagado)}
                    </span>
                  </div>

                  {cliente.direccion_facturacion && (
                    <div className="cliente-direccion">
                      {cliente.direccion_facturacion}
                    </div>
                  )}

                  <div className="cliente-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        cargarPedidosCliente(cliente);
                      }}
                    >
                      Ver pedidos
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {clienteSeleccionado && (
              <div className="clientes-form-card mt-4">
                <div className="clientes-toolbar">
                  <div>
                    <h4>Pedidos de {clienteSeleccionado.nombre_facturacion}</h4>
                    <span>NIT: {clienteSeleccionado.nit || 'CF'}</span>
                  </div>

                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => {
                      setClienteSeleccionado(null);
                      setPedidosCliente([]);
                    }}
                  >
                    Cerrar historial
                  </button>
                </div>

                <div className="table-responsive mt-3">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Pedido</th>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Mesa</th>
                        <th>Estado</th>
                        <th>Total</th>
                        <th>Pagado</th>
                        <th>Saldo</th>
                        <th></th>
                      </tr>
                    </thead>

                    <tbody>
                      {pedidosCliente.length === 0 && (
                        <tr>
                          <td colSpan="9" className="text-center">
                            Este cliente no tiene pedidos.
                          </td>
                        </tr>
                      )}

                      {pedidosCliente.map((pedido) => (
                        <tr key={pedido.id_pedido}>
                          <td>#{pedido.id_pedido}</td>
                          <td>{formatearFecha(pedido.fecha_pedido)}</td>
                          <td>{traducirTipo(pedido.tipo_pedido)}</td>
                          <td>
                            {pedido.numero_mesa
                              ? `Mesa ${pedido.numero_mesa}`
                              : '-'}
                          </td>
                          <td>{traducirEstado(pedido.estado)}</td>
                          <td>{formatearMoneda(pedido.total)}</td>
                          <td>{formatearMoneda(pedido.total_pagado)}</td>
                          <td>{formatearMoneda(pedido.saldo_pendiente)}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm btn-clientes-save"
                              onClick={() => verDetallePedido(pedido.id_pedido)}
                            >
                              Ver detalle
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}

export default Clientes;