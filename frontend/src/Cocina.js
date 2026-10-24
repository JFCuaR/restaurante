import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import AuthContext from './AuthContext';
import Sidebar from './sidebar';
import Navbar from './Navbar';
import './Cocina.css';

const URL = process.env.REACT_APP_URL_BACKEND || 'http://localhost:3001';

function Cocina() {
  const { token, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [filtro, setFiltro] = useState('todos');

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

      const response = await axios.get(`${URL}/cocina/pedidos`, getConfig());

      setPedidos(response.data || []);

    } catch (error) {
      console.error('Error cargando cocina:', error);

      if (error.response?.status === 401 || error.response?.status === 403) {
        Swal.fire('Sesión vencida', 'Inicia sesión nuevamente', 'warning');
        logout();
        navigate('/login');
        return;
      }

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudieron cargar los pedidos de cocina',
        'error'
      );

    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarPedidos();

    const intervalo = setInterval(() => {
      cargarPedidos();
    }, 30000);

    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cambiarEstadoDetalle = async (detalle, estado) => {
    try {
      await axios.patch(
        `${URL}/cocina/detalle/${detalle.id_detalle}/estado`,
        { estado_cocina: estado },
        getConfig()
      );

      cargarPedidos();

    } catch (error) {
      console.error('Error cambiando estado:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo actualizar el estado',
        'error'
      );
    }
  };

  const marcarPedidoListo = async (pedido) => {
    const result = await Swal.fire({
      title: '¿Marcar pedido como listo?',
      text: `Pedido #${pedido.id_pedido}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, marcar listo',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ea580c',
      cancelButtonColor: '#6b7280'
    });

    if (!result.isConfirmed) return;

    try {
      await axios.patch(
        `${URL}/cocina/pedidos/${pedido.id_pedido}/listo`,
        {},
        getConfig()
      );

      Swal.fire('Listo', 'Pedido marcado como listo', 'success');

      cargarPedidos();

    } catch (error) {
      console.error('Error marcando listo:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo marcar el pedido como listo',
        'error'
      );
    }
  };

  const formatearHora = (fecha) => {
    if (!fecha) return '';

    const fechaObj = new Date(fecha);

    if (Number.isNaN(fechaObj.getTime())) return '';

    return fechaObj.toLocaleTimeString('es-GT', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const traducirTipo = (tipo) => {
    const tipos = {
      mesa: 'Mesa',
      para_llevar: 'Para llevar',
      delivery: 'Delivery'
    };

    return tipos[tipo] || tipo;
  };

  const traducirEstado = (estado) => {
    const estados = {
      en_cocina: 'En cocina',
      preparando: 'Preparando',
      listo: 'Listo',
      pendiente: 'Pendiente',
      entregado: 'Entregado',
      cancelado: 'Cancelado'
    };

    return estados[estado] || estado;
  };

  const pedidosFiltrados = pedidos.filter((pedido) => {
    if (filtro === 'todos') return true;
    return pedido.estado === filtro;
  });

  const contadorEstado = (estado) => {
    return pedidos.filter((pedido) => pedido.estado === estado).length;
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

          <div className="container-fluid cocina-container">

            <div className="cocina-header mt-4">
              <div>
                <span className="cocina-badge">Área de cocina</span>
                <h2>Pedidos en cocina</h2>
                <p>
                  Visualiza los pedidos pendientes, cambia productos a preparando
                  y marca los pedidos como listos.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-cocina-refresh"
                onClick={cargarPedidos}
                disabled={cargando}
              >
                {cargando ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>

            <div className="cocina-filtros mt-4">
              <button
                className={filtro === 'todos' ? 'activo' : ''}
                onClick={() => setFiltro('todos')}
              >
                Todos ({pedidos.length})
              </button>

              <button
                className={filtro === 'en_cocina' ? 'activo' : ''}
                onClick={() => setFiltro('en_cocina')}
              >
                En cocina ({contadorEstado('en_cocina')})
              </button>

              <button
                className={filtro === 'preparando' ? 'activo' : ''}
                onClick={() => setFiltro('preparando')}
              >
                Preparando ({contadorEstado('preparando')})
              </button>

              <button
                className={filtro === 'listo' ? 'activo' : ''}
                onClick={() => setFiltro('listo')}
              >
                Listos ({contadorEstado('listo')})
              </button>
            </div>

            <div className="cocina-grid mt-4">
              {cargando && pedidos.length === 0 && (
                <div className="cocina-empty">
                  Cargando pedidos...
                </div>
              )}

              {!cargando && pedidosFiltrados.length === 0 && (
                <div className="cocina-empty">
                  No hay pedidos en cocina.
                </div>
              )}

              {pedidosFiltrados.map((pedido) => (
                <div
                  key={pedido.id_pedido}
                  className={`cocina-card pedido-${pedido.estado}`}
                >
                  <div className="cocina-card-header">
                    <div>
                      <span className="pedido-label">Pedido</span>
                      <h3>#{pedido.id_pedido}</h3>
                    </div>

                    <span className={`pedido-estado estado-${pedido.estado}`}>
                      {traducirEstado(pedido.estado)}
                    </span>
                  </div>

                  <div className="pedido-meta">
                    <span>
                      {pedido.tipo_pedido === 'mesa'
                        ? `Mesa ${pedido.numero_mesa || ''}`
                        : traducirTipo(pedido.tipo_pedido)}
                    </span>

                    <span>
                      Hora: {formatearHora(pedido.fecha_pedido)}
                    </span>
                  </div>

                  {pedido.cliente_nombre && (
                    <p className="pedido-cliente">
                      Cliente: <strong>{pedido.cliente_nombre}</strong>
                    </p>
                  )}

                  {pedido.observaciones && (
                    <div className="pedido-observacion">
                      {pedido.observaciones}
                    </div>
                  )}

                  <div className="detalle-cocina-lista">
                    {pedido.detalles.map((detalle) => (
                      <div
                        key={detalle.id_detalle}
                        className={`detalle-cocina detalle-${detalle.estado_cocina}`}
                      >
                        <div>
                          <h5>
                            {Number(detalle.cantidad)} x {detalle.producto}
                          </h5>

                          {detalle.observaciones && (
                            <p>{detalle.observaciones}</p>
                          )}

                          <span>{traducirEstado(detalle.estado_cocina)}</span>
                        </div>

                        <div className="detalle-cocina-actions">
                          <button
                            type="button"
                            onClick={() => cambiarEstadoDetalle(detalle, 'preparando')}
                            disabled={detalle.estado_cocina === 'preparando' || detalle.estado_cocina === 'listo'}
                          >
                            Preparar
                          </button>

                          <button
                            type="button"
                            onClick={() => cambiarEstadoDetalle(detalle, 'listo')}
                            disabled={detalle.estado_cocina === 'listo'}
                          >
                            Listo
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="btn btn-pedido-listo"
                    onClick={() => marcarPedidoListo(pedido)}
                    disabled={pedido.estado === 'listo'}
                  >
                    {pedido.estado === 'listo' ? 'Pedido listo' : 'Marcar todo listo'}
                  </button>
                </div>
              ))}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default Cocina;