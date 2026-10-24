import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Home.css';
import AuthContext from './AuthContext';
import Sidebar from './sidebar';
import Navbar from './Navbar';

const URL = process.env.REACT_APP_URL_BACKEND || 'http://localhost:3001';

function Home() {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const { user, token, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const fechaActual = new Date();
  const mesActual = `${fechaActual.getFullYear()}-${String(fechaActual.getMonth() + 1).padStart(2, '0')}`;

  const [mesSeleccionado, setMesSeleccionado] = useState(mesActual);

  const [resumen, setResumen] = useState({
    total_mesas: 0,
    mesas_libres: 0,
    mesas_ocupadas: 0,
    mesas_reservadas: 0,
    pedidos_hoy: 0,
    pedidos_mes: 0,
    pedidos_activos: 0,
    pedidos_en_cocina: 0,
    pedidos_listos: 0,
    pedidos_pagados: 0,
    pedidos_cancelados: 0,
    ventas_hoy: 0,
    ventas_mes: 0,
    pagos_recibidos_mes: 0,
    saldo_pendiente_total: 0,
    total_productos: 0,
    total_clientes: 0
  });

  const [ultimosPedidos, setUltimosPedidos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [mensajeError, setMensajeError] = useState('');

const obtenerToken = () => {
  return token || localStorage.getItem('token');
};

const getConfigAxios = () => {
  const authToken = obtenerToken();

  return {
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  };
};
  const toggleSidebar = () => {
    setSidebarOpen(!isSidebarOpen);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const obtenerResumen = async () => {
    try {
      setCargando(true);
      setMensajeError('');

      const [anio, mes] = mesSeleccionado.split('-');

      const response = await axios.get(
  `${URL}/dashboard/resumen?anio=${anio}&mes=${Number(mes)}`,
  getConfigAxios()
);

      setResumen(response.data.resumen || {});
      setUltimosPedidos(response.data.ultimos_pedidos || []);

    } catch (error) {
      console.error('Error al obtener resumen:', error);

      if (error.response?.status === 401 || error.response?.status === 403) {
        alert('Tu sesión expiró. Inicia sesión nuevamente.');
        logout();
        navigate('/login');
        return;
      }

      setMensajeError('No se pudo cargar el resumen del restaurante.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    obtenerResumen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesSeleccionado]);

  const formatearMoneda = (valor) => {
    return `Q${Number(valor || 0).toFixed(2)}`;
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return 'Sin fecha';

    const fechaObj = new Date(fecha);

    if (Number.isNaN(fechaObj.getTime())) {
      return 'Sin fecha';
    }

    return fechaObj.toLocaleDateString('es-GT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const nombreMesSeleccionado = () => {
    const [anio, mes] = mesSeleccionado.split('-');
    const fecha = new Date(Number(anio), Number(mes) - 1, 1);

    return fecha.toLocaleDateString('es-GT', {
      month: 'long',
      year: 'numeric'
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

          <div className="container-fluid home-container">

            <div className="home-header mt-4">
              <div>
                <span className="home-badge">
                  Sistema para restaurantes
                </span>

                <h2>Bienvenido al Sistema de Restaurante</h2>

                <p>
                  Administra mesas, pedidos, cocina, productos, caja, pagos y reportes desde un solo lugar.
                </p>

                {user && (
                  <div className="user-welcome">
                    <span>
                      Usuario: <strong>{user.nombre || user.usuario}</strong>
                    </span>

                    {user.nombre_restaurante && (
                      <span>
                        Restaurante: <strong>{user.nombre_restaurante}</strong>
                      </span>
                    )}

                    {user.rol && (
                      <span>
                        Rol: <strong>{user.rol}</strong>
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="home-filtro-mes">
                <label>Resumen del mes</label>

                <input
                  type="month"
                  className="form-control"
                  value={mesSeleccionado}
                  onChange={(e) => setMesSeleccionado(e.target.value)}
                />

                <button
                  type="button"
                  className="btn btn-outline-primary btn-home-refresh mt-2"
                  onClick={obtenerResumen}
                  disabled={cargando}
                >
                  {cargando ? 'Actualizando...' : 'Actualizar'}
                </button>
              </div>
            </div>

            <div className="home-periodo mt-3">
              Mostrando datos de: <strong>{nombreMesSeleccionado()}</strong>
            </div>

            {mensajeError && (
              <div className="alert alert-danger mt-3">
                {mensajeError}
              </div>
            )}

            <div className="row mt-4">

              <div className="col-md-3 mb-3">
                <div className="home-card">
                  <div className="home-card-icon">🍽️</div>
                  <h5>Mesas ocupadas</h5>
                  <h3>{resumen.mesas_ocupadas || 0}</h3>
                  <p>Mesas ocupadas actualmente en el restaurante.</p>
                </div>
              </div>

              <div className="col-md-3 mb-3">
                <div className="home-card">
                  <div className="home-card-icon">🟢</div>
                  <h5>Mesas libres</h5>
                  <h3>{resumen.mesas_libres || 0}</h3>
                  <p>Mesas disponibles para nuevos pedidos.</p>
                </div>
              </div>

              <div className="col-md-3 mb-3">
                <div className="home-card">
                  <div className="home-card-icon">👨‍🍳</div>
                  <h5>Pedidos en cocina</h5>
                  <h3>{resumen.pedidos_en_cocina || 0}</h3>
                  <p>Pedidos enviados a cocina o en preparación.</p>
                </div>
              </div>

              <div className="col-md-3 mb-3">
                <div className="home-card">
                  <div className="home-card-icon">💰</div>
                  <h5>Ventas de hoy</h5>
                  <h3>{formatearMoneda(resumen.ventas_hoy)}</h3>
                  <p>Total vendido durante el día actual.</p>
                </div>
              </div>

            </div>

            <div className="row mt-2">

              <div className="col-md-3 mb-3">
                <div className="home-card small-card">
                  <h5>Ventas del mes</h5>
                  <h3>{formatearMoneda(resumen.ventas_mes)}</h3>
                </div>
              </div>

              <div className="col-md-3 mb-3">
                <div className="home-card small-card">
                  <h5>Pagos recibidos del mes</h5>
                  <h3>{formatearMoneda(resumen.pagos_recibidos_mes)}</h3>
                </div>
              </div>

              <div className="col-md-3 mb-3">
                <div className="home-card small-card">
                  <h5>Pedidos pagados</h5>
                  <h3>{resumen.pedidos_pagados || 0}</h3>
                </div>
              </div>

              <div className="col-md-3 mb-3">
                <div className="home-card small-card">
                  <h5>Total pedidos del mes</h5>
                  <h3>{resumen.pedidos_mes || 0}</h3>
                </div>
              </div>

            </div>

            <div className="row mt-2">

              <div className="col-md-3 mb-3">
                <div className="home-card small-card">
                  <h5>Pedidos activos</h5>
                  <h3>{resumen.pedidos_activos || 0}</h3>
                </div>
              </div>

              <div className="col-md-3 mb-3">
                <div className="home-card small-card">
                  <h5>Pedidos listos</h5>
                  <h3>{resumen.pedidos_listos || 0}</h3>
                </div>
              </div>

              <div className="col-md-3 mb-3">
                <div className="home-card small-card">
                  <h5>Total productos</h5>
                  <h3>{resumen.total_productos || 0}</h3>
                </div>
              </div>

              <div className="col-md-3 mb-3">
                <div className="home-card small-card">
                  <h5>Total clientes</h5>
                  <h3>{resumen.total_clientes || 0}</h3>
                </div>
              </div>

            </div>

            <div className="quick-actions mt-4">
              <h4>Accesos rápidos</h4>

              <div className="row mt-3">

                <div className="col-md-3 mb-3">
                  <div
                    className="quick-card"
                    onClick={() => navigate('/mesas')}
                  >
                    <h5>🍽️ Mesas</h5>
                    <p>Ver mesas libres, ocupadas y abrir pedidos.</p>
                  </div>
                </div>

                <div className="col-md-3 mb-3">
                  <div
                    className="quick-card"
                    onClick={() => navigate('/nuevo-pedido')}
                  >
                    <h5>🧾 Nuevo pedido</h5>
                    <p>Registrar pedido en mesa, para llevar o delivery.</p>
                  </div>
                </div>

                <div className="col-md-3 mb-3">
                  <div
                    className="quick-card"
                    onClick={() => navigate('/cocina')}
                  >
                    <h5>👨‍🍳 Cocina</h5>
                    <p>Ver pedidos pendientes y marcar como listos.</p>
                  </div>
                </div>

                <div className="col-md-3 mb-3">
                  <div
                    className="quick-card"
                    onClick={() => navigate('/caja')}
                  >
                    <h5>💵 Caja</h5>
                    <p>Cobrar pedidos, registrar pagos y cerrar ventas.</p>
                  </div>
                </div>

              </div>
            </div>

            <div className="ultimos-pedidos mt-4">
              <div className="ultimos-header">
                <h4>Últimos pedidos del mes</h4>

                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => navigate('/pedidos')}
                >
                  Ver pedidos
                </button>
              </div>

              {cargando && (
                <div className="home-empty">
                  Cargando información...
                </div>
              )}

              {!cargando && ultimosPedidos.length === 0 && (
                <div className="home-empty">
                  No hay pedidos registrados en este mes.
                </div>
              )}

              {!cargando && ultimosPedidos.length > 0 && (
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Pedido</th>
                        <th>Tipo</th>
                        <th>Mesa</th>
                        <th>Cliente</th>
                        <th>Fecha</th>
                        <th>Estado</th>
                        <th>Total</th>
                        <th>Saldo</th>
                      </tr>
                    </thead>

                    <tbody>
                      {ultimosPedidos.map((pedido) => (
                        <tr key={pedido.id_pedido}>
                          <td>
                            <strong>#{pedido.id_pedido}</strong>
                          </td>

                          <td>{pedido.tipo_pedido || 'mesa'}</td>

                          <td>
                            {pedido.numero_mesa
                              ? `Mesa ${pedido.numero_mesa}`
                              : 'Sin mesa'}
                          </td>

                          <td>{pedido.cliente || 'Consumidor final'}</td>

                          <td>{formatearFecha(pedido.fecha_pedido)}</td>

                          <td>
                            <span className={`estado-home estado-${pedido.estado}`}>
                              {traducirEstado(pedido.estado)}
                            </span>
                          </td>

                          <td>{formatearMoneda(pedido.total)}</td>

                          <td>{formatearMoneda(pedido.saldo_pendiente)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default Home;