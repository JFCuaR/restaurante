import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import AuthContext from './AuthContext';
import Sidebar from './sidebar';
import Navbar from './Navbar';
import './Gastos.css';

const URL = process.env.REACT_APP_URL_BACKEND || 'http://localhost:3001';

function Gastos() {
  const { token, logout, user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [gastos, setGastos] = useState([]);

  const [resumen, setResumen] = useState({
    total_gastos: 0,
    monto_total: 0
  });

  const hoy = new Date().toISOString().slice(0, 10);

  const [filtros, setFiltros] = useState({
    fecha_inicio: hoy.slice(0, 8) + '01',
    fecha_fin: hoy,
    categoria: 'todas',
    buscar: ''
  });

  const [formulario, setFormulario] = useState({
    id_gasto: null,
    categoria: 'Compras',
    descripcion: '',
    monto: '',
    referencia: '',
    fecha_gasto: hoy
  });

  const [modoEditar, setModoEditar] = useState(false);

  const authToken = token || localStorage.getItem('token');

  const getConfig = () => ({
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  });

  const puedeEditarEliminar = ['ADMINISTRADOR', 'GERENTE'].includes(user?.rol);

  const categoriasGasto = [
    'Compras',
    'Servicios',
    'Salarios',
    'Transporte',
    'Mantenimiento',
    'Limpieza',
    'Renta',
    'Gas',
    'Otros'
  ];

  const toggleSidebar = () => {
    setSidebarOpen(!isSidebarOpen);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const cargarGastos = async () => {
    try {
      setCargando(true);

      const params = new URLSearchParams();

      if (filtros.fecha_inicio) params.append('fecha_inicio', filtros.fecha_inicio);
      if (filtros.fecha_fin) params.append('fecha_fin', filtros.fecha_fin);
      if (filtros.categoria) params.append('categoria', filtros.categoria);
      if (filtros.buscar.trim()) params.append('buscar', filtros.buscar.trim());

      const response = await axios.get(
        `${URL}/gastos?${params.toString()}`,
        getConfig()
      );

      setGastos(response.data.gastos || []);
      setResumen(response.data.resumen || {
        total_gastos: 0,
        monto_total: 0
      });

    } catch (error) {
      console.error('Error cargando gastos:', error);

      if (error.response?.status === 401 || error.response?.status === 403) {
        Swal.fire('Sesión vencida', 'Inicia sesión nuevamente', 'warning');
        logout();
        navigate('/login');
        return;
      }

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudieron cargar los gastos',
        'error'
      );

    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarGastos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;

    setFiltros({
      ...filtros,
      [name]: value
    });
  };

  const handleFormularioChange = (e) => {
    const { name, value } = e.target;

    setFormulario({
      ...formulario,
      [name]: value
    });
  };

  const limpiarFormulario = () => {
    setFormulario({
      id_gasto: null,
      categoria: 'Compras',
      descripcion: '',
      monto: '',
      referencia: '',
      fecha_gasto: hoy
    });

    setModoEditar(false);
  };

  const guardarGasto = async (e) => {
    e.preventDefault();

    if (!formulario.categoria.trim()) {
      Swal.fire('Campo obligatorio', 'Selecciona una categoría', 'warning');
      return;
    }

    if (!formulario.descripcion.trim()) {
      Swal.fire('Campo obligatorio', 'Ingresa la descripción del gasto', 'warning');
      return;
    }

    if (Number(formulario.monto || 0) <= 0) {
      Swal.fire('Monto inválido', 'El monto debe ser mayor a 0', 'warning');
      return;
    }

    try {
      setCargando(true);

      const datos = {
        categoria: formulario.categoria,
        descripcion: formulario.descripcion.trim(),
        monto: Number(formulario.monto),
        referencia: formulario.referencia.trim(),
        fecha_gasto: formulario.fecha_gasto
      };

      if (modoEditar) {
        await axios.put(
          `${URL}/gastos/${formulario.id_gasto}`,
          datos,
          getConfig()
        );

        Swal.fire('Actualizado', 'Gasto actualizado correctamente', 'success');
      } else {
        await axios.post(
          `${URL}/gastos`,
          datos,
          getConfig()
        );

        Swal.fire('Registrado', 'Gasto registrado correctamente', 'success');
      }

      limpiarFormulario();
      cargarGastos();

    } catch (error) {
      console.error('Error guardando gasto:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo guardar el gasto',
        'error'
      );

    } finally {
      setCargando(false);
    }
  };

  const editarGasto = (gasto) => {
    setModoEditar(true);

    setFormulario({
      id_gasto: gasto.id_gasto,
      categoria: gasto.categoria || 'Otros',
      descripcion: gasto.descripcion || '',
      monto: gasto.monto || '',
      referencia: gasto.referencia || '',
      fecha_gasto: gasto.fecha_gasto
        ? new Date(gasto.fecha_gasto).toISOString().slice(0, 10)
        : hoy
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const eliminarGasto = async (gasto) => {
    const result = await Swal.fire({
      title: '¿Eliminar gasto?',
      text: `Se eliminará el gasto: ${gasto.descripcion}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280'
    });

    if (!result.isConfirmed) return;

    try {
      await axios.delete(
        `${URL}/gastos/${gasto.id_gasto}`,
        getConfig()
      );

      Swal.fire('Eliminado', 'Gasto eliminado correctamente', 'success');

      cargarGastos();

    } catch (error) {
      console.error('Error eliminando gasto:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo eliminar el gasto',
        'error'
      );
    }
  };

  const formatearMoneda = (valor) => {
    return `Q${Number(valor || 0).toFixed(2)}`;
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return 'Sin fecha';

    const fechaObj = new Date(fecha);

    if (Number.isNaN(fechaObj.getTime())) return 'Sin fecha';

    return fechaObj.toLocaleDateString('es-GT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
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

          <div className="container-fluid gastos-container">

            <div className="gastos-header mt-4">
              <div>
                <span className="gastos-badge">Administración</span>
                <h2>Gastos</h2>
                <p>
                  Registra y consulta los gastos del restaurante para calcular mejor tus ganancias.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-gastos-refresh"
                onClick={cargarGastos}
                disabled={cargando}
              >
                {cargando ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>

            <div className="gastos-resumen mt-4">
              <div className="gasto-resumen-card">
                <span>Total de gastos</span>
                <h3>{resumen.total_gastos}</h3>
                <p>Registros encontrados</p>
              </div>

              <div className="gasto-resumen-card">
                <span>Monto total</span>
                <h3>{formatearMoneda(resumen.monto_total)}</h3>
                <p>Según filtros aplicados</p>
              </div>
            </div>

            <div className="gastos-form-card mt-4">
              <h4>{modoEditar ? 'Editar gasto' : 'Registrar nuevo gasto'}</h4>

              <form onSubmit={guardarGasto}>
                <div className="row">
                  <div className="col-md-3 mb-3">
                    <label>Categoría *</label>
                    <select
                      name="categoria"
                      className="form-control"
                      value={formulario.categoria}
                      onChange={handleFormularioChange}
                    >
                      {categoriasGasto.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-4 mb-3">
                    <label>Descripción *</label>
                    <input
                      type="text"
                      name="descripcion"
                      className="form-control"
                      value={formulario.descripcion}
                      onChange={handleFormularioChange}
                      placeholder="Ej. Compra de verduras"
                    />
                  </div>

                  <div className="col-md-2 mb-3">
                    <label>Monto *</label>
                    <input
                      type="number"
                      name="monto"
                      className="form-control"
                      value={formulario.monto}
                      onChange={handleFormularioChange}
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="col-md-3 mb-3">
                    <label>Fecha</label>
                    <input
                      type="date"
                      name="fecha_gasto"
                      className="form-control"
                      value={formulario.fecha_gasto}
                      onChange={handleFormularioChange}
                    />
                  </div>

                  <div className="col-md-12 mb-3">
                    <label>Referencia</label>
                    <input
                      type="text"
                      name="referencia"
                      className="form-control"
                      value={formulario.referencia}
                      onChange={handleFormularioChange}
                      placeholder="Factura, proveedor, nota u observación"
                    />
                  </div>
                </div>

                <div className="d-flex gap-2">
                  <button
                    type="submit"
                    className="btn btn-gastos-save"
                    disabled={cargando}
                  >
                    {modoEditar ? 'Guardar cambios' : 'Registrar gasto'}
                  </button>

                  {modoEditar && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={limpiarFormulario}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="gastos-filtros mt-4">
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
                <label>Categoría</label>
                <select
                  name="categoria"
                  className="form-control"
                  value={filtros.categoria}
                  onChange={handleFiltroChange}
                >
                  <option value="todas">Todas</option>
                  {categoriasGasto.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
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
                  placeholder="Descripción o referencia"
                />
              </div>

              <div className="d-flex align-items-end">
                <button
                  type="button"
                  className="btn btn-gastos-save"
                  onClick={cargarGastos}
                >
                  Filtrar
                </button>
              </div>
            </div>

            <div className="gastos-lista mt-4">
              {cargando && gastos.length === 0 && (
                <div className="gastos-empty">
                  Cargando gastos...
                </div>
              )}

              {!cargando && gastos.length === 0 && (
                <div className="gastos-empty">
                  No hay gastos registrados.
                </div>
              )}

              {gastos.map((gasto) => (
                <div key={gasto.id_gasto} className="gasto-card">
                  <div className="gasto-card-top">
                    <div>
                      <span className="gasto-categoria">
                        {gasto.categoria}
                      </span>
                      <h3>{gasto.descripcion}</h3>
                    </div>

                    <strong>{formatearMoneda(gasto.monto)}</strong>
                  </div>

                  <div className="gasto-info">
                    <span>Fecha: {formatearFecha(gasto.fecha_gasto)}</span>
                    <span>Usuario: {gasto.usuario || 'Sin usuario'}</span>
                  </div>

                  {gasto.referencia && (
                    <p className="gasto-referencia">
                      {gasto.referencia}
                    </p>
                  )}

                  {puedeEditarEliminar && (
                    <div className="gasto-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => editarGasto(gasto)}
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => eliminarGasto(gasto)}
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default Gastos;