import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AuthContext from './AuthContext';
import Sidebar from './sidebar';
import Navbar from './Navbar';
import './Pedidos.css';

const URL = process.env.REACT_APP_URL_BACKEND || 'http://localhost:3001';

function Pedidos() {
    const { token, logout, user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const mesaQuery = searchParams.get('mesa');

    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [pedidos, setPedidos] = useState([]);
    const [cargando, setCargando] = useState(false);

    const [filtros, setFiltros] = useState({
        estado: 'todos',
        buscar: '',
        fecha_inicio: '',
        fecha_fin: ''
    });

    const authToken = token || localStorage.getItem('token');

    const getConfig = () => ({
        headers: {
            Authorization: `Bearer ${authToken}`
        }
    });

    const puedeCancelar = ['ADMINISTRADOR', 'GERENTE', 'CAJA'].includes(user?.rol);
    const puedeEntregar = ['ADMINISTRADOR', 'GERENTE', 'CAJA', 'MESERO'].includes(user?.rol);
    const puedeCobrar = ['ADMINISTRADOR', 'GERENTE', 'CAJA'].includes(user?.rol);

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

            if (filtros.estado) params.append('estado', filtros.estado);
            if (filtros.buscar.trim()) params.append('buscar', filtros.buscar.trim());
            if (filtros.fecha_inicio) params.append('fecha_inicio', filtros.fecha_inicio);
            if (filtros.fecha_fin) params.append('fecha_fin', filtros.fecha_fin);

            const response = await axios.get(
                `${URL}/pedidos?${params.toString()}`,
                getConfig()
            );

            let datos = response.data || [];

            if (mesaQuery) {
                datos = datos.filter((pedido) => String(pedido.id_mesa) === String(mesaQuery));
            }

            setPedidos(datos);

        } catch (error) {
            console.error('Error cargando pedidos:', error);

            if (error.response?.status === 401 || error.response?.status === 403) {
                Swal.fire('Sesión vencida', 'Inicia sesión nuevamente', 'warning');
                logout();
                navigate('/login');
                return;
            }

            Swal.fire(
                'Error',
                error.response?.data?.mensaje || 'No se pudieron cargar los pedidos',
                'error'
            );

        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarPedidos();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mesaQuery]);

    const verDetalle = async (pedido) => {
        try {
            const response = await axios.get(
                `${URL}/pedidos/${pedido.id_pedido}`,
                getConfig()
            );

            const { pedido: pedidoInfo, detalle, pagos } = response.data;

            const detalleHtml = detalle.map((item) => `
        <tr>
          <td>${item.producto}</td>
          <td>${Number(item.cantidad)}</td>
          <td>Q${Number(item.precio_unitario || 0).toFixed(2)}</td>
          <td>Q${Number(item.subtotal || 0).toFixed(2)}</td>
          <td>${item.estado_cocina}</td>
        </tr>
      `).join('');

            const pagosHtml = pagos.length > 0
                ? pagos.map((pago) => `
          <tr>
            <td>${pago.metodo_pago}</td>
            <td>Q${Number(pago.monto || 0).toFixed(2)}</td>
            <td>${pago.referencia || ''}</td>
          </tr>
        `).join('')
                : `
          <tr>
            <td colspan="3">Sin pagos registrados</td>
          </tr>
        `;

            Swal.fire({
                title: `Pedido #${pedidoInfo.id_pedido}`,
                width: 850,
                html: `
          <div style="text-align:left">
            <p><strong>Estado:</strong> ${traducirEstado(pedidoInfo.estado)}</p>
            <p><strong>Tipo:</strong> ${traducirTipo(pedidoInfo.tipo_pedido)}</p>
            <p><strong>Mesa:</strong> ${pedidoInfo.numero_mesa || 'Sin mesa'}</p>
            <p><strong>Cliente:</strong> ${pedidoInfo.cliente_nombre || pedidoInfo.cliente_registrado || 'Consumidor final'}</p>
            <p><strong>Total:</strong> Q${Number(pedidoInfo.total || 0).toFixed(2)}</p>
            <p><strong>Saldo:</strong> Q${Number(pedidoInfo.saldo_pendiente || 0).toFixed(2)}</p>

            <hr />

            <h5>Detalle</h5>
            <table style="width:100%; border-collapse:collapse;">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cant.</th>
                  <th>Precio</th>
                  <th>Subtotal</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                ${detalleHtml}
              </tbody>
            </table>

            <hr />

            <h5>Pagos</h5>
            <table style="width:100%; border-collapse:collapse;">
              <thead>
                <tr>
                  <th>Método</th>
                  <th>Monto</th>
                  <th>Referencia</th>
                </tr>
              </thead>
              <tbody>
                ${pagosHtml}
              </tbody>
            </table>
          </div>
        `,
                confirmButtonText: 'Cerrar',
                confirmButtonColor: '#ea580c'
            });

        } catch (error) {
            console.error('Error viendo detalle:', error);

            Swal.fire(
                'Error',
                error.response?.data?.mensaje || 'No se pudo cargar el detalle',
                'error'
            );
        }
    };

    const entregarPedido = async (pedido) => {
        const result = await Swal.fire({
            title: '¿Marcar como entregado?',
            text: `Pedido #${pedido.id_pedido}`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, entregar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#ea580c',
            cancelButtonColor: '#6b7280'
        });

        if (!result.isConfirmed) return;

        try {
            await axios.patch(
                `${URL}/pedidos/${pedido.id_pedido}/entregar`,
                {},
                getConfig()
            );

            Swal.fire('Entregado', 'Pedido marcado como entregado', 'success');

            cargarPedidos();

        } catch (error) {
            console.error('Error entregando pedido:', error);

            Swal.fire(
                'Error',
                error.response?.data?.mensaje || 'No se pudo entregar el pedido',
                'error'
            );
        }
    };

    const cancelarPedido = async (pedido) => {
        const result = await Swal.fire({
            title: 'Cancelar pedido',
            input: 'textarea',
            inputLabel: `Motivo de cancelación del pedido #${pedido.id_pedido}`,
            inputPlaceholder: 'Escribe el motivo...',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Cancelar pedido',
            cancelButtonText: 'Volver',
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#6b7280'
        });

        if (!result.isConfirmed) return;

        try {
            await axios.patch(
                `${URL}/pedidos/${pedido.id_pedido}/cancelar`,
                { motivo: result.value || 'Sin motivo especificado' },
                getConfig()
            );

            Swal.fire('Cancelado', 'Pedido cancelado correctamente', 'success');

            cargarPedidos();

        } catch (error) {
            console.error('Error cancelando pedido:', error);

            Swal.fire(
                'Error',
                error.response?.data?.mensaje || 'No se pudo cancelar el pedido',
                'error'
            );
        }
    };

    const irACaja = (pedido) => {
        navigate(`/caja?pedido=${pedido.id_pedido}`);
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

    const agregarProductosPedido = async (pedido) => {
  try {
    const datosRes = await axios.get(`${URL}/nuevo-pedido/datos`, getConfig());
    const productosDisponibles = datosRes.data.productos || [];

    if (productosDisponibles.length === 0) {
      Swal.fire('Sin productos', 'No hay productos activos disponibles', 'warning');
      return;
    }

    let productosSeleccionados = [];

    const construirHtml = () => {
      const opcionesProductos = productosDisponibles
        .map((producto) => {
          return `
            <option value="${producto.id_producto}">
              ${producto.nombre} - Q${Number(producto.precio || 0).toFixed(2)}
            </option>
          `;
        })
        .join('');

      return `
        <div style="text-align:left">
          <label style="font-weight:700">Producto</label>
          <select id="swal-producto" class="swal2-input" style="width:90%">
            ${opcionesProductos}
          </select>

          <label style="font-weight:700">Cantidad</label>
          <input id="swal-cantidad" type="number" min="1" value="1" class="swal2-input" style="width:90%">

          <label style="font-weight:700">Observaciones</label>
          <input id="swal-observaciones" type="text" class="swal2-input" style="width:90%" placeholder="Ej. Sin cebolla">

          <hr />

          <div id="lista-productos-agregados">
            ${
              productosSeleccionados.length === 0
                ? '<p style="color:#6b7280">Todavía no has agregado productos.</p>'
                : productosSeleccionados.map((item, index) => `
                    <div style="
                      padding:8px;
                      border:1px solid #e5e7eb;
                      border-radius:8px;
                      margin-bottom:6px;
                      display:flex;
                      justify-content:space-between;
                      gap:8px;
                    ">
                      <span>
                        <strong>${item.nombre}</strong><br>
                        Cantidad: ${item.cantidad} | Q${Number(item.subtotal || 0).toFixed(2)}
                        ${item.observaciones ? `<br><small>${item.observaciones}</small>` : ''}
                      </span>

                      <button
                        type="button"
                        onclick="window.eliminarProductoAgregado(${index})"
                        style="
                          border:none;
                          background:#dc2626;
                          color:white;
                          padding:5px 8px;
                          border-radius:6px;
                          height:32px;
                        "
                      >
                        X
                      </button>
                    </div>
                  `).join('')
            }
          </div>
        </div>
      `;
    };

    window.eliminarProductoAgregado = (index) => {
      productosSeleccionados.splice(index, 1);
      Swal.update({
        html: construirHtml()
      });
    };

    const result = await Swal.fire({
      title: `Agregar productos al pedido #${pedido.id_pedido}`,
      width: 800,
      html: construirHtml(),
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'Guardar en pedido',
      denyButtonText: 'Agregar a lista',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#16a34a',
      denyButtonColor: '#ea580c',
      cancelButtonColor: '#6b7280',
      allowOutsideClick: false,
      preDeny: () => {
        const idProducto = Number(document.getElementById('swal-producto').value);
        const cantidad = Number(document.getElementById('swal-cantidad').value || 0);
        const observaciones = document.getElementById('swal-observaciones').value || '';

        const producto = productosDisponibles.find(
          (item) => Number(item.id_producto) === Number(idProducto)
        );

        if (!producto) {
          Swal.showValidationMessage('Selecciona un producto válido');
          return false;
        }

        if (cantidad <= 0) {
          Swal.showValidationMessage('La cantidad debe ser mayor a 0');
          return false;
        }

        productosSeleccionados.push({
          id_producto: producto.id_producto,
          nombre: producto.nombre,
          cantidad,
          precio_unitario: Number(producto.precio || 0),
          subtotal: Number(producto.precio || 0) * cantidad,
          observaciones
        });

        Swal.update({
          html: construirHtml()
        });

        return false;
      },
      preConfirm: () => {
        if (productosSeleccionados.length === 0) {
          Swal.showValidationMessage('Agrega al menos un producto a la lista');
          return false;
        }

        return productosSeleccionados;
      }
    });

    delete window.eliminarProductoAgregado;

    if (!result.isConfirmed) return;

    await axios.post(
      `${URL}/pedidos/${pedido.id_pedido}/agregar-productos`,
      {
        productos: result.value
      },
      getConfig()
    );

    Swal.fire(
      'Agregado',
      'Los productos fueron agregados correctamente al pedido',
      'success'
    );

    cargarPedidos();

  } catch (error) {
    console.error('Error agregando productos:', error);

    Swal.fire(
      'Error',
      error.response?.data?.mensaje || 'No se pudieron agregar los productos',
      'error'
    );
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

                    <div className="container-fluid pedidos-container">

                        <div className="pedidos-header mt-4">
                            <div>
                                <span className="pedidos-badge">Restaurante</span>
                                <h2>Pedidos</h2>
                                <p>
                                    Consulta los pedidos del restaurante, revisa detalles, entrega,
                                    cancela o envía a caja para cobrar.
                                </p>
                            </div>

                            <button
                                type="button"
                                className="btn btn-pedidos-refresh"
                                onClick={cargarPedidos}
                                disabled={cargando}
                            >
                                {cargando ? 'Actualizando...' : 'Actualizar'}
                            </button>
                        </div>

                        <div className="pedidos-filtros mt-4">
                            <div>
                                <label>Estado</label>
                                <select
                                    className="form-control"
                                    value={filtros.estado}
                                    onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
                                >
                                    <option value="todos">Todos</option>
                                    <option value="en_cocina">En cocina</option>
                                    <option value="preparando">Preparando</option>
                                    <option value="listo">Listo</option>
                                    <option value="entregado">Entregado</option>
                                    <option value="pagado">Pagado</option>
                                    <option value="cancelado">Cancelado</option>
                                </select>
                            </div>

                            <div>
                                <label>Fecha inicio</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    value={filtros.fecha_inicio}
                                    onChange={(e) => setFiltros({ ...filtros, fecha_inicio: e.target.value })}
                                />
                            </div>

                            <div>
                                <label>Fecha fin</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    value={filtros.fecha_fin}
                                    onChange={(e) => setFiltros({ ...filtros, fecha_fin: e.target.value })}
                                />
                            </div>

                            <div>
                                <label>Buscar</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={filtros.buscar}
                                    onChange={(e) => setFiltros({ ...filtros, buscar: e.target.value })}
                                    placeholder="Pedido, cliente o mesa"
                                />
                            </div>

                            <div className="d-flex align-items-end">
                                <button
                                    type="button"
                                    className="btn btn-pedidos-save"
                                    onClick={cargarPedidos}
                                >
                                    Filtrar
                                </button>
                            </div>
                        </div>

                        <div className="pedidos-lista mt-4">
                            {cargando && pedidos.length === 0 && (
                                <div className="pedidos-empty">
                                    Cargando pedidos...
                                </div>
                            )}

                            {!cargando && pedidos.length === 0 && (
                                <div className="pedidos-empty">
                                    No hay pedidos registrados.
                                </div>
                            )}

                            {pedidos.map((pedido) => (
                                <div
                                    key={pedido.id_pedido}
                                    className={`pedido-card pedido-${pedido.estado}`}
                                >
                                    <div className="pedido-main">
                                        <div>
                                            <span className="pedido-label">Pedido</span>
                                            <h3>#{pedido.id_pedido}</h3>
                                        </div>

                                        <span className={`pedido-estado estado-${pedido.estado}`}>
                                            {traducirEstado(pedido.estado)}
                                        </span>
                                    </div>

                                    <div className="pedido-info-grid">
                                        <div>
                                            <span>Tipo</span>
                                            <strong>{traducirTipo(pedido.tipo_pedido)}</strong>
                                        </div>

                                        <div>
                                            <span>Mesa</span>
                                            <strong>{pedido.numero_mesa ? `Mesa ${pedido.numero_mesa}` : 'Sin mesa'}</strong>
                                        </div>

                                        <div>
                                            <span>Cliente</span>
                                            <strong>{pedido.cliente_nombre || pedido.cliente_registrado || 'Consumidor final'}</strong>
                                        </div>

                                        <div>
                                            <span>Fecha</span>
                                            <strong>{formatearFecha(pedido.fecha_pedido)}</strong>
                                        </div>

                                        <div>
                                            <span>Total</span>
                                            <strong>{formatearMoneda(pedido.total)}</strong>
                                        </div>

                                        <div>
                                            <span>Saldo</span>
                                            <strong>{formatearMoneda(pedido.saldo_pendiente)}</strong>
                                        </div>
                                    </div>

                                    {pedido.observaciones && (
                                        <div className="pedido-observaciones">
                                            {pedido.observaciones}
                                        </div>
                                    )}

                                    <div className="pedido-actions">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-primary"
                                            onClick={() => verDetalle(pedido)}
                                        >
                                            Ver detalle
                                        </button>

                                        {puedeEntregar && ['listo', 'preparando', 'en_cocina'].includes(pedido.estado) && (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-success"
                                                onClick={() => entregarPedido(pedido)}
                                            >
                                                Entregar
                                            </button>
                                        )}

                                        {puedeCobrar && ['listo', 'entregado'].includes(pedido.estado) && (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-warning"
                                                onClick={() => irACaja(pedido)}
                                            >
                                                Cobrar
                                            </button>
                                        )}

                                        {puedeCancelar && !['pagado', 'cancelado'].includes(pedido.estado) && (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-danger"
                                                onClick={() => cancelarPedido(pedido)}
                                            >
                                                Cancelar
                                            </button>
                                        )}

                                        {['abierto', 'en_cocina', 'preparando', 'listo', 'entregado'].includes(pedido.estado) && (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-success"
                                                onClick={() => agregarProductosPedido(pedido)}
                                            >
                                                Agregar productos
                                            </button>
                                        )}

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

export default Pedidos;