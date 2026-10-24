import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import AuthContext from './AuthContext';
import Sidebar from './sidebar';
import Navbar from './Navbar';
import './Usuarios.css';

const URL = process.env.REACT_APP_URL_BACKEND || 'http://localhost:3001';

function Usuarios() {
  const { token, logout, user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const [formulario, setFormulario] = useState({
    id_usuario: null,
    nombre: '',
    usuario: '',
    password: '',
    rol: 'MESERO',
    estado: 1
  });

  const [modoEditar, setModoEditar] = useState(false);

  const authToken = token || localStorage.getItem('token');

  const getConfig = () => ({
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  });

  const puedeEliminar = user?.rol === 'ADMINISTRADOR';

  const roles = [
    'ADMINISTRADOR',
    'GERENTE',
    'CAJA',
    'MESERO',
    'COCINA'
  ];

  const toggleSidebar = () => {
    setSidebarOpen(!isSidebarOpen);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const cargarUsuarios = async () => {
    try {
      setCargando(true);

      const response = await axios.get(`${URL}/usuarios`, getConfig());

      setUsuarios(response.data || []);

    } catch (error) {
      console.error('Error cargando usuarios:', error);

      if (error.response?.status === 401 || error.response?.status === 403) {
        Swal.fire('Sesión vencida', 'Inicia sesión nuevamente', 'warning');
        logout();
        navigate('/login');
        return;
      }

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudieron cargar los usuarios',
        'error'
      );

    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const limpiarFormulario = () => {
    setFormulario({
      id_usuario: null,
      nombre: '',
      usuario: '',
      password: '',
      rol: 'MESERO',
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

  const guardarUsuario = async (e) => {
    e.preventDefault();

    if (!formulario.nombre.trim()) {
      Swal.fire('Campo obligatorio', 'Ingresa el nombre del usuario', 'warning');
      return;
    }

    if (!formulario.usuario.trim()) {
      Swal.fire('Campo obligatorio', 'Ingresa el usuario', 'warning');
      return;
    }

    if (!modoEditar && (!formulario.password || formulario.password.length < 8)) {
      Swal.fire('Contraseña inválida', 'La contraseña debe tener al menos 8 caracteres', 'warning');
      return;
    }

    if (modoEditar && formulario.password && formulario.password.length < 8) {
      Swal.fire('Contraseña inválida', 'La contraseña debe tener al menos 8 caracteres', 'warning');
      return;
    }

    try {
      setCargando(true);

      const datos = {
        nombre: formulario.nombre.trim(),
        usuario: formulario.usuario.trim(),
        password: formulario.password,
        rol: formulario.rol,
        estado: Number(formulario.estado)
      };

      if (modoEditar) {
        await axios.put(
          `${URL}/usuarios/${formulario.id_usuario}`,
          datos,
          getConfig()
        );

        Swal.fire('Actualizado', 'Usuario actualizado correctamente', 'success');
      } else {
        await axios.post(
          `${URL}/usuarios`,
          datos,
          getConfig()
        );

        Swal.fire('Creado', 'Usuario creado correctamente', 'success');
      }

      limpiarFormulario();
      cargarUsuarios();

    } catch (error) {
      console.error('Error guardando usuario:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo guardar el usuario',
        'error'
      );

    } finally {
      setCargando(false);
    }
  };

  const editarUsuario = (item) => {
    setModoEditar(true);

    setFormulario({
      id_usuario: item.id_usuario,
      nombre: item.nombre || '',
      usuario: item.usuario || '',
      password: '',
      rol: item.rol || 'MESERO',
      estado: Number(item.estado)
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cambiarEstado = async (item) => {
    const nuevoEstado = Number(item.estado) === 1 ? 0 : 1;

    try {
      await axios.patch(
        `${URL}/usuarios/${item.id_usuario}/estado`,
        { estado: nuevoEstado },
        getConfig()
      );

      cargarUsuarios();

    } catch (error) {
      console.error('Error cambiando estado:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo cambiar el estado',
        'error'
      );
    }
  };

  const eliminarUsuario = async (item) => {
    const result = await Swal.fire({
      title: '¿Eliminar usuario?',
      text: `Se eliminará el usuario "${item.nombre}"`,
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
        `${URL}/usuarios/${item.id_usuario}`,
        getConfig()
      );

      Swal.fire('Eliminado', 'Usuario eliminado correctamente', 'success');

      cargarUsuarios();

    } catch (error) {
      console.error('Error eliminando usuario:', error);

      Swal.fire(
        'No se pudo eliminar',
        error.response?.data?.mensaje || 'No se pudo eliminar el usuario',
        'warning'
      );
    }
  };

  const usuariosFiltrados = usuarios.filter((item) => {
    const texto = `${item.nombre || ''} ${item.usuario || ''} ${item.rol || ''}`.toLowerCase();
    return texto.includes(busqueda.toLowerCase());
  });

  const textoEstado = (estado) => {
    return Number(estado) === 1 ? 'Activo' : 'Inactivo';
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

          <div className="container-fluid usuarios-container">

            <div className="usuarios-header mt-4">
              <div>
                <span className="usuarios-badge">Administración</span>
                <h2>Usuarios</h2>
                <p>
                  Crea y administra usuarios para caja, meseros, cocina y gerencia.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-usuarios-refresh"
                onClick={cargarUsuarios}
                disabled={cargando}
              >
                {cargando ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>

            <div className="usuarios-form-card mt-4">
              <h4>{modoEditar ? 'Editar usuario' : 'Crear nuevo usuario'}</h4>

              <form onSubmit={guardarUsuario}>
                <div className="row">
                  <div className="col-md-3 mb-3">
                    <label>Nombre *</label>
                    <input
                      type="text"
                      name="nombre"
                      className="form-control"
                      value={formulario.nombre}
                      onChange={handleChange}
                      placeholder="Nombre completo"
                    />
                  </div>

                  <div className="col-md-2 mb-3">
                    <label>Usuario *</label>
                    <input
                      type="text"
                      name="usuario"
                      className="form-control"
                      value={formulario.usuario}
                      onChange={handleChange}
                      placeholder="usuario"
                    />
                  </div>

                  <div className="col-md-3 mb-3">
                    <label>
                      Contraseña {modoEditar ? '(opcional)' : '*'}
                    </label>
                    <input
                      type="password"
                      name="password"
                      className="form-control"
                      value={formulario.password}
                      onChange={handleChange}
                      placeholder={modoEditar ? 'Dejar vacío para no cambiar' : 'Mínimo 8 caracteres'}
                    />
                  </div>

                  <div className="col-md-2 mb-3">
                    <label>Rol</label>
                    <select
                      name="rol"
                      className="form-control"
                      value={formulario.rol}
                      onChange={handleChange}
                    >
                      {roles.map((rol) => (
                        <option key={rol} value={rol}>
                          {rol}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-2 mb-3">
                    <label>Estado</label>
                    <select
                      name="estado"
                      className="form-control"
                      value={formulario.estado}
                      onChange={handleChange}
                    >
                      <option value={1}>Activo</option>
                      <option value={0}>Inactivo</option>
                    </select>
                  </div>
                </div>

                <div className="d-flex gap-2">
                  <button
                    type="submit"
                    className="btn btn-usuarios-save"
                    disabled={cargando}
                  >
                    {modoEditar ? 'Guardar cambios' : 'Crear usuario'}
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

            <div className="usuarios-toolbar mt-4">
              <div>
                <h4>Listado de usuarios</h4>
                <span>{usuariosFiltrados.length} usuarios encontrados</span>
              </div>

              <input
                type="text"
                className="form-control usuarios-busqueda"
                placeholder="Buscar usuario..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            <div className="usuarios-grid mt-4">
              {cargando && usuarios.length === 0 && (
                <div className="usuarios-empty">
                  Cargando usuarios...
                </div>
              )}

              {!cargando && usuariosFiltrados.length === 0 && (
                <div className="usuarios-empty">
                  No hay usuarios registrados.
                </div>
              )}

              {usuariosFiltrados.map((item) => (
                <div
                  key={item.id_usuario}
                  className={`usuario-card ${Number(item.estado) === 1 ? 'usuario-activo' : 'usuario-inactivo'}`}
                >
                  <div className="usuario-card-top">
                    <div>
                      <span className="usuario-rol">
                        {item.rol}
                      </span>
                      <h3>{item.nombre}</h3>
                      <p>@{item.usuario}</p>
                    </div>

                    <span className={`usuario-estado ${Number(item.estado) === 1 ? 'estado-activo' : 'estado-inactivo'}`}>
                      {textoEstado(item.estado)}
                    </span>
                  </div>

                  <div className="usuario-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => editarUsuario(item)}
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      className={`btn btn-sm ${Number(item.estado) === 1 ? 'btn-outline-warning' : 'btn-outline-success'}`}
                      onClick={() => cambiarEstado(item)}
                    >
                      {Number(item.estado) === 1 ? 'Desactivar' : 'Activar'}
                    </button>

                    {puedeEliminar && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => eliminarUsuario(item)}
                      >
                        Eliminar
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

export default Usuarios;