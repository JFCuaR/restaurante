import React, { useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import AuthContext from './AuthContext';
import Sidebar from './sidebar';
import Navbar from './Navbar';
import './MenuRestaurante.css';

const URL = process.env.REACT_APP_URL_BACKEND || 'http://localhost:3001';

function MenuRestaurante() {
  const { token, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('TODAS');

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

  const cargarMenu = async () => {
    try {
      setCargando(true);

      const response = await axios.get(
        `${URL}/menu-restaurante`,
        getConfig()
      );

      setProductos(response.data || []);

    } catch (error) {
      console.error('Error cargando menú:', error);

      if (error.response?.status === 401 || error.response?.status === 403) {
        Swal.fire('Sesión vencida', 'Inicia sesión nuevamente', 'warning');
        logout();
        navigate('/login');
        return;
      }

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo cargar el menú',
        'error'
      );

    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categorias = useMemo(() => {
    const lista = [...new Set(
      productos
        .map((item) => item.categoria || 'Sin categoría')
        .filter(Boolean)
    )];

    return ['TODAS', ...lista];
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    return productos.filter((item) => {
      const categoriaOk =
        categoriaSeleccionada === 'TODAS'
          ? true
          : (item.categoria || 'Sin categoría') === categoriaSeleccionada;

      const texto = `
        ${item.nombre || ''}
        ${item.descripcion || ''}
        ${item.categoria || ''}
      `.toLowerCase();

      const busquedaOk = texto.includes(busqueda.toLowerCase());

      return categoriaOk && busquedaOk;
    });
  }, [productos, busqueda, categoriaSeleccionada]);

  const menuAgrupado = useMemo(() => {
    const grupos = {};

    productosFiltrados.forEach((item) => {
      const categoria = item.categoria || 'Sin categoría';

      if (!grupos[categoria]) {
        grupos[categoria] = [];
      }

      grupos[categoria].push(item);
    });

    return grupos;
  }, [productosFiltrados]);

  const formatearMoneda = (valor) => {
    return `Q${Number(valor || 0).toFixed(2)}`;
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

          <div className="container-fluid menu-restaurante-container">

            <div className="menu-restaurante-header mt-4">
              <div>
                <span className="menu-restaurante-badge">Restaurante</span>
                <h2>Menú del restaurante</h2>
                <p>
                  Visualiza los productos y menús disponibles organizados por categoría.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-menu-restaurante-refresh"
                onClick={cargarMenu}
                disabled={cargando}
              >
                {cargando ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>

            <div className="menu-restaurante-toolbar mt-4">
              <div className="menu-restaurante-search">
                <label>Buscar producto</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ej. Hamburguesa, bebida, pizza..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
            </div>

            <div className="menu-categorias mt-4">
              {categorias.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`menu-categoria-btn ${categoriaSeleccionada === cat ? 'active' : ''}`}
                  onClick={() => setCategoriaSeleccionada(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {cargando && productos.length === 0 && (
              <div className="menu-empty mt-4">
                Cargando menú...
              </div>
            )}

            {!cargando && productosFiltrados.length === 0 && (
              <div className="menu-empty mt-4">
                No hay productos disponibles para mostrar.
              </div>
            )}

            {!cargando && productosFiltrados.length > 0 && (
              <div className="menu-secciones mt-4">
                {Object.keys(menuAgrupado).map((categoria) => (
                  <section key={categoria} className="menu-seccion">
                    <div className="menu-seccion-header">
                      <h3>{categoria}</h3>
                      <span>{menuAgrupado[categoria].length} producto(s)</span>
                    </div>

                    <div className="menu-grid">
                      {menuAgrupado[categoria].map((producto) => (
                        <div key={producto.id_producto} className="menu-card">
                          <div className="menu-card-image">
                            {producto.imagen ? (
                              <img
                                src={producto.imagen}
                                alt={producto.nombre}
                              />
                            ) : (
                              <div className="menu-card-placeholder">
                                🍽️
                              </div>
                            )}
                          </div>

                          <div className="menu-card-body">
                            <div className="menu-card-top">
                              <h4>{producto.nombre}</h4>
                              <span>{formatearMoneda(producto.precio)}</span>
                            </div>

                            <p>
                              {producto.descripcion || 'Sin descripción disponible'}
                            </p>

                            <div className="menu-card-footer">
                              <span className="menu-card-categoria">
                                {producto.categoria || 'Sin categoría'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}

export default MenuRestaurante;