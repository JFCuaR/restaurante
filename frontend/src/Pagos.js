import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import AuthContext from './AuthContext';
import Sidebar from './sidebar';
import Navbar from './Navbar';
import './Pagos.css';

const URL = process.env.REACT_APP_URL_BACKEND || 'http://localhost:3001';

function Pagos() {
  const { token, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const hoy = new Date().toISOString().slice(0, 10);

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [pagos, setPagos] = useState([]);

  const [resumen, setResumen] = useState({
    total_pagos: 0,
    monto_total: 0,
    efectivo: 0,
    tarjeta: 0,
    transferencia: 0,
    mixto: 0,
    otro: 0
  });

  const [filtros, setFiltros] = useState({
    fecha_inicio: hoy.slice(0, 8) + '01',
    fecha_fin: hoy,
    metodo_pago: 'todos',
    buscar: ''
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

  const cargarPagos = async () => {
    try {
      setCargando(true);

      const params = new URLSearchParams();

      if (filtros.fecha_inicio) params.append('fecha_inicio', filtros.fecha_inicio);
      if (filtros.fecha_fin) params.append('fecha_fin', filtros.fecha_fin);
      if (filtros.metodo_pago) params.append('metodo_pago', filtros.metodo_pago);
      if (filtros.buscar.trim()) params.append('buscar', filtros.buscar.trim());

      const response = await axios.get(
        `${URL}/pagos?${params.toString()}`,
        getConfig()
      );

      setPagos(response.data.pagos || []);
      setResumen(response.data.resumen || {
        total_pagos: 0,
        monto_total: 0,
        efectivo: 0,
        tarjeta: 0,
        transferencia: 0,
        mixto: 0,
        otro: 0
      });

    } catch (error) {
      console.error('Error cargando pagos:', error);

      if (error.response?.status === 401 || error.response?.status === 403) {
        Swal.fire('Sesión vencida', 'Inicia sesión nuevamente', 'warning');
        logout();
        navigate('/login');
        return;
      }

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudieron cargar los pagos',
        'error'
      );

    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarPagos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;

    setFiltros({
      ...filtros,
      [name]: value
    });
  };

  const verDetallePago = async (pago) => {
    try {
      const response = await axios.get(
        `${URL}/pagos/${pago.id_pago}`,
        getConfig()
      );

      const item = response.data;

      Swal.fire({
        title: `Pago #${item.id_pago}`,
        width: 700,
        html: `
          <div style="text-align:left">
            <p><strong>Pedido:</strong> #${item.id_pedido}</p>
            <p><strong>Método:</strong> ${traducirMetodo(item.metodo_pago)}</p>
            <p><strong>Monto:</strong> ${formatearMoneda(item.monto)}</p>
            <p><strong>Fecha:</strong> ${formatearFecha(item.fecha_pago)}</p>
            <p><strong>Cobrado por:</strong> ${item.usuario || 'Sin usuario'}</p>
            <p><strong>Cliente:</strong> ${item.cliente_nombre || 'Consumidor final'}</p>
            <p><strong>Mesa:</strong> ${item.numero_mesa ? 'Mesa ' + item.numero_mesa : 'Sin mesa'}</p>
            <p><strong>Referencia:</strong> ${item.referencia || 'Sin referencia'}</p>
            <p><strong>Observaciones:</strong> ${item.observaciones || 'Sin observaciones'}</p>

            <hr />

            <p><strong>Total pedido:</strong> ${formatearMoneda(item.total)}</p>
            <p><strong>Total pagado:</strong> ${formatearMoneda(item.total_pagado)}</p>
            <p><strong>Saldo pendiente:</strong> ${formatearMoneda(item.saldo_pendiente)}</p>
          </div>
        `,
        confirmButtonText: 'Cerrar',
        confirmButtonColor: '#ea580c'
      });

    } catch (error) {
      console.error('Error viendo pago:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo ver el detalle del pago',
        'error'
      );
    }
  };

  const irAPedido = (pago) => {
    navigate(`/pedidos?buscar=${pago.id_pedido}`);
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

  const traducirMetodo = (metodo) => {
    const metodos = {
      efectivo: 'Efectivo',
      tarjeta: 'Tarjeta',
      transferencia: 'Transferencia',
      mixto: 'Mixto',
      otro: 'Otro'
    };

    return metodos[metodo] || metodo;
  };

  const traducirTipo = (tipo) => {
    const tipos = {
      mesa: 'Mesa',
      para_llevar: 'Para llevar',
      delivery: 'Delivery'
    };

    return tipos[tipo] || tipo;
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

          <div className="container-fluid pagos-container">

            <div className="pagos-header mt-4">
              <div>
                <span className="pagos-badge">Caja</span>
                <h2>Pagos</h2>
                <p>
                  Consulta los pagos registrados, métodos de pago, referencias y usuario que cobró.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-pagos-refresh"
                onClick={cargarPagos}
                disabled={cargando}
              >
                {cargando ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>

            <div className="pagos-resumen mt-4">
              <div className="pago-resumen-card principal">
                <span>Total cobrado</span>
                <h3>{formatearMoneda(resumen.monto_total)}</h3>
                <p>{resumen.total_pagos} pagos registrados</p>
              </div>

              <div className="pago-resumen-card">
                <span>Efectivo</span>
                <h3>{formatearMoneda(resumen.efectivo)}</h3>
              </div>

              <div className="pago-resumen-card">
                <span>Tarjeta</span>
                <h3>{formatearMoneda(resumen.tarjeta)}</h3>
              </div>

              <div className="pago-resumen-card">
                <span>Transferencia</span>
                <h3>{formatearMoneda(resumen.transferencia)}</h3>
              </div>

              <div className="pago-resumen-card">
                <span>Mixto</span>
                <h3>{formatearMoneda(resumen.mixto)}</h3>
              </div>

              <div className="pago-resumen-card">
                <span>Otro</span>
                <h3>{formatearMoneda(resumen.otro)}</h3>
              </div>
            </div>

            <div className="pagos-filtros mt-4">
              <div>
                <label>Fecha inicio</label>
                <input
                  type="date"
                  name="fecha_inicio"
                  className="form-control"
                  value={filtros.fecha_inicio}
                  onChange={handleFiltroChange}
                />
              </div>

              <div>
                <label>Fecha fin</label>
                <input
                  type="date"
                  name="fecha_fin"
                  className="form-control"
                  value={filtros.fecha_fin}
                  onChange={handleFiltroChange}
                />
              </div>

              <div>
                <label>Método</label>
                <select
                  name="metodo_pago"
                  className="form-control"
                  value={filtros.metodo_pago}
                  onChange={handleFiltroChange}
                >
                  <option value="todos">Todos</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="mixto">Mixto</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div>
                <label>Buscar</label>
                <input
                  type="text"
                  name="buscar"
                  className="form-control"
                  value={filtros.buscar}
                  onChange={handleFiltroChange}
                  placeholder="Pedido, cliente, mesa o referencia"
                />
              </div>

              <div className="d-flex align-items-end">
                <button
                  type="button"
                  className="btn btn-pagos-save"
                  onClick={cargarPagos}
                >
                  Filtrar
                </button>
              </div>
            </div>

            <div className="pagos-lista mt-4">
              {cargando && pagos.length === 0 && (
                <div className="pagos-empty">
                  Cargando pagos...
                </div>
              )}

              {!cargando && pagos.length === 0 && (
                <div className="pagos-empty">
                  No hay pagos registrados.
                </div>
              )}

              {pagos.map((pago) => (
                <div key={pago.id_pago} className="pago-card">
                  <div className="pago-card-top">
                    <div>
                      <span className="pago-metodo">
                        {traducirMetodo(pago.metodo_pago)}
                      </span>

                      <h3>{formatearMoneda(pago.monto)}</h3>

                      <p>Pedido #{pago.id_pedido}</p>
                    </div>

                    <strong>
                      {formatearFecha(pago.fecha_pago)}
                    </strong>
                  </div>

                  <div className="pago-info">
                    <span>
                      {traducirTipo(pago.tipo_pedido)}
                    </span>

                    {pago.numero_mesa && (
                      <span>Mesa {pago.numero_mesa}</span>
                    )}

                    <span>
                      Cajero: {pago.usuario || 'Sin usuario'}
                    </span>
                  </div>

                  <div className="pago-cliente">
                    <strong>
                      {pago.cliente_nombre || 'Consumidor final'}
                    </strong>

                    {pago.cliente_telefono && (
                      <p>{pago.cliente_telefono}</p>
                    )}
                  </div>

                  {pago.referencia && (
                    <div className="pago-referencia">
                      Ref: {pago.referencia}
                    </div>
                  )}

                  {pago.observaciones && (
                    <div className="pago-referencia">
                      {pago.observaciones}
                    </div>
                  )}

                  <div className="pago-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => verDetallePago(pago)}
                    >
                      Ver detalle
                    </button>

                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => irAPedido(pago)}
                    >
                      Ver pedido
                    </button>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default Pagos;