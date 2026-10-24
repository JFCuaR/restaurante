import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import AuthContext from './AuthContext';
import Sidebar from './sidebar';
import Navbar from './Navbar';
import './Configuracion.css';

const URL = process.env.REACT_APP_URL_BACKEND || 'http://localhost:3001';

function Configuracion() {
  const { token, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [cargando, setCargando] = useState(false);

  const [restaurante, setRestaurante] = useState({
    nombre: '',
    telefono: '',
    direccion: '',
    nit: 'CF',
    logo: ''
  });

  const [configuracion, setConfiguracion] = useState({
    cobra_propina: 0,
    porcentaje_propina: 0,
    imprime_comanda: 0,
    imprime_ticket: 0,
    moneda: 'Q'
  });

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

  const cargarConfiguracion = async () => {
    try {
      setCargando(true);

      const response = await axios.get(`${URL}/configuracion`, getConfig());

      setRestaurante({
        nombre: response.data.restaurante?.nombre || '',
        telefono: response.data.restaurante?.telefono || '',
        direccion: response.data.restaurante?.direccion || '',
        nit: response.data.restaurante?.nit || 'CF',
        logo: response.data.restaurante?.logo || ''
      });

      setConfiguracion({
        cobra_propina: Number(response.data.configuracion?.cobra_propina || 0),
        porcentaje_propina: Number(response.data.configuracion?.porcentaje_propina || 0),
        imprime_comanda: Number(response.data.configuracion?.imprime_comanda || 0),
        imprime_ticket: Number(response.data.configuracion?.imprime_ticket || 0),
        moneda: response.data.configuracion?.moneda || 'Q'
      });

    } catch (error) {
      console.error('Error cargando configuración:', error);

      if (error.response?.status === 401 || error.response?.status === 403) {
        Swal.fire('Sesión vencida', 'Inicia sesión nuevamente', 'warning');
        logout();
        navigate('/login');
        return;
      }

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo cargar la configuración',
        'error'
      );

    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarConfiguracion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRestauranteChange = (e) => {
    const { name, value } = e.target;

    setRestaurante({
      ...restaurante,
      [name]: value
    });
  };

  const handleConfiguracionChange = (e) => {
    const { name, value, type, checked } = e.target;

    setConfiguracion({
      ...configuracion,
      [name]: type === 'checkbox' ? (checked ? 1 : 0) : value
    });
  };

  const guardarRestaurante = async (e) => {
    e.preventDefault();

    if (!restaurante.nombre.trim()) {
      Swal.fire('Campo obligatorio', 'El nombre del restaurante es obligatorio', 'warning');
      return;
    }

    try {
      setCargando(true);

      await axios.put(
        `${URL}/configuracion/restaurante`,
        {
          nombre: restaurante.nombre.trim(),
          telefono: restaurante.telefono.trim(),
          direccion: restaurante.direccion.trim(),
          nit: restaurante.nit.trim() || 'CF',
          logo: restaurante.logo.trim()
        },
        getConfig()
      );

      Swal.fire('Guardado', 'Datos del restaurante actualizados correctamente', 'success');

      cargarConfiguracion();

    } catch (error) {
      console.error('Error guardando restaurante:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudieron guardar los datos',
        'error'
      );

    } finally {
      setCargando(false);
    }
  };

  const guardarOpciones = async (e) => {
    e.preventDefault();

    if (Number(configuracion.porcentaje_propina || 0) < 0) {
      Swal.fire('Dato inválido', 'El porcentaje de propina no puede ser negativo', 'warning');
      return;
    }

    try {
      setCargando(true);

      await axios.put(
        `${URL}/configuracion/opciones`,
        {
          cobra_propina: Number(configuracion.cobra_propina),
          porcentaje_propina: Number(configuracion.porcentaje_propina || 0),
          imprime_comanda: Number(configuracion.imprime_comanda),
          imprime_ticket: Number(configuracion.imprime_ticket),
          moneda: configuracion.moneda || 'Q'
        },
        getConfig()
      );

      Swal.fire('Guardado', 'Configuración actualizada correctamente', 'success');

      cargarConfiguracion();

    } catch (error) {
      console.error('Error guardando configuración:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo guardar la configuración',
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

          <div className="container-fluid configuracion-container">

            <div className="configuracion-header mt-4">
              <div>
                <span className="configuracion-badge">Administración</span>
                <h2>Configuración</h2>
                <p>
                  Administra los datos generales del restaurante y opciones de operación.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-configuracion-refresh"
                onClick={cargarConfiguracion}
                disabled={cargando}
              >
                {cargando ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>

            <div className="configuracion-layout mt-4">

              <section className="configuracion-card">
                <h4>Datos del restaurante</h4>

                <form onSubmit={guardarRestaurante}>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label>Nombre del restaurante *</label>
                      <input
                        type="text"
                        name="nombre"
                        className="form-control"
                        value={restaurante.nombre}
                        onChange={handleRestauranteChange}
                        placeholder="Nombre del restaurante"
                      />
                    </div>

                    <div className="col-md-6 mb-3">
                      <label>Teléfono</label>
                      <input
                        type="text"
                        name="telefono"
                        className="form-control"
                        value={restaurante.telefono}
                        onChange={handleRestauranteChange}
                        placeholder="Teléfono"
                      />
                    </div>

                    <div className="col-md-6 mb-3">
                      <label>NIT</label>
                      <input
                        type="text"
                        name="nit"
                        className="form-control"
                        value={restaurante.nit}
                        onChange={handleRestauranteChange}
                        placeholder="CF"
                      />
                    </div>

                    <div className="col-md-6 mb-3">
                      <label>Logo URL</label>
                      <input
                        type="text"
                        name="logo"
                        className="form-control"
                        value={restaurante.logo}
                        onChange={handleRestauranteChange}
                        placeholder="URL del logo"
                      />
                    </div>

                    <div className="col-md-12 mb-3">
                      <label>Dirección</label>
                      <input
                        type="text"
                        name="direccion"
                        className="form-control"
                        value={restaurante.direccion}
                        onChange={handleRestauranteChange}
                        placeholder="Dirección del restaurante"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-configuracion-save"
                    disabled={cargando}
                  >
                    Guardar datos
                  </button>
                </form>
              </section>

              <section className="configuracion-card">
                <h4>Opciones generales</h4>

                <form onSubmit={guardarOpciones}>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label>Moneda</label>
                      <select
                        name="moneda"
                        className="form-control"
                        value={configuracion.moneda}
                        onChange={handleConfiguracionChange}
                      >
                        <option value="Q">Quetzal - Q</option>
                        <option value="$">Dólar - $</option>
                        <option value="L">Lempira - L</option>
                        <option value="₡">Colón - ₡</option>
                      </select>
                    </div>

                    <div className="col-md-6 mb-3">
                      <label>Porcentaje propina</label>
                      <input
                        type="number"
                        name="porcentaje_propina"
                        className="form-control"
                        value={configuracion.porcentaje_propina}
                        onChange={handleConfiguracionChange}
                        min="0"
                        step="0.01"
                      />
                    </div>

                    <div className="col-md-12">
                      <label className="configuracion-check">
                        <input
                          type="checkbox"
                          name="cobra_propina"
                          checked={Number(configuracion.cobra_propina) === 1}
                          onChange={handleConfiguracionChange}
                        />
                        Cobrar propina automáticamente
                      </label>
                    </div>

                    <div className="col-md-12">
                      <label className="configuracion-check">
                        <input
                          type="checkbox"
                          name="imprime_comanda"
                          checked={Number(configuracion.imprime_comanda) === 1}
                          onChange={handleConfiguracionChange}
                        />
                        Imprimir comanda en cocina
                      </label>
                    </div>

                    <div className="col-md-12">
                      <label className="configuracion-check">
                        <input
                          type="checkbox"
                          name="imprime_ticket"
                          checked={Number(configuracion.imprime_ticket) === 1}
                          onChange={handleConfiguracionChange}
                        />
                        Imprimir ticket en caja
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-configuracion-save mt-3"
                    disabled={cargando}
                  >
                    Guardar configuración
                  </button>
                </form>
              </section>

            </div>

            <div className="configuracion-info mt-4">
              <h4>Información importante</h4>

              <p>
                La configuración de propina puede usarse después para calcular automáticamente
                el total del pedido. Las opciones de impresión quedan preparadas para cuando
                conectes impresora térmica o comandas de cocina.
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default Configuracion;