import React, { useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import AuthContext from './AuthContext';
import './MenuVisual.css';

const URL = process.env.REACT_APP_URL_BACKEND || 'http://localhost:3001';

function MenuVisual() {
  const { token, logout, user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [cargando, setCargando] = useState(false);
  const [productos, setProductos] = useState([]);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const [categoriaActualIndex, setCategoriaActualIndex] = useState(0);

  const [restaurante, setRestaurante] = useState({
    nombre: user?.nombre_restaurante || 'Restaurante',
    descripcion: '',
    logo: null
  });

  const authToken = token || localStorage.getItem('token');

  const getConfig = () => ({
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const activarPantallaCompleta = async () => {
    try {
      const elemento = document.documentElement;

      if (elemento.requestFullscreen) {
        await elemento.requestFullscreen();
      } else if (elemento.webkitRequestFullscreen) {
        await elemento.webkitRequestFullscreen();
      } else if (elemento.msRequestFullscreen) {
        await elemento.msRequestFullscreen();
      }

      setPantallaCompleta(true);

    } catch (error) {
      console.error('Error activando pantalla completa:', error);

      Swal.fire(
        'No se pudo activar',
        'El navegador no permitió activar pantalla completa.',
        'warning'
      );
    }
  };

  const salirPantallaCompleta = async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        await document.msExitFullscreen();
      }

      setPantallaCompleta(false);

    } catch (error) {
      console.error('Error saliendo de pantalla completa:', error);
    }
  };

  const cargarRestaurante = async () => {
    try {
      const response = await axios.get(
        `${URL}/mi-restaurante`,
        getConfig()
      );

      const data = response.data || {};

      setRestaurante({
        nombre:
          data.nombre ||
          data.nombre_restaurante ||
          user?.nombre_restaurante ||
          'Restaurante',
        descripcion: data.descripcion || '',
        logo: data.logo || null
      });

    } catch (error) {
      console.error('Error cargando datos del restaurante:', error);

      setRestaurante({
        nombre: user?.nombre_restaurante || 'Restaurante',
        descripcion: '',
        logo: null
      });
    }
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
      console.error('Error cargando menú visual:', error);

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
    cargarRestaurante();
    cargarMenu();

    const intervalo = setInterval(() => {
      cargarRestaurante();
      cargarMenu();
    }, 60000);

    return () => clearInterval(intervalo);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const detectarCambioPantalla = () => {
      const estaEnPantallaCompleta =
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement;

      setPantallaCompleta(Boolean(estaEnPantallaCompleta));
    };

    document.addEventListener('fullscreenchange', detectarCambioPantalla);
    document.addEventListener('webkitfullscreenchange', detectarCambioPantalla);
    document.addEventListener('msfullscreenchange', detectarCambioPantalla);

    return () => {
      document.removeEventListener('fullscreenchange', detectarCambioPantalla);
      document.removeEventListener('webkitfullscreenchange', detectarCambioPantalla);
      document.removeEventListener('msfullscreenchange', detectarCambioPantalla);
    };
  }, []);

  useEffect(() => {
    document.body.classList.add('menu-tv-body');

    return () => {
      document.body.classList.remove('menu-tv-body');
    };
  }, []);

  const menuAgrupado = useMemo(() => {
    const grupos = {};

    productos.forEach((producto) => {
      const categoria = producto.categoria || 'Menú';

      if (!grupos[categoria]) {
        grupos[categoria] = [];
      }

      grupos[categoria].push(producto);
    });

    return grupos;
  }, [productos]);

  const categoriasConProductos = useMemo(() => {
    return Object.keys(menuAgrupado).filter(
      (categoria) => menuAgrupado[categoria]?.length > 0
    );
  }, [menuAgrupado]);

  const categoriaActual = categoriasConProductos[categoriaActualIndex] || null;
  const productosCategoriaActual = categoriaActual
    ? menuAgrupado[categoriaActual] || []
    : [];

  useEffect(() => {
    if (categoriasConProductos.length === 0) {
      setCategoriaActualIndex(0);
      return;
    }

    if (categoriaActualIndex >= categoriasConProductos.length) {
      setCategoriaActualIndex(0);
    }
  }, [categoriasConProductos, categoriaActualIndex]);

  useEffect(() => {
    if (categoriasConProductos.length <= 1) return;

    const intervaloCategorias = setInterval(() => {
      setCategoriaActualIndex((prevIndex) => {
        const siguiente = prevIndex + 1;

        if (siguiente >= categoriasConProductos.length) {
          return 0;
        }

        return siguiente;
      });
    }, 12000);

    return () => clearInterval(intervaloCategorias);
  }, [categoriasConProductos.length]);

  const irCategoriaAnterior = () => {
    if (categoriasConProductos.length === 0) return;

    setCategoriaActualIndex((prevIndex) => {
      if (prevIndex === 0) {
        return categoriasConProductos.length - 1;
      }

      return prevIndex - 1;
    });
  };

  const irCategoriaSiguiente = () => {
    if (categoriasConProductos.length === 0) return;

    setCategoriaActualIndex((prevIndex) => {
      const siguiente = prevIndex + 1;

      if (siguiente >= categoriasConProductos.length) {
        return 0;
      }

      return siguiente;
    });
  };

  const formatearMoneda = (valor) => {
    return `Q${Number(valor || 0).toFixed(2)}`;
  };

  const obtenerImagenProducto = (producto) => {
    if (!producto.imagen) {
      return null;
    }

    if (producto.imagen.startsWith('http')) {
      return producto.imagen;
    }

    return `${URL}${producto.imagen}`;
  };

  const obtenerLogoRestaurante = () => {
    if (!restaurante.logo) {
      return null;
    }

    if (restaurante.logo.startsWith('http')) {
      return restaurante.logo;
    }

    return `${URL}${restaurante.logo}`;
  };

  const logoRestaurante = obtenerLogoRestaurante();

  return (
    <div className="menu-tv-page">

      <div className="menu-tv-actions">
        {!pantallaCompleta ? (
          <button
            type="button"
            className="btn-fullscreen-tv"
            onClick={activarPantallaCompleta}
          >
            Pantalla completa
          </button>
        ) : (
          <button
            type="button"
            className="btn-exit-fullscreen-tv"
            onClick={salirPantallaCompleta}
          >
            Salir
          </button>
        )}

        <button
          type="button"
          className="menu-tv-logout"
          onClick={handleLogout}
        >
          Cerrar sesión
        </button>
      </div>

      <header className="menu-tv-header">
        <div>
          {logoRestaurante && (
            <img
              src={logoRestaurante}
              alt={restaurante.nombre}
              className="menu-tv-logo-restaurante"
            />
          )}

          <span>Restaurante</span>

          <h1>{restaurante.nombre}</h1>

          <p>
            {restaurante.descripcion
              ? restaurante.descripcion
              : 'Menú de productos disponibles'}
          </p>
        </div>
      </header>

      {cargando && productos.length === 0 && (
        <div className="menu-tv-empty">
          Cargando menú...
        </div>
      )}

      {!cargando && productos.length === 0 && (
        <div className="menu-tv-empty">
          No hay productos disponibles.
        </div>
      )}

      {productos.length > 0 && categoriaActual && (
        <main className="menu-tv-content menu-tv-content-slider">

          <div className="menu-tv-slider-top">
            <button
              type="button"
              className="menu-tv-slider-btn"
              onClick={irCategoriaAnterior}
              disabled={categoriasConProductos.length <= 1}
            >
              ‹
            </button>

            <div className="menu-tv-current-category">
              <span>
                Categoría {categoriaActualIndex + 1} de {categoriasConProductos.length}
              </span>
              <h2>{categoriaActual}</h2>
              <p>
                {productosCategoriaActual.length} productos disponibles
              </p>
            </div>

            <button
              type="button"
              className="menu-tv-slider-btn"
              onClick={irCategoriaSiguiente}
              disabled={categoriasConProductos.length <= 1}
            >
              ›
            </button>
          </div>

          <section
            key={categoriaActual}
            className="menu-tv-section menu-tv-section-active"
          >
            <div className="menu-tv-grid">
              {productosCategoriaActual.map((producto) => {
                const imagenProducto = obtenerImagenProducto(producto);

                return (
                  <article key={producto.id_producto} className="menu-tv-card">
                    <div className="menu-tv-image-box">
                      {imagenProducto ? (
                        <img
                          src={imagenProducto}
                          alt={producto.nombre}
                          className="menu-tv-image"
                        />
                      ) : (
                        <div className="menu-tv-no-image">
                          <span>🍽️</span>
                        </div>
                      )}
                    </div>

                    <div className="menu-tv-info">
                      <h3>{producto.nombre}</h3>

                      {producto.descripcion && (
                        <p>{producto.descripcion}</p>
                      )}

                      <strong>{formatearMoneda(producto.precio)}</strong>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {categoriasConProductos.length > 1 && (
            <div className="menu-tv-dots">
              {categoriasConProductos.map((categoria, index) => (
                <button
                  key={categoria}
                  type="button"
                  className={`menu-tv-dot ${index === categoriaActualIndex ? 'activo' : ''}`}
                  onClick={() => setCategoriaActualIndex(index)}
                  title={categoria}
                >
                  <span></span>
                </button>
              ))}
            </div>
          )}

        </main>
      )}

    </div>
  );
}

export default MenuVisual;