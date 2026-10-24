import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AuthContext from './AuthContext';
import Sidebar from './sidebar';
import Navbar from './Navbar';

const URL = process.env.REACT_APP_URL_BACKEND || 'http://localhost:3001';

function AgregarUsuario() {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const { token, logout, user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [editUser, setEditUser] = useState(null);

  const authToken = token || localStorage.getItem('token');

  const configAxios = {
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  };

  const [formData, setFormData] = useState({
    nombre: '',
    usuario: '',
    contraseña: '',
    rol: 'empleado',
    estado: 'activa'
  });

  const toggleSidebar = () => {
    setSidebarOpen(!isSidebarOpen);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const manejarSesionExpirada = (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      alert('Tu sesión expiró. Inicia sesión nuevamente.');
      logout();
      navigate('/login');
      return true;
    }

    return false;
  };

  const fetchUsuarios = async () => {
    try {
      const res = await axios.get(`${URL}/usuarios`, configAxios);
      setUsuarios(res.data);
    } catch (error) {
      console.error('Error al obtener usuarios:', error);

      if (manejarSesionExpirada(error)) return;

      setMessage({
        type: 'danger',
        text: error.response?.data?.mensaje || '❌ Error al obtener usuarios.'
      });
    }
  };

  useEffect(() => {
    fetchUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData({
      ...formData,
      [name]: value
    });
  };

  const limpiarFormulario = () => {
    setFormData({
      nombre: '',
      usuario: '',
      contraseña: '',
      rol: 'empleado',
      estado: 'activa'
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (!formData.nombre.trim()) {
      setMessage({
        type: 'warning',
        text: 'Debes ingresar el nombre del usuario.'
      });
      return;
    }

    if (!formData.usuario.trim()) {
      setMessage({
        type: 'warning',
        text: 'Debes ingresar el usuario.'
      });
      return;
    }

    if (!formData.contraseña.trim()) {
      setMessage({
        type: 'warning',
        text: 'Debes ingresar una contraseña.'
      });
      return;
    }

    try {
      const res = await axios.post(
        `${URL}/agregar_usuario`,
        formData,
        configAxios
      );

      limpiarFormulario();

      setMessage({
        type: 'success',
        text: res.data.mensaje || '✅ Usuario agregado exitosamente.'
      });

      fetchUsuarios();

    } catch (error) {
      console.error('Error al agregar el usuario:', error);

      if (manejarSesionExpirada(error)) return;

      setMessage({
        type: 'danger',
        text:
          error.response?.data?.mensaje ||
          error.response?.data?.msg ||
          '❌ Hubo un error al agregar el usuario.'
      });
    }
  };

  const handleEditClick = (usuarioSeleccionado) => {
    setEditUser({
      ...usuarioSeleccionado,
      contraseña: ''
    });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;

    setEditUser({
      ...editUser,
      [name]: value
    });
  };

  const cerrarModal = () => {
    setEditUser(null);
  };

  const handleUpdateUser = async () => {
    if (isUpdating) return;

    if (!editUser.nombre?.trim()) {
      setMessage({
        type: 'warning',
        text: 'El nombre no puede quedar vacío.'
      });
      return;
    }

    if (!editUser.usuario?.trim()) {
      setMessage({
        type: 'warning',
        text: 'El usuario no puede quedar vacío.'
      });
      return;
    }

    setIsUpdating(true);
    setMessage(null);

    try {
      const datosActualizar = {
        nombre: editUser.nombre,
        usuario: editUser.usuario,
        rol: editUser.rol,
        estado: editUser.estado,
        contraseña: editUser.contraseña || ''
      };

      const res = await axios.put(
        `${URL}/usuarios/${editUser.id_usuario}`,
        datosActualizar,
        configAxios
      );

      setEditUser(null);

      setMessage({
        type: 'success',
        text: res.data.mensaje || '✅ Usuario actualizado correctamente.'
      });

      await fetchUsuarios();

    } catch (error) {
      console.error('Error al actualizar usuario:', error);

      if (manejarSesionExpirada(error)) return;

      setMessage({
        type: 'danger',
        text:
          error.response?.data?.mensaje ||
          '❌ Ocurrió un error al actualizar el usuario.'
      });

    } finally {
      setIsUpdating(false);
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

          <div className="container mt-4">

            <div className="card shadow-sm mb-4">
              <div className="card-body">
                <h3 className="mb-2">Usuarios de la tienda</h3>

                <p className="text-muted mb-0">
                  Aquí puedes crear y administrar los usuarios que pertenecen a esta tienda.
                </p>

                {user?.tienda && (
                  <p className="mt-2 mb-0">
                    <strong>Tienda:</strong> {user.tienda}
                  </p>
                )}
              </div>
            </div>

            {message && (
              <div
                className={`alert alert-${message.type}`}
                role="alert"
              >
                {message.text}
              </div>
            )}

            <div className="card shadow-lg mb-5">
              <div className="card-header bg-primary text-white">
                <h4 className="mb-0">➕ Agregar Nuevo Usuario</h4>
              </div>

              <div className="card-body">
                <form onSubmit={handleSubmit}>
                  <div className="row">

                    <div className="col-md-6 mb-3">
                      <label className="form-label">Nombre</label>

                      <input
                        type="text"
                        className="form-control"
                        name="nombre"
                        value={formData.nombre}
                        onChange={handleChange}
                        placeholder="Nombre completo"
                        required
                      />
                    </div>

                    <div className="col-md-6 mb-3">
                      <label className="form-label">Usuario</label>

                      <input
                        type="text"
                        className="form-control"
                        name="usuario"
                        value={formData.usuario}
                        onChange={handleChange}
                        placeholder="Nombre de usuario"
                        required
                      />
                    </div>

                    <div className="col-md-6 mb-3">
                      <label className="form-label">Contraseña</label>

                      <input
                        type="password"
                        className="form-control"
                        name="contraseña"
                        value={formData.contraseña}
                        onChange={handleChange}
                        placeholder="Contraseña"
                        required
                      />
                    </div>

                    <div className="col-md-3 mb-3">
                      <label className="form-label">Rol</label>

                      <select
                        className="form-control"
                        name="rol"
                        value={formData.rol}
                        onChange={handleChange}
                        required
                      >
                        <option value="admin">Administrador</option>
                        <option value="vendedor">Vendedor</option>
                        <option value="empleado">Empleado</option>
                        <option value="repartidor">Repartidor</option>
                      </select>
                    </div>

                    <div className="col-md-3 mb-3">
                      <label className="form-label">Estado</label>

                      <select
                        className="form-control"
                        name="estado"
                        value={formData.estado}
                        onChange={handleChange}
                        required
                      >
                        <option value="activa">Activa</option>
                        <option value="desactivada">Desactivada</option>
                      </select>
                    </div>

                  </div>

                  <button type="submit" className="btn btn-success">
                    Guardar Usuario
                  </button>
                </form>
              </div>
            </div>

            <div className="card shadow">
              <div className="card-header bg-secondary text-white">
                <h5 className="mb-0">👥 Usuarios Registrados</h5>
              </div>

              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-striped table-hover mb-0">
                    <thead className="table-dark">
                      <tr>
                        <th>ID</th>
                        <th>Tienda</th>
                        <th>Nombre</th>
                        <th>Usuario</th>
                        <th>Rol</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>

                    <tbody>
                      {usuarios.map((usuarioItem) => (
                        <tr key={usuarioItem.id_usuario}>
                          <td>{usuarioItem.id_usuario}</td>
                          <td>{usuarioItem.nombre_tienda || user?.tienda || 'Sin tienda'}</td>
                          <td>{usuarioItem.nombre}</td>
                          <td>{usuarioItem.usuario}</td>
                          <td>
                            <span className="badge bg-primary">
                              {usuarioItem.rol}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                usuarioItem.estado === 'activa'
                                  ? 'bg-success'
                                  : 'bg-danger'
                              }`}
                            >
                              {usuarioItem.estado}
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn btn-warning btn-sm"
                              onClick={() => handleEditClick(usuarioItem)}
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      ))}

                      {usuarios.length === 0 && (
                        <tr>
                          <td colSpan="7" className="text-center py-3">
                            No hay usuarios registrados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {editUser && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog modal-lg">
            <div className="modal-content">

              <div className="modal-header bg-info text-white">
                <h5 className="modal-title">Editar Usuario</h5>

                <button
                  type="button"
                  className="btn-close"
                  onClick={cerrarModal}
                  aria-label="Close"
                ></button>
              </div>

              <div className="modal-body">
                <div className="row">

                  <div className="col-md-6 mb-3">
                    <label className="form-label">Nombre</label>

                    <input
                      type="text"
                      className="form-control"
                      name="nombre"
                      value={editUser.nombre || ''}
                      onChange={handleEditChange}
                    />
                  </div>

                  <div className="col-md-6 mb-3">
                    <label className="form-label">Usuario</label>

                    <input
                      type="text"
                      className="form-control"
                      name="usuario"
                      value={editUser.usuario || ''}
                      onChange={handleEditChange}
                    />
                  </div>

                  <div className="col-md-6 mb-3">
                    <label className="form-label">
                      Nueva contraseña
                    </label>

                    <input
                      type="password"
                      className="form-control"
                      name="contraseña"
                      value={editUser.contraseña || ''}
                      onChange={handleEditChange}
                      placeholder="Dejar vacío si no deseas cambiarla"
                    />

                    <small className="text-muted">
                      Si no escribes nada, la contraseña actual se mantiene.
                    </small>
                  </div>

                  <div className="col-md-3 mb-3">
                    <label className="form-label">Rol</label>

                    <select
                      className="form-control"
                      name="rol"
                      value={editUser.rol || 'empleado'}
                      onChange={handleEditChange}
                    >
                      <option value="admin">Administrador</option>
                      <option value="vendedor">Vendedor</option>
                      <option value="empleado">Empleado</option>
                      <option value="repartidor">Repartidor</option>
                    </select>
                  </div>

                  <div className="col-md-3 mb-3">
                    <label className="form-label">Estado</label>

                    <select
                      className="form-control"
                      name="estado"
                      value={editUser.estado || 'activa'}
                      onChange={handleEditChange}
                    >
                      <option value="activa">Activa</option>
                      <option value="desactivada">Desactivada</option>
                    </select>
                  </div>

                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="btn btn-success"
                  onClick={handleUpdateUser}
                  disabled={isUpdating}
                >
                  {isUpdating ? 'Guardando...' : 'Guardar Cambios'}
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={cerrarModal}
                >
                  Cancelar
                </button>
              </div>

            </div>
          </div>

          <div
            className="modal-backdrop show"
            onClick={cerrarModal}
          ></div>
        </div>
      )}
    </div>
  );
}

export default AgregarUsuario;