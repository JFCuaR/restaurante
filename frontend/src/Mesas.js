import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import AuthContext from './AuthContext';
import Sidebar from './sidebar';
import Navbar from './Navbar';
import './Mesas.css';

const URL = process.env.REACT_APP_URL_BACKEND || 'http://localhost:3001';

function Mesas() {
  const { token, logout, user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [mesas, setMesas] = useState([]);
  const [cargando, setCargando] = useState(false);

  const [formulario, setFormulario] = useState({
    id_mesa: null,
    numero_mesa: '',
    descripcion: '',
    capacidad: 4,
    estado: 'libre'
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

  const cargarMesas = async () => {
    try {
      setCargando(true);

      const response = await axios.get(`${URL}/mesas`, getConfig());

      setMesas(response.data || []);

    } catch (error) {
      console.error('Error cargando mesas:', error);

      if (error.response?.status === 401 || error.response?.status === 403) {
        Swal.fire('Sesión vencida', 'Inicia sesión nuevamente', 'warning');
        logout();
        navigate('/login');
        return;
      }

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudieron cargar las mesas',
        'error'
      );

    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarMesas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const limpiarFormulario = () => {
    setFormulario({
      id_mesa: null,
      numero_mesa: '',
      descripcion: '',
      capacidad: 4,
      estado: 'libre'
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

  const guardarMesa = async (e) => {
    e.preventDefault();

    if (!formulario.numero_mesa.trim()) {
      Swal.fire('Campo obligatorio', 'Ingresa el número de mesa', 'warning');
      return;
    }

    try {
      setCargando(true);

      const datos = {
        numero_mesa: formulario.numero_mesa.trim(),
        descripcion: formulario.descripcion.trim(),
        capacidad: Number(formulario.capacidad || 4),
        estado: formulario.estado
      };

      if (modoEditar) {
        await axios.put(
          `${URL}/mesas/${formulario.id_mesa}`,
          datos,
          getConfig()
        );

        Swal.fire('Actualizado', 'Mesa actualizada correctamente', 'success');
      } else {
        await axios.post(
          `${URL}/mesas`,
          datos,
          getConfig()
        );

        Swal.fire('Creado', 'Mesa creada correctamente', 'success');
      }

      limpiarFormulario();
      cargarMesas();

    } catch (error) {
      console.error('Error guardando mesa:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo guardar la mesa',
        'error'
      );

    } finally {
      setCargando(false);
    }
  };

  const editarMesa = (mesa) => {
    setModoEditar(true);

    setFormulario({
      id_mesa: mesa.id_mesa,
      numero_mesa: mesa.numero_mesa || '',
      descripcion: mesa.descripcion || '',
      capacidad: mesa.capacidad || 4,
      estado: mesa.estado || 'libre'
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cambiarEstado = async (mesa, nuevoEstado) => {
    try {
      await axios.patch(
        `${URL}/mesas/${mesa.id_mesa}/estado`,
        { estado: nuevoEstado },
        getConfig()
      );

      cargarMesas();

    } catch (error) {
      console.error('Error cambiando estado:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo cambiar el estado',
        'error'
      );
    }
  };

  const eliminarMesa = async (mesa) => {
    const result = await Swal.fire({
      title: '¿Eliminar mesa?',
      text: `Se eliminará la mesa ${mesa.numero_mesa}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280'
    });

    if (!result.isConfirmed) return;

    try {
      await axios.delete(`${URL}/mesas/${mesa.id_mesa}`, getConfig());

      Swal.fire('Eliminada', 'Mesa eliminada correctamente', 'success');

      cargarMesas();

    } catch (error) {
      console.error('Error eliminando mesa:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo eliminar la mesa',
        'error'
      );
    }
  };

  const abrirPedidoMesa = (mesa) => {
    if (mesa.estado === 'ocupada') {
      navigate(`/pedidos?mesa=${mesa.id_mesa}`);
      return;
    }

    navigate(`/nuevo-pedido?mesa=${mesa.id_mesa}`);
  };

  const textoEstado = (estado) => {
    const estados = {
      libre: 'Libre',
      ocupada: 'Ocupada',
      reservada: 'Reservada',
      en_limpieza: 'En limpieza'
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

          <div className="container-fluid mesas-container">

            <div className="mesas-header mt-4">
              <div>
                <span className="mesas-badge">Restaurante</span>
                <h2>Gestión de Mesas</h2>
                <p>
                  Administra las mesas del restaurante y abre pedidos directamente desde una mesa.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-mesas-refresh"
                onClick={cargarMesas}
                disabled={cargando}
              >
                {cargando ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>

            {puedeAdministrar && (
              <div className="mesas-form-card mt-4">
                <h4>{modoEditar ? 'Editar mesa' : 'Crear nueva mesa'}</h4>

                <form onSubmit={guardarMesa}>
                  <div className="row">
                    <div className="col-md-3 mb-3">
                      <label>Número de mesa *</label>
                      <input
                        type="text"
                        name="numero_mesa"
                        className="form-control"
                        value={formulario.numero_mesa}
                        onChange={handleChange}
                        placeholder="Ej. 1"
                      />
                    </div>

                    <div className="col-md-3 mb-3">
                      <label>Capacidad</label>
                      <input
                        type="number"
                        name="capacidad"
                        className="form-control"
                        value={formulario.capacidad}
                        onChange={handleChange}
                        min="1"
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
                        <option value="libre">Libre</option>
                        <option value="ocupada">Ocupada</option>
                        <option value="reservada">Reservada</option>
                        <option value="en_limpieza">En limpieza</option>
                      </select>
                    </div>

                    <div className="col-md-3 mb-3">
                      <label>Descripción</label>
                      <input
                        type="text"
                        name="descripcion"
                        className="form-control"
                        value={formulario.descripcion}
                        onChange={handleChange}
                        placeholder="Ej. Área principal"
                      />
                    </div>
                  </div>

                  <div className="d-flex gap-2">
                    <button
                      type="submit"
                      className="btn btn-mesas-save"
                      disabled={cargando}
                    >
                      {modoEditar ? 'Guardar cambios' : 'Crear mesa'}
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

            <div className="mesas-grid mt-4">
              {cargando && mesas.length === 0 && (
                <div className="mesas-empty">
                  Cargando mesas...
                </div>
              )}

              {!cargando && mesas.length === 0 && (
                <div className="mesas-empty">
                  No hay mesas registradas.
                </div>
              )}

              {mesas.map((mesa) => (
                <div
                  key={mesa.id_mesa}
                  className={`mesa-card mesa-${mesa.estado}`}
                >
                  <div className="mesa-card-top">
                    <div>
                      <span className="mesa-label">Mesa</span>
                      <h3>{mesa.numero_mesa}</h3>
                    </div>

                    <span className={`mesa-estado estado-${mesa.estado}`}>
                      {textoEstado(mesa.estado)}
                    </span>
                  </div>

                  <p className="mesa-desc">
                    {mesa.descripcion || 'Sin descripción'}
                  </p>

                  <div className="mesa-info">
                    <span>Capacidad: {mesa.capacidad || 0}</span>
                  </div>

                  <div className="mesa-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => abrirPedidoMesa(mesa)}
                    >
                      {mesa.estado === 'ocupada' ? 'Ver pedido' : 'Abrir pedido'}
                    </button>

                    {puedeAdministrar && (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => editarMesa(mesa)}
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => eliminarMesa(mesa)}
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  </div>

                  <div className="mesa-estado-actions">
                    <button
                      type="button"
                      onClick={() => cambiarEstado(mesa, 'libre')}
                      disabled={mesa.estado === 'libre'}
                    >
                      Libre
                    </button>

                    <button
                      type="button"
                      onClick={() => cambiarEstado(mesa, 'reservada')}
                      disabled={mesa.estado === 'reservada'}
                    >
                      Reservar
                    </button>

                    <button
                      type="button"
                      onClick={() => cambiarEstado(mesa, 'en_limpieza')}
                      disabled={mesa.estado === 'en_limpieza'}
                    >
                      Limpieza
                    </button>
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

export default Mesas;