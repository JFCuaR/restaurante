import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './RecepcionPedidos.css';
import AuthContext from './AuthContext';
import Sidebar from './sidebar';
import Navbar from './Navbar';

const URL = process.env.REACT_APP_URL_BACKEND || 'http://localhost:3001';

function RecepcionPedidos() {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const { token, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [pedidos, setPedidos] = useState([]);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const [detallePedido, setDetallePedido] = useState([]);
  const [pagosPedido, setPagosPedido] = useState([]);

  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardandoPago, setGuardandoPago] = useState(false);

  const [accionParcial, setAccionParcial] = useState('ESPERAR');

  const [nuevoPago, setNuevoPago] = useState({
    monto: '',
    metodo_pago: 'EFECTIVO',
    observacion: ''
  });

  const authToken = token || localStorage.getItem('token');

  const configAxios = {
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!isSidebarOpen);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const obtenerPedidos = async () => {
    try {
      setCargando(true);

      const response = await axios.get(`${URL}/pedidos`, configAxios);

      const pedidosFiltrados = response.data.filter((pedido) =>
        [
          'PENDIENTE',
          'SOLICITADO',
          'EN_CAMINO',
          'RECIBIDO_PARCIAL',
          'RECIBIDO_COMPLETO',
          'LISTO_PARA_ENTREGAR'
        ].includes(pedido.estado)
      );

      setPedidos(pedidosFiltrados);

    } catch (error) {
      console.error('Error al obtener pedidos:', error);

      if (error.response?.status === 401 || error.response?.status === 403) {
        alert('Tu sesión expiró. Inicia sesión nuevamente.');
        logout();
        navigate('/login');
      } else {
        alert('Error al cargar los pedidos.');
      }

    } finally {
      setCargando(false);
    }
  };

  const verDetallePedido = async (idPedido) => {
    try {
      setCargando(true);

      const response = await axios.get(`${URL}/pedidos/${idPedido}`, configAxios);

      setPedidoSeleccionado(response.data.pedido);
      setPagosPedido(response.data.pagos || []);

      const detalleConEstado = response.data.detalle.map((item) => ({
        ...item,
        nuevo_estado: item.estado_producto || 'PENDIENTE'
      }));

      setDetallePedido(detalleConEstado);

      setNuevoPago({
        monto: '',
        metodo_pago: 'EFECTIVO',
        observacion: ''
      });

    } catch (error) {
      console.error('Error al obtener detalle del pedido:', error);

      if (error.response?.status === 401 || error.response?.status === 403) {
        alert('Tu sesión expiró. Inicia sesión nuevamente.');
        logout();
        navigate('/login');
      } else {
        alert('Error al obtener el detalle del pedido.');
      }

    } finally {
      setCargando(false);
    }
  };

  const cerrarDetalle = () => {
    setPedidoSeleccionado(null);
    setDetallePedido([]);
    setPagosPedido([]);
    setAccionParcial('ESPERAR');

    setNuevoPago({
      monto: '',
      metodo_pago: 'EFECTIVO',
      observacion: ''
    });
  };

  const cambiarEstadoProducto = (index, nuevoEstado) => {
    const nuevoDetalle = [...detallePedido];
    nuevoDetalle[index].nuevo_estado = nuevoEstado;
    setDetallePedido(nuevoDetalle);
  };

  const marcarTodoRecibido = () => {
    const nuevoDetalle = detallePedido.map((item) => ({
      ...item,
      nuevo_estado: 'RECIBIDO'
    }));

    setDetallePedido(nuevoDetalle);
  };

  const marcarTodoNoRecibido = () => {
    const nuevoDetalle = detallePedido.map((item) => ({
      ...item,
      nuevo_estado: 'NO_RECIBIDO'
    }));

    setDetallePedido(nuevoDetalle);
  };

  const marcarTodoPendiente = () => {
    const nuevoDetalle = detallePedido.map((item) => ({
      ...item,
      nuevo_estado: 'PENDIENTE'
    }));

    setDetallePedido(nuevoDetalle);
  };

  const calcularEstadoPedido = () => {
    const totalProductos = detallePedido.length;

    const recibidos = detallePedido.filter(
      (item) => item.nuevo_estado === 'RECIBIDO'
    ).length;

    const noRecibidos = detallePedido.filter(
      (item) => item.nuevo_estado === 'NO_RECIBIDO'
    ).length;

    const pendientes = detallePedido.filter(
      (item) => item.nuevo_estado === 'PENDIENTE'
    ).length;

    if (totalProductos === 0) {
      return 'PENDIENTE';
    }

    if (recibidos === totalProductos) {
      return 'LISTO_PARA_ENTREGAR';
    }

    if (recibidos > 0 && recibidos < totalProductos) {
      return 'RECIBIDO_PARCIAL';
    }

    if (recibidos === 0 && noRecibidos > 0) {
      return 'PENDIENTE';
    }

    if (pendientes === totalProductos) {
      return 'PENDIENTE';
    }

    return 'PENDIENTE';
  };

  const guardarRecepcion = async () => {
    if (!pedidoSeleccionado) {
      alert('Selecciona un pedido primero.');
      return;
    }

    if (detallePedido.length === 0) {
      alert('Este pedido no tiene productos para revisar.');
      return;
    }

    const recibidos = detallePedido.filter(
      (item) => item.nuevo_estado === 'RECIBIDO'
    ).length;

    const faltantes = detallePedido.filter(
      (item) => item.nuevo_estado !== 'RECIBIDO'
    ).length;

    if (recibidos > 0 && faltantes > 0 && !accionParcial) {
      alert('Debes elegir si entregarás lo recibido o si esperarás el resto.');
      return;
    }

    try {
      setGuardando(true);

      const productos = detallePedido.map((item) => ({
        id_detalle_pedido: item.id_detalle_pedido,
        estado_producto: item.nuevo_estado
      }));

      const response = await axios.put(
        `${URL}/pedidos/${pedidoSeleccionado.id_pedido}/recepcion`,
        {
          productos,
          accionParcial
        },
        configAxios
      );

      if (response.data.id_pedido_nuevo) {
        alert(
          `Pedido parcial dividido correctamente.\n\n` +
          `Pedido listo para entregar: #${response.data.id_pedido_original}\n` +
          `Nuevo pedido con faltantes: #${response.data.id_pedido_nuevo}`
        );
      } else {
        alert(response.data.mensaje || 'Recepción actualizada correctamente.');
      }

      cerrarDetalle();
      obtenerPedidos();

    } catch (error) {
      console.error('Error al guardar recepción:', error);

      if (error.response?.status === 401 || error.response?.status === 403) {
        alert('Tu sesión expiró. Inicia sesión nuevamente.');
        logout();
        navigate('/login');
        return;
      }

      alert(
        error.response?.data?.mensaje ||
        error.response?.data?.error ||
        'Error al guardar la recepción del pedido.'
      );

    } finally {
      setGuardando(false);
    }
  };

  const handleNuevoPagoChange = (e) => {
    const { name, value } = e.target;

    setNuevoPago({
      ...nuevoPago,
      [name]: value
    });
  };

  const registrarPago = async () => {
    if (!pedidoSeleccionado) {
      alert('Debes seleccionar un pedido primero.');
      return;
    }

    const monto = Number(nuevoPago.monto || 0);
    const saldoActual = Number(pedidoSeleccionado.saldo_pendiente || 0);

    if (!monto || monto <= 0) {
      alert('Debes ingresar un monto válido.');
      return;
    }

    if (saldoActual <= 0) {
      alert('Este pedido ya está pagado por completo.');
      return;
    }

    if (monto > saldoActual) {
      alert('El abono no puede ser mayor al saldo pendiente.');
      return;
    }

    try {
      setGuardandoPago(true);

      await axios.post(
        `${URL}/pedidos/${pedidoSeleccionado.id_pedido}/pagos`,
        {
          monto,
          metodo_pago: nuevoPago.metodo_pago,
          observacion: nuevoPago.observacion
        },
        configAxios
      );

      alert('Abono registrado correctamente.');

      setNuevoPago({
        monto: '',
        metodo_pago: 'EFECTIVO',
        observacion: ''
      });

      await verDetallePedido(pedidoSeleccionado.id_pedido);
      await obtenerPedidos();

    } catch (error) {
      console.error('Error al registrar abono:', error);

      if (error.response?.status === 401 || error.response?.status === 403) {
        alert('Tu sesión expiró. Inicia sesión nuevamente.');
        logout();
        navigate('/login');
        return;
      }

      alert(
        error.response?.data?.mensaje ||
        error.response?.data?.error ||
        'Error al registrar el abono.'
      );

    } finally {
      setGuardandoPago(false);
    }
  };

  useEffect(() => {
    obtenerPedidos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pedidosMostrados = pedidos.filter((pedido) => {
    const texto = `${pedido.id_pedido} ${pedido.cliente} ${pedido.telefono} ${pedido.estado}`.toLowerCase();
    return texto.includes(busqueda.toLowerCase());
  });

  const totalRecibidos = detallePedido.filter(
    (item) => item.nuevo_estado === 'RECIBIDO'
  ).length;

  const totalNoRecibidos = detallePedido.filter(
    (item) => item.nuevo_estado === 'NO_RECIBIDO'
  ).length;

  const totalPendientes = detallePedido.filter(
    (item) => item.nuevo_estado === 'PENDIENTE'
  ).length;

  const totalPagadoPedido = pagosPedido.reduce((total, pago) => {
    return total + Number(pago.monto || 0);
  }, 0);

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

          <div className="container-fluid recepcion-container">

            <div className="recepcion-hero mt-4">
              <div>
                <span className="hero-badge">Recepción de mercadería</span>
                <h2>Recepción de Pedidos</h2>
                <p>
                  Marca por cada cliente qué productos vinieron. Los pedidos completos quedarán listos para entregar y los incompletos quedarán pendientes o parciales.
                </p>
              </div>

              <div className="hero-icon">
                ✅
              </div>
            </div>

            <div className="recepcion-layout mt-4">

              <div className="pedidos-panel">
                <div className="panel-header">
                  <div>
                    <h4>Pedidos activos</h4>
                    <p>
                      Selecciona un pedido para revisar si sus productos vinieron.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={obtenerPedidos}
                  >
                    Actualizar
                  </button>
                </div>

                <input
                  type="text"
                  className="form-control mb-3"
                  placeholder="Buscar por cliente, teléfono o número de pedido..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />

                {cargando && (
                  <div className="mensaje-lista">
                    Cargando pedidos...
                  </div>
                )}

                {!cargando && pedidosMostrados.length === 0 && (
                  <div className="mensaje-lista">
                    No hay pedidos activos para mostrar.
                  </div>
                )}

                <div className="lista-pedidos">
                  {pedidosMostrados.map((pedido) => (
                    <div
                      key={pedido.id_pedido}
                      className={`pedido-item ${
                        pedidoSeleccionado?.id_pedido === pedido.id_pedido ? 'activo' : ''
                      }`}
                      onClick={() => verDetallePedido(pedido.id_pedido)}
                    >
                      <div className="pedido-item-top">
                        <strong>Pedido #{pedido.id_pedido}</strong>
                        <span className={`estado-badge estado-${pedido.estado}`}>
                          {pedido.estado}
                        </span>
                      </div>

                      <h5>{pedido.cliente}</h5>

                      <p>
                        Tel: {pedido.telefono || 'Sin teléfono'}
                      </p>

                      <div className="pedido-item-footer">
                        <span>Total: Q{Number(pedido.total || 0).toFixed(2)}</span>
                        <span>Saldo: Q{Number(pedido.saldo_pendiente || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detalle-panel">
                {!pedidoSeleccionado ? (
                  <div className="detalle-vacio">
                    <div className="detalle-vacio-icon">📦</div>
                    <h4>Selecciona un pedido</h4>
                    <p>
                      Aquí aparecerán los productos del cliente para marcar si vinieron completos o parcialmente.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="detalle-header">
                      <div>
                        <span className="hero-badge detalle-badge">
                          Pedido #{pedidoSeleccionado.id_pedido}
                        </span>
                        <h3>{pedidoSeleccionado.cliente}</h3>
                        <p>
                          Estado actual: <strong>{pedidoSeleccionado.estado}</strong>
                        </p>
                      </div>

                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={cerrarDetalle}
                      >
                        Cerrar
                      </button>
                    </div>

                    <div className="resumen-recepcion">
                      <div>
                        <span>Recibidos</span>
                        <h4>{totalRecibidos}</h4>
                      </div>

                      <div>
                        <span>No vinieron</span>
                        <h4>{totalNoRecibidos}</h4>
                      </div>

                      <div>
                        <span>Pendientes</span>
                        <h4>{totalPendientes}</h4>
                      </div>

                      <div>
                        <span>Nuevo estado</span>
                        <h4>{calcularEstadoPedido()}</h4>
                      </div>
                    </div>

                    <div className="pagos-pedido-box mt-3">
                      <div className="pagos-header">
                        <div>
                          <h5>Anticipos y abonos</h5>
                          <p>
                            Puedes registrar varios pagos hasta completar el saldo del pedido.
                          </p>
                        </div>

                        <div className="pagos-resumen">
                          <span>Total: Q{Number(pedidoSeleccionado.total || 0).toFixed(2)}</span>
                          <span>Pagado: Q{totalPagadoPedido.toFixed(2)}</span>
                          <span>Saldo: Q{Number(pedidoSeleccionado.saldo_pendiente || 0).toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="row mt-3">
                        <div className="col-md-3 mb-3">
                          <label>Nuevo abono</label>
                          <input
                            type="number"
                            className="form-control"
                            name="monto"
                            min="0"
                            step="0.01"
                            value={nuevoPago.monto}
                            onChange={handleNuevoPagoChange}
                            placeholder="0.00"
                            disabled={Number(pedidoSeleccionado.saldo_pendiente || 0) <= 0}
                          />
                        </div>

                        <div className="col-md-3 mb-3">
                          <label>Método de pago</label>
                          <select
                            className="form-control"
                            name="metodo_pago"
                            value={nuevoPago.metodo_pago}
                            onChange={handleNuevoPagoChange}
                            disabled={Number(pedidoSeleccionado.saldo_pendiente || 0) <= 0}
                          >
                            <option value="EFECTIVO">Efectivo</option>
                            <option value="TRANSFERENCIA">Transferencia</option>
                            <option value="DEPOSITO">Depósito</option>
                            <option value="TARJETA">Tarjeta</option>
                            <option value="OTRO">Otro</option>
                          </select>
                        </div>

                        <div className="col-md-4 mb-3">
                          <label>Observación</label>
                          <input
                            type="text"
                            className="form-control"
                            name="observacion"
                            value={nuevoPago.observacion}
                            onChange={handleNuevoPagoChange}
                            placeholder="Ej. segundo anticipo, depósito, transferencia..."
                            disabled={Number(pedidoSeleccionado.saldo_pendiente || 0) <= 0}
                          />
                        </div>

                        <div className="col-md-2 mb-3 d-flex align-items-end">
                          <button
                            type="button"
                            className="btn btn-primary w-100"
                            onClick={registrarPago}
                            disabled={
                              guardandoPago ||
                              Number(pedidoSeleccionado.saldo_pendiente || 0) <= 0
                            }
                          >
                            {guardandoPago ? 'Guardando...' : 'Agregar'}
                          </button>
                        </div>
                      </div>

                      {Number(pedidoSeleccionado.saldo_pendiente || 0) <= 0 && (
                        <div className="alert alert-success mb-3">
                          Este pedido ya está pagado por completo.
                        </div>
                      )}

                      <div className="lista-pagos">
                        {pagosPedido.length === 0 ? (
                          <div className="sin-pagos">
                            No hay anticipos registrados para este pedido.
                          </div>
                        ) : (
                          pagosPedido.map((pago) => (
                            <div className="pago-item" key={pago.id_pago}>
                              <div>
                                <strong>Q{Number(pago.monto || 0).toFixed(2)}</strong>
                                <span>{pago.metodo_pago || 'EFECTIVO'}</span>
                              </div>

                              <div>
                                <span>
                                  {pago.fecha_pago
                                    ? new Date(pago.fecha_pago).toLocaleString('es-GT')
                                    : 'Sin fecha'}
                                </span>
                                <small>{pago.observacion || 'Sin observación'}</small>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="nota-recepcion">
                      <strong>Importante:</strong> si este cliente recibió todos sus productos,
                      el pedido quedará listo para entregar aunque a otros clientes les haya faltado mercadería.
                    </div>

                    {totalRecibidos > 0 && totalPendientes + totalNoRecibidos > 0 && (
                      <div className="opcion-parcial-box">
                        <h5>Este pedido vino parcial</h5>

                        <p>
                          El cliente tiene productos recibidos y productos faltantes.
                          Elige qué deseas hacer:
                        </p>

                        <div className="opciones-parcial">
                          <label className={accionParcial === 'ESPERAR' ? 'opcion-activa' : ''}>
                            <input
                              type="radio"
                              name="accionParcial"
                              value="ESPERAR"
                              checked={accionParcial === 'ESPERAR'}
                              onChange={(e) => setAccionParcial(e.target.value)}
                            />

                            <div>
                              <strong>Esperar el resto del pedido</strong>
                              <span>
                                El pedido queda como recibido parcial y no se entrega todavía.
                              </span>
                            </div>
                          </label>

                          <label className={accionParcial === 'ENTREGAR_RECIBIDO' ? 'opcion-activa' : ''}>
                            <input
                              type="radio"
                              name="accionParcial"
                              value="ENTREGAR_RECIBIDO"
                              checked={accionParcial === 'ENTREGAR_RECIBIDO'}
                              onChange={(e) => setAccionParcial(e.target.value)}
                            />

                            <div>
                              <strong>Entregar lo que sí vino</strong>
                              <span>
                                Este pedido queda listo para entregar y se crea otro pedido con lo faltante.
                              </span>
                            </div>
                          </label>
                        </div>
                      </div>
                    )}

                    <div className="acciones-recepcion">
                      <button
                        type="button"
                        className="btn btn-outline-primary"
                        onClick={marcarTodoRecibido}
                      >
                        Marcar todo como recibido
                      </button>

                      <button
                        type="button"
                        className="btn btn-outline-danger"
                        onClick={marcarTodoNoRecibido}
                      >
                        Marcar todo como no recibido
                      </button>

                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={marcarTodoPendiente}
                      >
                        Dejar todo pendiente
                      </button>
                    </div>

                    <div className="tabla-productos-recepcion">
                      {detallePedido.map((item, index) => (
                        <div className="producto-recepcion-card" key={item.id_detalle_pedido}>
                          <div className="producto-recepcion-info">
                            <span className="codigo-producto">
                              {item.codigo_producto}
                            </span>

                            <h5>{item.nombre_producto}</h5>

                            <p>{item.descripcion_producto || 'Sin descripción'}</p>

                            <div className="producto-recepcion-meta">
                              <span>Cantidad: {item.cantidad}</span>
                              <span>Precio: Q{Number(item.precio_unitario).toFixed(2)}</span>
                              <span>Subtotal: Q{Number(item.subtotal).toFixed(2)}</span>
                            </div>
                          </div>

                          <div className="producto-recepcion-estado">
                            <label>Estado del producto</label>

                            <select
                              className="form-control"
                              value={item.nuevo_estado}
                              onChange={(e) => cambiarEstadoProducto(index, e.target.value)}
                            >
                              <option value="PENDIENTE">Pendiente</option>
                              <option value="RECIBIDO">Vino</option>
                              <option value="NO_RECIBIDO">No vino</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="guardar-recepcion-box">
                      <button
                        type="button"
                        className="btn-guardar-recepcion"
                        onClick={guardarRecepcion}
                        disabled={guardando}
                      >
                        {guardando ? 'Guardando...' : 'Guardar recepción'}
                      </button>
                    </div>
                  </>
                )}
              </div>

            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default RecepcionPedidos;