import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

import AuthContext from './AuthContext';
import Sidebar from './sidebar';
import Navbar from './Navbar';
import './GestionPedidos.css';

const URL = process.env.REACT_APP_URL_BACKEND || 'http://localhost:3001';

function GestionPedidos() {
  const { logout, token } = useContext(AuthContext);

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(false);

  const [mesSeleccionado, setMesSeleccionado] = useState(() => {
    const fecha = new Date();
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
  });

  const [buscar, setBuscar] = useState('');
  const [estadosSeleccionados, setEstadosSeleccionados] = useState(['PENDIENTE']);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [pedidoEditando, setPedidoEditando] = useState(null);
  const [productosEditando, setProductosEditando] = useState([]);
  const [guardando, setGuardando] = useState(false);

  const authToken = token || localStorage.getItem('token');

  const configAxios = {
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  };

  const opcionesEstado = [
    { value: 'PENDIENTE', label: 'Pendiente' },
    { value: 'SOLICITADO', label: 'Solicitado' },
    { value: 'EN_CAMINO', label: 'En camino' },
    { value: 'RECIBIDO_PARCIAL', label: 'Vino parcial' },
    { value: 'RECIBIDO_COMPLETO', label: 'Vino completo' },
    { value: 'LISTO_PARA_ENTREGAR', label: 'Listo para entregar' },
    { value: 'ENTREGADO', label: 'Entregado' },
    { value: 'CANCELADO', label: 'Cancelado' }
  ];

  const toggleSidebar = () => {
    setSidebarOpen(!isSidebarOpen);
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return 'Sin fecha';

    const fechaObj = new Date(fecha);

    if (Number.isNaN(fechaObj.getTime())) return 'Sin fecha';

    return fechaObj.toLocaleDateString('es-GT');
  };

  const toggleEstadoSeleccionado = (estadoValue) => {
    if (estadosSeleccionados.includes(estadoValue)) {
      setEstadosSeleccionados(
        estadosSeleccionados.filter((item) => item !== estadoValue)
      );
    } else {
      setEstadosSeleccionados([...estadosSeleccionados, estadoValue]);
    }
  };

  const seleccionarTodosEstados = () => {
    setEstadosSeleccionados(opcionesEstado.map((item) => item.value));
  };

  const limpiarEstados = () => {
    setEstadosSeleccionados([]);
  };

  const cargarPedidos = async () => {
    try {
      setCargando(true);

      const response = await axios.get(`${URL}/pedidos/gestion`, {
        ...configAxios,
        params: {
          mes: mesSeleccionado,
          buscar,
          estados: estadosSeleccionados.join(',')
        }
      });

      setPedidos(response.data);
    } catch (error) {
      console.error('Error al cargar pedidos:', error);

      if (error.response?.status === 401 || error.response?.status === 403) {
        Swal.fire('Sesión expirada', 'Inicia sesión nuevamente.', 'warning');
        logout();
        window.location.href = '/login';
        return;
      }

      Swal.fire(
        'Error',
        error.response?.data?.error ||
          error.response?.data?.mensaje ||
          'No se pudieron cargar los pedidos.',
        'error'
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarPedidos();
    }, 350);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesSeleccionado, buscar, estadosSeleccionados]);

  const abrirEditarPedido = async (idPedido) => {
    try {
      const response = await axios.get(
        `${URL}/pedidos/${idPedido}/detalle-gestion`,
        configAxios
      );

      const { pedido, productos } = response.data;

      setPedidoEditando({
        id_pedido: pedido.id_pedido,
        cliente: pedido.cliente_nombre,
        telefono: pedido.cliente_telefono,
        fechaEstimada: pedido.fecha_estimada_llegada
          ? pedido.fecha_estimada_llegada.substring(0, 10)
          : '',
        anticipo: Number(pedido.anticipo || 0),
        metodo_pago: pedido.metodo_pago || 'EFECTIVO',
        observacion_pago: pedido.observacion_pago || '',
        observaciones: pedido.observaciones || '',
        estado: pedido.estado
      });

      setProductosEditando(
        productos.map((p) => ({
          codigo: p.codigo || '',
          producto: p.producto || '',
          descripcion: p.descripcion || '',
          cantidad: Number(p.cantidad || 1),
          monedaCompra: p.monedaCompra || 'GTQ',
          monedaVenta: p.monedaVenta || 'GTQ',
          precioCompra: Number(p.precioCompra || 0),
          precioVenta: Number(p.precioVenta || 0),
          tipoCambioCompra: Number(p.tipoCambioCompra || 1),
          tipoCambioVenta: Number(p.tipoCambioVenta || 1)
        }))
      );

      setModalAbierto(true);
    } catch (error) {
      console.error('Error al abrir pedido:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo abrir el pedido.',
        'error'
      );
    }
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setPedidoEditando(null);
    setProductosEditando([]);
  };

  const handlePedidoEditandoChange = (e) => {
    const { name, value } = e.target;

    setPedidoEditando({
      ...pedidoEditando,
      [name]: value
    });
  };

  const handleProductoEditandoChange = (index, e) => {
    const { name, value } = e.target;
    const nuevosProductos = [...productosEditando];

    if (
      name === 'cantidad' ||
      name === 'precioCompra' ||
      name === 'precioVenta' ||
      name === 'tipoCambioCompra' ||
      name === 'tipoCambioVenta'
    ) {
      nuevosProductos[index][name] = Number(value);
    } else {
      nuevosProductos[index][name] = value;
    }

    setProductosEditando(nuevosProductos);
  };

  const agregarProducto = () => {
    setProductosEditando([
      ...productosEditando,
      {
        codigo: '',
        producto: '',
        descripcion: '',
        cantidad: 1,
        monedaCompra: 'MXN',
        monedaVenta: 'GTQ',
        precioCompra: 0,
        precioVenta: 0,
        tipoCambioCompra: 0.43,
        tipoCambioVenta: 1
      }
    ]);
  };

  const eliminarProducto = (index) => {
    if (productosEditando.length === 1) {
      Swal.fire('Aviso', 'El pedido debe tener al menos un producto.', 'info');
      return;
    }

    const nuevosProductos = productosEditando.filter((_, i) => i !== index);
    setProductosEditando(nuevosProductos);
  };

  const calcularSubtotalVenta = (item) => {
    return (
      Number(item.cantidad || 0) *
      Number(item.precioVenta || 0) *
      Number(item.tipoCambioVenta || 1)
    );
  };

  const calcularSubtotalCompra = (item) => {
    return (
      Number(item.cantidad || 0) *
      Number(item.precioCompra || 0) *
      Number(item.tipoCambioCompra || 1)
    );
  };

  const totalVenta = productosEditando.reduce((total, item) => {
    return total + calcularSubtotalVenta(item);
  }, 0);

  const totalCompra = productosEditando.reduce((total, item) => {
    return total + calcularSubtotalCompra(item);
  }, 0);

  const ganancia = totalVenta - totalCompra;
  const saldoPendiente = totalVenta - Number(pedidoEditando?.anticipo || 0);

  const validarEdicion = () => {
    if (!pedidoEditando) return false;

    if (productosEditando.length === 0) {
      Swal.fire('Validación', 'Debes agregar al menos un producto.', 'warning');
      return false;
    }

    for (let i = 0; i < productosEditando.length; i++) {
      const item = productosEditando[i];

      if (!item.codigo.trim()) {
        Swal.fire('Validación', `El producto #${i + 1} no tiene código.`, 'warning');
        return false;
      }

      if (!item.producto.trim()) {
        Swal.fire('Validación', `El producto #${i + 1} no tiene nombre.`, 'warning');
        return false;
      }

      if (Number(item.cantidad) <= 0) {
        Swal.fire('Validación', `El producto #${i + 1} debe tener cantidad válida.`, 'warning');
        return false;
      }

      if (Number(item.precioVenta) <= 0) {
        Swal.fire('Validación', `El producto #${i + 1} debe tener precio de venta mayor a 0.`, 'warning');
        return false;
      }
    }

    if (Number(pedidoEditando.anticipo || 0) > totalVenta) {
      Swal.fire('Validación', 'El anticipo no puede ser mayor al total del pedido.', 'warning');
      return false;
    }

    return true;
  };

  const guardarCambiosPedido = async () => {
    if (!validarEdicion()) return;

    try {
      setGuardando(true);

      await axios.put(
        `${URL}/pedidos/${pedidoEditando.id_pedido}/gestion`,
        {
          fechaEstimada: pedidoEditando.fechaEstimada || null,
          anticipo: Number(pedidoEditando.anticipo || 0),
          metodo_pago: pedidoEditando.metodo_pago,
          observacion_pago: pedidoEditando.observacion_pago,
          observaciones: pedidoEditando.observaciones,
          productos: productosEditando
        },
        configAxios
      );

      Swal.fire('Correcto', 'Pedido actualizado correctamente.', 'success');

      cerrarModal();
      cargarPedidos();
    } catch (error) {
      console.error('Error al guardar cambios:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo actualizar el pedido.',
        'error'
      );
    } finally {
      setGuardando(false);
    }
  };

  const cancelarPedido = async (pedido) => {
    const result = await Swal.fire({
      title: `¿Cancelar pedido #${pedido.id_pedido}?`,
      input: 'textarea',
      inputLabel: 'Motivo de cancelación',
      inputPlaceholder: 'Ej. El cliente ya no quiere el pedido...',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar pedido',
      cancelButtonText: 'No cancelar',
      confirmButtonColor: '#dc3545',
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return 'Debes escribir un motivo de cancelación';
        }

        return null;
      }
    });

    if (!result.isConfirmed) return;

    try {
      await axios.put(
        `${URL}/pedidos/${pedido.id_pedido}/cancelar`,
        {
          motivo_cancelacion: result.value
        },
        configAxios
      );

      Swal.fire('Cancelado', 'El pedido fue cancelado correctamente.', 'success');
      cargarPedidos();
    } catch (error) {
      console.error('Error al cancelar pedido:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo cancelar el pedido.',
        'error'
      );
    }
  };

  const claseEstado = (estadoPedido) => {
    switch (estadoPedido) {
      case 'PENDIENTE':
        return 'estado pendiente';
      case 'SOLICITADO':
        return 'estado solicitado';
      case 'EN_CAMINO':
        return 'estado camino';
      case 'RECIBIDO_PARCIAL':
        return 'estado parcial';
      case 'RECIBIDO_TOTAL':
      case 'RECIBIDO_COMPLETO':
        return 'estado recibido';
      case 'LISTO_ENTREGA':
      case 'LISTO_PARA_ENTREGAR':
        return 'estado listo';
      case 'ENTREGADO':
        return 'estado entregado';
      case 'CANCELADO':
        return 'estado cancelado';
      default:
        return 'estado';
    }
  };

  const cargarDatosReporte = async () => {
    const response = await axios.get(`${URL}/pedidos/gestion/reporte`, {
      ...configAxios,
      params: {
        mes: mesSeleccionado,
        buscar,
        estados: estadosSeleccionados.join(',')
      }
    });

    return response.data;
  };

  const descargarReportePDF = async () => {
    try {
      const datos = await cargarDatosReporte();

      if (!datos || datos.length === 0) {
        Swal.fire('Sin datos', 'No hay pedidos para generar el reporte.', 'info');
        return;
      }

      const doc = new jsPDF('landscape', 'mm', 'letter');

      doc.setFontSize(16);
      doc.text('Reporte de pedidos para compra', 14, 15);

      doc.setFontSize(10);
      doc.text(`Mes: ${mesSeleccionado || 'Todos'}`, 14, 22);
      doc.text(
        `Estados: ${estadosSeleccionados.length > 0 ? estadosSeleccionados.join(', ') : 'Todos'}`,
        14,
        27
      );
      doc.text(`Búsqueda: ${buscar || 'Sin filtro'}`, 14, 32);
      doc.text(`Generado: ${new Date().toLocaleString('es-GT')}`, 14, 37);

      const filas = datos.map((item) => [
        `#${item.id_pedido}`,
        formatearFecha(item.fecha_pedido),
        item.cliente || '',
        item.telefono || '',
        `${item.municipio || ''}, ${item.departamento || ''}`,
        item.codigo_producto || '',
        item.nombre_producto || '',
        item.descripcion_producto || '',
        item.cantidad || 0,
        item.moneda_compra || '',
        Number(item.precio_compra || 0).toFixed(2),
        item.moneda_venta || '',
        Number(item.precio_venta || 0).toFixed(2),
        `Q${Number(item.subtotal_venta_gtq || 0).toFixed(2)}`,
        item.estado || ''
      ]);

      autoTable(doc, {
        startY: 43,
        head: [[
          'Pedido',
          'Fecha',
          'Cliente',
          'Teléfono',
          'Ubicación',
          'Código',
          'Producto',
          'Descripción',
          'Cant.',
          'M. compra',
          'P. compra',
          'M. venta',
          'P. venta',
          'Subtotal',
          'Estado'
        ]],
        body: filas,
        styles: {
          fontSize: 7,
          cellPadding: 2
        },
        headStyles: {
          fillColor: [30, 58, 138],
          textColor: 255
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250]
        },
        margin: {
          left: 8,
          right: 8
        }
      });

      const totalVentaReporte = datos.reduce((total, item) => {
        return total + Number(item.subtotal_venta_gtq || 0);
      }, 0);

      const totalCompraReporte = datos.reduce((total, item) => {
        return total + Number(item.subtotal_compra_gtq || 0);
      }, 0);

      const totalGananciaReporte = datos.reduce((total, item) => {
        return total + Number(item.ganancia_estimada_gtq || 0);
      }, 0);

      const finalY = doc.lastAutoTable.finalY + 8;

      doc.setFontSize(10);
      doc.text(`Total compra estimada: Q${totalCompraReporte.toFixed(2)}`, 14, finalY);
      doc.text(`Total venta estimada: Q${totalVentaReporte.toFixed(2)}`, 14, finalY + 6);
      doc.text(`Ganancia estimada: Q${totalGananciaReporte.toFixed(2)}`, 14, finalY + 12);

      doc.save(`reporte_pedidos_${mesSeleccionado}.pdf`);
    } catch (error) {
      console.error('Error al generar PDF:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo generar el PDF.',
        'error'
      );
    }
  };

  const descargarReporteExcel = async () => {
    try {
      const datos = await cargarDatosReporte();

      if (!datos || datos.length === 0) {
        Swal.fire('Sin datos', 'No hay pedidos para generar el reporte.', 'info');
        return;
      }

      const filasExcel = datos.map((item) => ({
        'No. Pedido': item.id_pedido,
        'Fecha Pedido': formatearFecha(item.fecha_pedido),
        'Fecha Estimada Llegada': formatearFecha(item.fecha_estimada_llegada),
        Cliente: item.cliente || '',
        Teléfono: item.telefono || '',
        Dirección: item.direccion || '',
        Departamento: item.departamento || '',
        Municipio: item.municipio || '',
        Referencia: item.referencia || '',
        'Código Producto': item.codigo_producto || '',
        Producto: item.nombre_producto || '',
        Descripción: item.descripcion_producto || '',
        Cantidad: Number(item.cantidad || 0),
        'Moneda Compra': item.moneda_compra || '',
        'Precio Compra': Number(item.precio_compra || 0),
        'Tipo Cambio Compra GTQ': Number(item.tipo_cambio_compra_gtq || 0),
        'Subtotal Compra GTQ': Number(item.subtotal_compra_gtq || 0),
        'Moneda Venta': item.moneda_venta || '',
        'Precio Venta': Number(item.precio_venta || 0),
        'Tipo Cambio Venta GTQ': Number(item.tipo_cambio_venta_gtq || 0),
        'Subtotal Venta GTQ': Number(item.subtotal_venta_gtq || 0),
        'Ganancia Estimada GTQ': Number(item.ganancia_estimada_gtq || 0),
        'Total Pedido': Number(item.total || 0),
        Anticipo: Number(item.anticipo || 0),
        'Saldo Pendiente': Number(item.saldo_pendiente || 0),
        'Estado Pedido': item.estado || '',
        'Estado Producto': item.estado_producto || '',
        'Método Pago': item.metodo_pago || '',
        'Observación Pago': item.observacion_pago || '',
        'Observaciones Pedido': item.observaciones_pedido || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(filasExcel);

      worksheet['!cols'] = [
        { wch: 12 },
        { wch: 14 },
        { wch: 20 },
        { wch: 28 },
        { wch: 15 },
        { wch: 35 },
        { wch: 18 },
        { wch: 18 },
        { wch: 30 },
        { wch: 18 },
        { wch: 30 },
        { wch: 35 },
        { wch: 10 },
        { wch: 14 },
        { wch: 14 },
        { wch: 20 },
        { wch: 20 },
        { wch: 14 },
        { wch: 14 },
        { wch: 20 },
        { wch: 20 },
        { wch: 22 },
        { wch: 14 },
        { wch: 14 },
        { wch: 16 },
        { wch: 18 },
        { wch: 18 },
        { wch: 16 },
        { wch: 25 },
        { wch: 35 }
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Pedidos');

      XLSX.writeFile(workbook, `reporte_pedidos_${mesSeleccionado}.xlsx`);
    } catch (error) {
      console.error('Error al generar Excel:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo generar el Excel.',
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

          <div className="container-fluid gestion-pedidos-container">
            <div className="gestion-hero mt-4">
              <div>
                <span>Gestión de pedidos</span>
                <h2>Editar y cancelar pedidos</h2>
                <p>
                  Busca pedidos por mes, fecha, cliente, teléfono o número de pedido antes de comprarlos o entregarlos.
                </p>
              </div>

              <div className="gestion-hero-icon">
                ✏️
              </div>
            </div>

            <div className="gestion-filtros mt-4">
              <div className="row">
                <div className="col-md-3 mb-3">
                  <label>Mes</label>
                  <input
                    type="month"
                    className="form-control"
                    value={mesSeleccionado}
                    onChange={(e) => setMesSeleccionado(e.target.value)}
                  />
                </div>

                <div className="col-md-3 mb-3">
                  <label>Estados</label>

                  <div className="estado-filtro-box">
                    <div className="estado-filtro-acciones">
                      <button
                        type="button"
                        className="btn-mini-estado"
                        onClick={seleccionarTodosEstados}
                      >
                        Todos
                      </button>

                      <button
                        type="button"
                        className="btn-mini-estado limpiar"
                        onClick={limpiarEstados}
                      >
                        Limpiar
                      </button>
                    </div>

                    <div className="estado-checks">
                      {opcionesEstado.map((opcion) => (
                        <label key={opcion.value} className="estado-check-item">
                          <input
                            type="checkbox"
                            checked={estadosSeleccionados.includes(opcion.value)}
                            onChange={() => toggleEstadoSeleccionado(opcion.value)}
                          />
                          <span>{opcion.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="col-md-6 mb-3">
                  <label>Buscar pedido</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Buscar por cliente, teléfono, fecha o No. pedido..."
                    value={buscar}
                    onChange={(e) => setBuscar(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="gestion-tabla-card mt-4">
              <div className="tabla-header">
                <div>
                  <h4>Pedidos del mes</h4>
                  <p>
                    Consulta, edita, cancela o descarga los pedidos según los filtros seleccionados.
                  </p>
                </div>

                <div className="acciones-reporte">
                  <button
                    type="button"
                    className="btn-reporte btn-excel"
                    onClick={descargarReporteExcel}
                  >
                    📗 Descargar Excel
                  </button>

                  <button
                    type="button"
                    className="btn-reporte btn-pdf"
                    onClick={descargarReportePDF}
                  >
                    📄 Descargar PDF
                  </button>

                  <button
                    type="button"
                    className="btn-reporte btn-actualizar"
                    onClick={cargarPedidos}
                  >
                    🔄 Actualizar
                  </button>
                </div>
              </div>

              {cargando ? (
                <div className="gestion-cargando">
                  Cargando pedidos...
                </div>
              ) : pedidos.length === 0 ? (
                <div className="gestion-vacio">
                  No se encontraron pedidos con los filtros seleccionados.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover gestion-tabla">
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>Fecha</th>
                        <th>Cliente</th>
                        <th>Teléfono</th>
                        <th>Total</th>
                        <th>Anticipo</th>
                        <th>Saldo</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>

                    <tbody>
                      {pedidos.map((pedido) => (
                        <tr key={pedido.id_pedido}>
                          <td>#{pedido.id_pedido}</td>
                          <td>{formatearFecha(pedido.fecha_pedido)}</td>
                          <td>{pedido.cliente}</td>
                          <td>{pedido.telefono || 'Sin teléfono'}</td>
                          <td>Q{Number(pedido.total || 0).toFixed(2)}</td>
                          <td>Q{Number(pedido.anticipo || 0).toFixed(2)}</td>
                          <td>Q{Number(pedido.saldo_pendiente || 0).toFixed(2)}</td>
                          <td>
                            <span className={claseEstado(pedido.estado)}>
                              {pedido.estado}
                            </span>
                          </td>
                          <td>
                            <div className="acciones-pedido">
                              <button
                                type="button"
                                className="btn-editar-pedido"
                                onClick={() => abrirEditarPedido(pedido.id_pedido)}
                                disabled={pedido.estado === 'ENTREGADO' || pedido.estado === 'CANCELADO'}
                              >
                                Editar
                              </button>

                              <button
                                type="button"
                                className="btn-cancelar-pedido"
                                onClick={() => cancelarPedido(pedido)}
                                disabled={pedido.estado === 'ENTREGADO' || pedido.estado === 'CANCELADO'}
                              >
                                Cancelar
                              </button>
                            </div>
                          </td>
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

      {modalAbierto && pedidoEditando && (
        <div className="modal-gestion-backdrop">
          <div className="modal-gestion">
            <div className="modal-gestion-header">
              <div>
                <h3>Editar pedido #{pedidoEditando.id_pedido}</h3>
                <p>
                  Cliente: <strong>{pedidoEditando.cliente}</strong> | Tel: {pedidoEditando.telefono || 'Sin teléfono'}
                </p>
              </div>

              <button
                type="button"
                className="btn-cerrar-modal"
                onClick={cerrarModal}
              >
                ×
              </button>
            </div>

            <div className="modal-gestion-body">
              <div className="pedido-section-modal">
                <h4>Datos del pedido</h4>

                <div className="row">
                  <div className="col-md-3 mb-3">
                    <label>Fecha estimada</label>
                    <input
                      type="date"
                      className="form-control"
                      name="fechaEstimada"
                      value={pedidoEditando.fechaEstimada}
                      onChange={handlePedidoEditandoChange}
                    />
                  </div>

                  <div className="col-md-3 mb-3">
                    <label>Anticipo</label>
                    <input
                      type="number"
                      className="form-control"
                      name="anticipo"
                      min="0"
                      step="0.01"
                      value={pedidoEditando.anticipo}
                      onChange={handlePedidoEditandoChange}
                    />
                  </div>

                  <div className="col-md-3 mb-3">
                    <label>Método de pago</label>
                    <select
                      className="form-control"
                      name="metodo_pago"
                      value={pedidoEditando.metodo_pago}
                      onChange={handlePedidoEditandoChange}
                    >
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="TRANSFERENCIA">Transferencia</option>
                      <option value="DEPOSITO">Depósito</option>
                      <option value="TARJETA">Tarjeta</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </div>

                  <div className="col-md-3 mb-3">
                    <label>Estado</label>
                    <input
                      type="text"
                      className="form-control"
                      value={pedidoEditando.estado}
                      disabled
                    />
                  </div>

                  <div className="col-md-6 mb-3">
                    <label>Observación del anticipo</label>
                    <input
                      type="text"
                      className="form-control"
                      name="observacion_pago"
                      value={pedidoEditando.observacion_pago}
                      onChange={handlePedidoEditandoChange}
                    />
                  </div>

                  <div className="col-md-6 mb-3">
                    <label>Observaciones del pedido</label>
                    <input
                      type="text"
                      className="form-control"
                      name="observaciones"
                      value={pedidoEditando.observaciones}
                      onChange={handlePedidoEditandoChange}
                    />
                  </div>
                </div>
              </div>

              <div className="pedido-section-modal">
                <div className="section-productos-modal">
                  <h4>Productos</h4>

                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={agregarProducto}
                  >
                    + Agregar producto
                  </button>
                </div>

                {productosEditando.map((item, index) => (
                  <div className="producto-edit-card" key={index}>
                    <div className="producto-edit-header">
                      <h5>Producto #{index + 1}</h5>

                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => eliminarProducto(index)}
                      >
                        Quitar
                      </button>
                    </div>

                    <div className="row">
                      <div className="col-md-2 mb-3">
                        <label>Código</label>
                        <input
                          type="text"
                          className="form-control"
                          name="codigo"
                          value={item.codigo}
                          onChange={(e) => handleProductoEditandoChange(index, e)}
                        />
                      </div>

                      <div className="col-md-3 mb-3">
                        <label>Producto</label>
                        <input
                          type="text"
                          className="form-control"
                          name="producto"
                          value={item.producto}
                          onChange={(e) => handleProductoEditandoChange(index, e)}
                        />
                      </div>

                      <div className="col-md-3 mb-3">
                        <label>Descripción</label>
                        <input
                          type="text"
                          className="form-control"
                          name="descripcion"
                          value={item.descripcion}
                          onChange={(e) => handleProductoEditandoChange(index, e)}
                        />
                      </div>

                      <div className="col-md-2 mb-3">
                        <label>Cantidad</label>
                        <input
                          type="number"
                          className="form-control"
                          name="cantidad"
                          min="1"
                          value={item.cantidad}
                          onChange={(e) => handleProductoEditandoChange(index, e)}
                        />
                      </div>

                      <div className="col-md-2 mb-3">
                        <label>Moneda compra</label>
                        <select
                          className="form-control"
                          name="monedaCompra"
                          value={item.monedaCompra}
                          onChange={(e) => handleProductoEditandoChange(index, e)}
                        >
                          <option value="GTQ">GTQ</option>
                          <option value="USD">USD</option>
                          <option value="MXN">MXN</option>
                        </select>
                      </div>

                      <div className="col-md-2 mb-3">
                        <label>Precio compra</label>
                        <input
                          type="number"
                          className="form-control"
                          name="precioCompra"
                          min="0"
                          step="0.01"
                          value={item.precioCompra}
                          onChange={(e) => handleProductoEditandoChange(index, e)}
                        />
                      </div>

                      <div className="col-md-2 mb-3">
                        <label>Cambio compra</label>
                        <input
                          type="number"
                          className="form-control"
                          name="tipoCambioCompra"
                          step="0.000001"
                          value={item.tipoCambioCompra}
                          onChange={(e) => handleProductoEditandoChange(index, e)}
                        />
                      </div>

                      <div className="col-md-2 mb-3">
                        <label>Moneda venta</label>
                        <select
                          className="form-control"
                          name="monedaVenta"
                          value={item.monedaVenta}
                          onChange={(e) => handleProductoEditandoChange(index, e)}
                        >
                          <option value="GTQ">GTQ</option>
                          <option value="USD">USD</option>
                          <option value="MXN">MXN</option>
                        </select>
                      </div>

                      <div className="col-md-2 mb-3">
                        <label>Precio venta</label>
                        <input
                          type="number"
                          className="form-control"
                          name="precioVenta"
                          min="0"
                          step="0.01"
                          value={item.precioVenta}
                          onChange={(e) => handleProductoEditandoChange(index, e)}
                        />
                      </div>

                      <div className="col-md-2 mb-3">
                        <label>Cambio venta</label>
                        <input
                          type="number"
                          className="form-control"
                          name="tipoCambioVenta"
                          step="0.000001"
                          value={item.tipoCambioVenta}
                          onChange={(e) => handleProductoEditandoChange(index, e)}
                        />
                      </div>

                      <div className="col-md-4 mb-3">
                        <label>Subtotal venta</label>
                        <input
                          type="text"
                          className="form-control"
                          value={`Q${calcularSubtotalVenta(item).toFixed(2)}`}
                          disabled
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="resumen-edicion">
                <div>
                  <span>Total compra</span>
                  <strong>Q{totalCompra.toFixed(2)}</strong>
                </div>

                <div>
                  <span>Total venta</span>
                  <strong>Q{totalVenta.toFixed(2)}</strong>
                </div>

                <div>
                  <span>Ganancia</span>
                  <strong>Q{ganancia.toFixed(2)}</strong>
                </div>

                <div>
                  <span>Saldo pendiente</span>
                  <strong>Q{saldoPendiente.toFixed(2)}</strong>
                </div>
              </div>
            </div>

            <div className="modal-gestion-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={cerrarModal}
              >
                Cerrar
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={guardarCambiosPedido}
                disabled={guardando}
              >
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GestionPedidos;