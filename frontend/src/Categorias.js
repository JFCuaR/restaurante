import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import AuthContext from './AuthContext';
import Sidebar from './sidebar';
import Navbar from './Navbar';
import './Categorias.css';

const URL = process.env.REACT_APP_URL_BACKEND || 'http://localhost:3001';

function Categorias() {
  const { token, logout, user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const [formulario, setFormulario] = useState({
    id_categoria: null,
    nombre: '',
    descripcion: '',
    estado: 1
  });

  const [modoEditar, setModoEditar] = useState(false);

  const authToken = token || localStorage.getItem('token');

  const getConfig = () => ({
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  });

  const puedeAdministrar = user?.rol === 'ADMINISTRADOR' || user?.rol === 'GERENTE';

  const toggleSidebar = () => {
    setSidebarOpen(!isSidebarOpen);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const cargarCategorias = async () => {
    try {
      setCargando(true);

      const response = await axios.get(`${URL}/categorias`, getConfig());

      setCategorias(response.data || []);

    } catch (error) {
      console.error('Error cargando categorías:', error);

      if (error.response?.status === 401 || error.response?.status === 403) {
        Swal.fire('Sesión vencida', 'Inicia sesión nuevamente', 'warning');
        logout();
        navigate('/login');
        return;
      }

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudieron cargar las categorías',
        'error'
      );

    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarCategorias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const limpiarFormulario = () => {
    setFormulario({
      id_categoria: null,
      nombre: '',
      descripcion: '',
      estado: 1
    });

    setModoEditar(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormulario({
      ...formulario,
      [name]: value
    });
  };

  const guardarCategoria = async (e) => {
    e.preventDefault();

    if (!formulario.nombre.trim()) {
      Swal.fire('Campo obligatorio', 'Ingresa el nombre de la categoría', 'warning');
      return;
    }

    try {
      setCargando(true);

      const datos = {
        nombre: formulario.nombre.trim(),
        descripcion: formulario.descripcion.trim(),
        estado: Number(formulario.estado)
      };

      if (modoEditar) {
        await axios.put(
          `${URL}/categorias/${formulario.id_categoria}`,
          datos,
          getConfig()
        );

        Swal.fire('Actualizado', 'Categoría actualizada correctamente', 'success');
      } else {
        await axios.post(
          `${URL}/categorias`,
          datos,
          getConfig()
        );

        Swal.fire('Creada', 'Categoría creada correctamente', 'success');
      }

      limpiarFormulario();
      cargarCategorias();

    } catch (error) {
      console.error('Error guardando categoría:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo guardar la categoría',
        'error'
      );

    } finally {
      setCargando(false);
    }
  };

  const editarCategoria = (categoria) => {
    setModoEditar(true);

    setFormulario({
      id_categoria: categoria.id_categoria,
      nombre: categoria.nombre || '',
      descripcion: categoria.descripcion || '',
      estado: Number(categoria.estado)
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cambiarEstado = async (categoria) => {
    const nuevoEstado = Number(categoria.estado) === 1 ? 0 : 1;

    try {
      await axios.patch(
        `${URL}/categorias/${categoria.id_categoria}/estado`,
        { estado: nuevoEstado },
        getConfig()
      );

      cargarCategorias();

    } catch (error) {
      console.error('Error cambiando estado:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo cambiar el estado',
        'error'
      );
    }
  };

  const eliminarCategoria = async (categoria) => {
    const result = await Swal.fire({
      title: '¿Eliminar categoría?',
      text: `Se eliminará "${categoria.nombre}"`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280'
    });

    if (!result.isConfirmed) return;

    try {
      await axios.delete(`${URL}/categorias/${categoria.id_categoria}`, getConfig());

      Swal.fire('Eliminada', 'Categoría eliminada correctamente', 'success');

      cargarCategorias();

    } catch (error) {
      console.error('Error eliminando categoría:', error);

      Swal.fire(
        'No se pudo eliminar',
        error.response?.data?.mensaje || 'No se pudo eliminar la categoría',
        'warning'
      );
    }
  };

  const categoriasFiltradas = categorias.filter((categoria) => {
    const texto = `${categoria.nombre || ''} ${categoria.descripcion || ''}`.toLowerCase();
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

          <div className="container-fluid categorias-container">

            <div className="categorias-header mt-4">
              <div>
                <span className="categorias-badge">Menú del restaurante</span>
                <h2>Categorías</h2>
                <p>
                  Organiza el menú del restaurante por comidas, bebidas, postres,
                  promociones u otras secciones.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-categorias-refresh"
                onClick={cargarCategorias}
                disabled={cargando}
              >
                {cargando ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>

            {puedeAdministrar && (
              <div className="categorias-form-card mt-4">
                <h4>{modoEditar ? 'Editar categoría' : 'Crear nueva categoría'}</h4>

                <form onSubmit={guardarCategoria}>
                  <div className="row">
                    <div className="col-md-4 mb-3">
                      <label>Nombre *</label>
                      <input
                        type="text"
                        name="nombre"
                        className="form-control"
                        value={formulario.nombre}
                        onChange={handleChange}
                        placeholder="Ej. Bebidas"
                      />
                    </div>

                    <div className="col-md-5 mb-3">
                      <label>Descripción</label>
                      <input
                        type="text"
                        name="descripcion"
                        className="form-control"
                        value={formulario.descripcion}
                        onChange={handleChange}
                        placeholder="Descripción de la categoría"
                      />
                    </div>

                    <div className="col-md-3 mb-3">
                      <label>Estado</label>
                      <select
                        name="estado"
                        className="form-control"
                        value={formulario.estado}
                        onChange={handleChange}
                      >
                        <option value={1}>Activa</option>
                        <option value={0}>Inactiva</option>
                      </select>
                    </div>
                  </div>

                  <div className="d-flex gap-2">
                    <button
                      type="submit"
                      className="btn btn-categorias-save"
                      disabled={cargando}
                    >
                      {modoEditar ? 'Guardar cambios' : 'Crear categoría'}
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
            )}

            <div className="categorias-toolbar mt-4">
              <div>
                <h4>Listado de categorías</h4>
                <span>{categoriasFiltradas.length} categorías encontradas</span>
              </div>

              <input
                type="text"
                className="form-control categorias-busqueda"
                placeholder="Buscar categoría..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            <div className="categorias-grid mt-4">
              {cargando && categorias.length === 0 && (
                <div className="categorias-empty">
                  Cargando categorías...
                </div>
              )}

              {!cargando && categoriasFiltradas.length === 0 && (
                <div className="categorias-empty">
                  No hay categorías registradas.
                </div>
              )}

              {categoriasFiltradas.map((categoria) => (
                <div
                  key={categoria.id_categoria}
                  className={`categoria-card ${Number(categoria.estado) === 1 ? 'categoria-activa' : 'categoria-inactiva'}`}
                >
                  <div className="categoria-card-top">
                    <div>
                      <span className="categoria-label">Categoría</span>
                      <h3>{categoria.nombre}</h3>
                    </div>

                    <span className={`categoria-estado ${Number(categoria.estado) === 1 ? 'estado-activo' : 'estado-inactivo'}`}>
                      {Number(categoria.estado) === 1 ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>

                  <p className="categoria-desc">
                    {categoria.descripcion || 'Sin descripción'}
                  </p>

                  {puedeAdministrar && (
                    <div className="categoria-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => editarCategoria(categoria)}
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        className={`btn btn-sm ${Number(categoria.estado) === 1 ? 'btn-outline-warning' : 'btn-outline-success'}`}
                        onClick={() => cambiarEstado(categoria)}
                      >
                        {Number(categoria.estado) === 1 ? 'Desactivar' : 'Activar'}
                      </button>

                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => eliminarCategoria(categoria)}
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

export default Categorias;