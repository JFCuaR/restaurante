import React, { useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AuthContext from './AuthContext';
import Sidebar from './sidebar';
import Navbar from './Navbar';
import './NuevoPedido.css';

const URL = process.env.REACT_APP_URL_BACKEND || 'http://localhost:3001';

function NuevoPedido() {
  const { token, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const mesaDesdeUrl = searchParams.get('mesa');

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [cargando, setCargando] = useState(false);

  const [mesas, setMesas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);

  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const [pedido, setPedido] = useState({
    tipo_pedido: mesaDesdeUrl ? 'mesa' : 'mesa',
    id_mesa: mesaDesdeUrl || '',
    cliente_nombre: '',
    cliente_telefono: '',
    direccion_delivery: '',
    descuento: 0,
    propina: 0,
    observaciones: ''
  });

  const [detalle, setDetalle] = useState([]);

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

  const cargarDatos = async () => {
    try {
      setCargando(true);

      const response = await axios.get(`${URL}/nuevo-pedido/datos`, getConfig());

      setMesas(response.data.mesas || []);
      setCategorias(response.data.categorias || []);
      setProductos(response.data.productos || []);

    } catch (error) {
      console.error('Error cargando datos:', error);

      if (error.response?.status === 401 || error.response?.status === 403) {
        Swal.fire('Sesión vencida', 'Inicia sesión nuevamente', 'warning');
        logout();
        navigate('/login');
        return;
      }

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudieron cargar los datos del pedido',
        'error'
      );

    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePedidoChange = (e) => {
    const { name, value } = e.target;

    setPedido({
      ...pedido,
      [name]: value
    });
  };

  const productosFiltrados = productos.filter((producto) => {
    const coincideCategoria = categoriaSeleccionada
      ? Number(producto.id_categoria) === Number(categoriaSeleccionada)
      : true;

    const texto = `${producto.nombre || ''} ${producto.categoria || ''} ${producto.descripcion || ''}`.toLowerCase();
    const coincideBusqueda = texto.includes(busqueda.toLowerCase());

    return coincideCategoria && coincideBusqueda;
  });

  const agregarProducto = (producto) => {
    const existe = detalle.find((item) => item.id_producto === producto.id_producto);

    if (existe) {
      setDetalle(detalle.map((item) => (
        item.id_producto === producto.id_producto
          ? {
              ...item,
              cantidad: Number(item.cantidad) + 1,
              subtotal: (Number(item.cantidad) + 1) * Number(item.precio_unitario)
            }
          : item
      )));
      return;
    }

    setDetalle([
      ...detalle,
      {
        id_producto: producto.id_producto,
        nombre: producto.nombre,
        cantidad: 1,
        precio_unitario: Number(producto.precio),
        subtotal: Number(producto.precio),
        observaciones: ''
      }
    ]);
  };

  const cambiarCantidad = (idProducto, cantidad) => {
    const cantidadFinal = Number(cantidad);

    if (cantidadFinal <= 0) {
      quitarProducto(idProducto);
      return;
    }

    setDetalle(detalle.map((item) => (
      item.id_producto === idProducto
        ? {
            ...item,
            cantidad: cantidadFinal,
            subtotal: cantidadFinal * Number(item.precio_unitario)
          }
        : item
    )));
  };

  const cambiarObservacionDetalle = (idProducto, observaciones) => {
    setDetalle(detalle.map((item) => (
      item.id_producto === idProducto
        ? {
            ...item,
            observaciones
          }
        : item
    )));
  };

  const quitarProducto = (idProducto) => {
    setDetalle(detalle.filter((item) => item.id_producto !== idProducto));
  };

  const subtotal = useMemo(() => {
    return detalle.reduce((acc, item) => acc + Number(item.subtotal || 0), 0);
  }, [detalle]);

  const descuento = Number(pedido.descuento || 0);
  const propina = Number(pedido.propina || 0);
  const total = subtotal - descuento + propina;

  const formatearMoneda = (valor) => {
    return `Q${Number(valor || 0).toFixed(2)}`;
  };

  const guardarPedido = async () => {
    if (pedido.tipo_pedido === 'mesa' && !pedido.id_mesa) {
      Swal.fire('Mesa requerida', 'Selecciona una mesa para el pedido', 'warning');
      return;
    }

    if (pedido.tipo_pedido === 'delivery' && !pedido.direccion_delivery.trim()) {
      Swal.fire('Dirección requerida', 'Ingresa la dirección del delivery', 'warning');
      return;
    }

    if (detalle.length === 0) {
      Swal.fire('Sin productos', 'Agrega al menos un producto al pedido', 'warning');
      return;
    }

    if (total < 0) {
      Swal.fire('Total inválido', 'El total no puede ser negativo', 'warning');
      return;
    }

    const result = await Swal.fire({
      title: '¿Crear pedido?',
      text: `Total del pedido: ${formatearMoneda(total)}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, crear pedido',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ea580c',
      cancelButtonColor: '#6b7280'
    });

    if (!result.isConfirmed) return;

    try {
      setCargando(true);

      const datos = {
        ...pedido,
        descuento,
        propina,
        productos: detalle.map((item) => ({
          id_producto: item.id_producto,
          cantidad: Number(item.cantidad),
          observaciones: item.observaciones || null
        }))
      };

      const response = await axios.post(`${URL}/pedidos`, datos, getConfig());

      Swal.fire(
        'Pedido creado',
        response.data.mensaje || 'Pedido enviado a cocina correctamente',
        'success'
      );

      navigate('/cocina');

    } catch (error) {
      console.error('Error creando pedido:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo crear el pedido',
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

          <div className="container-fluid nuevo-pedido-container">

            <div className="nuevo-pedido-header mt-4">
              <div>
                <span className="nuevo-pedido-badge">Pedidos</span>
                <h2>Nuevo pedido</h2>
                <p>
                  Selecciona mesa, productos del menú y envía el pedido a cocina.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-nuevo-refresh"
                onClick={cargarDatos}
                disabled={cargando}
              >
                {cargando ? 'Actualizando...' : 'Actualizar menú'}
              </button>
            </div>

            <div className="nuevo-pedido-layout mt-4">

              <section className="pedido-panel">
                <h4>Datos del pedido</h4>

                <div className="row">
                  <div className="col-md-4 mb-3">
                    <label>Tipo de pedido</label>
                    <select
                      name="tipo_pedido"
                      className="form-control"
                      value={pedido.tipo_pedido}
                      onChange={(e) => {
                        const value = e.target.value;

                        setPedido({
                          ...pedido,
                          tipo_pedido: value,
                          id_mesa: value === 'mesa' ? pedido.id_mesa : '',
                          direccion_delivery: value === 'delivery' ? pedido.direccion_delivery : ''
                        });
                      }}
                    >
                      <option value="mesa">Mesa</option>
                      <option value="para_llevar">Para llevar</option>
                      <option value="delivery">Delivery</option>
                    </select>
                  </div>

                  {pedido.tipo_pedido === 'mesa' && (
                    <div className="col-md-4 mb-3">
                      <label>Mesa</label>
                      <select
                        name="id_mesa"
                        className="form-control"
                        value={pedido.id_mesa}
                        onChange={handlePedidoChange}
                      >
                        <option value="">Selecciona mesa</option>
                        {mesas
                          .filter((mesa) => mesa.estado !== 'ocupada' || String(mesa.id_mesa) === String(pedido.id_mesa))
                          .map((mesa) => (
                            <option key={mesa.id_mesa} value={mesa.id_mesa}>
                              Mesa {mesa.numero_mesa} - {mesa.estado}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  <div className="col-md-4 mb-3">
                    <label>Cliente</label>
                    <input
                      type="text"
                      name="cliente_nombre"
                      className="form-control"
                      value={pedido.cliente_nombre}
                      onChange={handlePedidoChange}
                      placeholder="Consumidor final"
                    />
                  </div>

                  <div className="col-md-4 mb-3">
                    <label>Teléfono</label>
                    <input
                      type="text"
                      name="cliente_telefono"
                      className="form-control"
                      value={pedido.cliente_telefono}
                      onChange={handlePedidoChange}
                      placeholder="Teléfono del cliente"
                    />
                  </div>

                  {pedido.tipo_pedido === 'delivery' && (
                    <div className="col-md-8 mb-3">
                      <label>Dirección delivery *</label>
                      <input
                        type="text"
                        name="direccion_delivery"
                        className="form-control"
                        value={pedido.direccion_delivery}
                        onChange={handlePedidoChange}
                        placeholder="Dirección de entrega"
                      />
                    </div>
                  )}

                  <div className="col-md-12 mb-3">
                    <label>Observaciones generales</label>
                    <input
                      type="text"
                      name="observaciones"
                      className="form-control"
                      value={pedido.observaciones}
                      onChange={handlePedidoChange}
                      placeholder="Ej. Cliente espera en mesa, sin picante, etc."
                    />
                  </div>
                </div>
              </section>

              <section className="pedido-panel">
                <div className="pedido-panel-title">
                  <h4>Menú</h4>

                  <input
                    type="text"
                    className="form-control buscar-producto"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar producto..."
                  />
                </div>

                <div className="categorias-filtro">
                  <button
                    type="button"
                    className={!categoriaSeleccionada ? 'activo' : ''}
                    onClick={() => setCategoriaSeleccionada('')}
                  >
                    Todos
                  </button>

                  {categorias.map((categoria) => (
                    <button
                      key={categoria.id_categoria}
                      type="button"
                      className={String(categoriaSeleccionada) === String(categoria.id_categoria) ? 'activo' : ''}
                      onClick={() => setCategoriaSeleccionada(categoria.id_categoria)}
                    >
                      {categoria.nombre}
                    </button>
                  ))}
                </div>

                <div className="productos-menu-grid">
                  {productosFiltrados.map((producto) => (
                    <div
                      key={producto.id_producto}
                      className="producto-menu-card"
                      onClick={() => agregarProducto(producto)}
                    >
                      <span>{producto.categoria || 'Sin categoría'}</span>
                      <h5>{producto.nombre}</h5>
                      <p>{producto.descripcion || 'Sin descripción'}</p>
                      <strong>{formatearMoneda(producto.precio)}</strong>
                    </div>
                  ))}

                  {!cargando && productosFiltrados.length === 0 && (
                    <div className="menu-empty">
                      No hay productos disponibles.
                    </div>
                  )}
                </div>
              </section>

              <section className="pedido-panel pedido-resumen">
                <h4>Detalle del pedido</h4>

                {detalle.length === 0 && (
                  <div className="detalle-empty">
                    Agrega productos del menú al pedido.
                  </div>
                )}

                {detalle.map((item) => (
                  <div key={item.id_producto} className="detalle-item">
                    <div className="detalle-info">
                      <h5>{item.nombre}</h5>
                      <span>{formatearMoneda(item.precio_unitario)}</span>
                    </div>

                    <div className="detalle-cantidad">
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(item.id_producto, Number(item.cantidad) - 1)}
                      >
                        -
                      </button>

                      <input
                        type="number"
                        min="1"
                        value={item.cantidad}
                        onChange={(e) => cambiarCantidad(item.id_producto, e.target.value)}
                      />

                      <button
                        type="button"
                        onClick={() => cambiarCantidad(item.id_producto, Number(item.cantidad) + 1)}
                      >
                        +
                      </button>
                    </div>

                    <input
                      type="text"
                      className="form-control detalle-observacion"
                      value={item.observaciones}
                      onChange={(e) => cambiarObservacionDetalle(item.id_producto, e.target.value)}
                      placeholder="Observación del producto"
                    />

                    <div className="detalle-footer">
                      <strong>{formatearMoneda(item.subtotal)}</strong>

                      <button
                        type="button"
                        onClick={() => quitarProducto(item.id_producto)}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ))}

                <div className="totales-box">
                  <div>
                    <span>Subtotal</span>
                    <strong>{formatearMoneda(subtotal)}</strong>
                  </div>

                  <div>
                    <span>Descuento</span>
                    <input
                      type="number"
                      name="descuento"
                      value={pedido.descuento}
                      onChange={handlePedidoChange}
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div>
                    <span>Propina</span>
                    <input
                      type="number"
                      name="propina"
                      value={pedido.propina}
                      onChange={handlePedidoChange}
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div className="total-final">
                    <span>Total</span>
                    <strong>{formatearMoneda(total)}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-crear-pedido"
                  onClick={guardarPedido}
                  disabled={cargando}
                >
                  {cargando ? 'Creando pedido...' : 'Crear pedido y enviar a cocina'}
                </button>
              </section>

            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default NuevoPedido;