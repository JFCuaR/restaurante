import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import AuthContext from './AuthContext';
import Sidebar from './sidebar';
import Navbar from './Navbar';
import './Productos.css';

const URL = process.env.REACT_APP_URL_BACKEND || 'http://localhost:3001';

function Productos() {
  const { token, logout, user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const [formulario, setFormulario] = useState({
    id_producto: null,
    id_categoria: '',
    nombre: '',
    descripcion: '',
    precio: '',
    costo: '',
    imagen: '',
    maneja_inventario: false,
    stock: '',
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

  const cargarDatos = async () => {
    try {
      setCargando(true);

      const [productosRes, categoriasRes] = await Promise.all([
        axios.get(`${URL}/productos`, getConfig()),
        axios.get(`${URL}/categorias`, getConfig())
      ]);

      setProductos(productosRes.data || []);
      setCategorias(categoriasRes.data || []);

    } catch (error) {
      console.error('Error cargando productos:', error);

      if (error.response?.status === 401 || error.response?.status === 403) {
        Swal.fire('Sesión vencida', 'Inicia sesión nuevamente', 'warning');
        logout();
        navigate('/login');
        return;
      }

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudieron cargar los productos',
        'error'
      );

    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const limpiarFormulario = () => {
    setFormulario({
      id_producto: null,
      id_categoria: '',
      nombre: '',
      descripcion: '',
      precio: '',
      costo: '',
      imagen: '',
      maneja_inventario: false,
      stock: '',
      estado: 1
    });

    setModoEditar(false);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormulario({
      ...formulario,
      [name]: type === 'checkbox' ? checked : value
    });
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

  const guardarProducto = async (e) => {
    e.preventDefault();

    if (!formulario.nombre.trim()) {
      Swal.fire('Campo obligatorio', 'Ingresa el nombre del producto', 'warning');
      return;
    }

    if (formulario.precio === '' || Number(formulario.precio) < 0) {
      Swal.fire('Precio inválido', 'Ingresa un precio válido', 'warning');
      return;
    }

    if (
      formulario.imagen.trim() &&
      !formulario.imagen.trim().startsWith('http://') &&
      !formulario.imagen.trim().startsWith('https://') &&
      !formulario.imagen.trim().startsWith('/uploads/')
    ) {
      Swal.fire(
        'Link de imagen inválido',
        'Ingresa un link que inicie con http://, https:// o /uploads/',
        'warning'
      );
      return;
    }

    try {
      setCargando(true);

      const datos = {
        id_categoria: formulario.id_categoria || null,
        nombre: formulario.nombre.trim(),
        descripcion: formulario.descripcion.trim(),
        precio: Number(formulario.precio),
        costo: Number(formulario.costo || 0),
        imagen: formulario.imagen.trim() || null,
        maneja_inventario: formulario.maneja_inventario,
        stock: Number(formulario.stock || 0),
        estado: Number(formulario.estado)
      };

      if (modoEditar) {
        await axios.put(
          `${URL}/productos/${formulario.id_producto}`,
          datos,
          getConfig()
        );

        Swal.fire('Actualizado', 'Producto actualizado correctamente', 'success');
      } else {
        await axios.post(
          `${URL}/productos`,
          datos,
          getConfig()
        );

        Swal.fire('Creado', 'Producto creado correctamente', 'success');
      }

      limpiarFormulario();
      cargarDatos();

    } catch (error) {
      console.error('Error guardando producto:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo guardar el producto',
        'error'
      );

    } finally {
      setCargando(false);
    }
  };

  const editarProducto = (producto) => {
    setModoEditar(true);

    setFormulario({
      id_producto: producto.id_producto,
      id_categoria: producto.id_categoria || '',
      nombre: producto.nombre || '',
      descripcion: producto.descripcion || '',
      precio: producto.precio || '',
      costo: producto.costo || '',
      imagen: producto.imagen || '',
      maneja_inventario: Number(producto.maneja_inventario) === 1,
      stock: producto.stock || '',
      estado: Number(producto.estado)
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cambiarEstado = async (producto) => {
    const nuevoEstado = Number(producto.estado) === 1 ? 0 : 1;

    try {
      await axios.patch(
        `${URL}/productos/${producto.id_producto}/estado`,
        { estado: nuevoEstado },
        getConfig()
      );

      cargarDatos();

    } catch (error) {
      console.error('Error cambiando estado:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo cambiar el estado',
        'error'
      );
    }
  };

  const eliminarProducto = async (producto) => {
    const result = await Swal.fire({
      title: '¿Eliminar producto?',
      text: `Se eliminará "${producto.nombre}"`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280'
    });

    if (!result.isConfirmed) return;

    try {
      await axios.delete(`${URL}/productos/${producto.id_producto}`, getConfig());

      Swal.fire('Eliminado', 'Producto eliminado correctamente', 'success');

      cargarDatos();

    } catch (error) {
      console.error('Error eliminando producto:', error);

      Swal.fire(
        'No se pudo eliminar',
        error.response?.data?.mensaje || 'No se pudo eliminar el producto',
        'warning'
      );
    }
  };

  const productosFiltrados = productos.filter((producto) => {
    const texto = `${producto.nombre || ''} ${producto.categoria || ''} ${producto.descripcion || ''}`.toLowerCase();
    return texto.includes(busqueda.toLowerCase());
  });

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

          <div className="container-fluid productos-container">

            <div className="productos-header mt-4">
              <div>
                <span className="productos-badge">Menú del restaurante</span>
                <h2>Productos</h2>
                <p>
                  Administra los productos del menú, precios, costos, categorías, imágenes y disponibilidad.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-productos-refresh"
                onClick={cargarDatos}
                disabled={cargando}
              >
                {cargando ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>

            {puedeAdministrar && (
              <div className="productos-form-card mt-4">
                <h4>{modoEditar ? 'Editar producto' : 'Crear nuevo producto'}</h4>

                <form onSubmit={guardarProducto}>
                  <div className="row">
                    <div className="col-md-3 mb-3">
                      <label>Nombre *</label>
                      <input
                        type="text"
                        name="nombre"
                        className="form-control"
                        value={formulario.nombre}
                        onChange={handleChange}
                        placeholder="Ej. Hamburguesa"
                      />
                    </div>

                    <div className="col-md-3 mb-3">
                      <label>Categoría</label>
                      <select
                        name="id_categoria"
                        className="form-control"
                        value={formulario.id_categoria}
                        onChange={handleChange}
                      >
                        <option value="">Sin categoría</option>
                        {categorias.map((categoria) => (
                          <option
                            key={categoria.id_categoria}
                            value={categoria.id_categoria}
                          >
                            {categoria.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-2 mb-3">
                      <label>Precio *</label>
                      <input
                        type="number"
                        name="precio"
                        className="form-control"
                        value={formulario.precio}
                        onChange={handleChange}
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                      />
                    </div>

                    <div className="col-md-2 mb-3">
                      <label>Costo</label>
                      <input
                        type="number"
                        name="costo"
                        className="form-control"
                        value={formulario.costo}
                        onChange={handleChange}
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                      />
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

                    <div className="col-md-6 mb-3">
                      <label>Descripción</label>
                      <input
                        type="text"
                        name="descripcion"
                        className="form-control"
                        value={formulario.descripcion}
                        onChange={handleChange}
                        placeholder="Descripción del producto"
                      />
                    </div>

                    <div className="col-md-6 mb-3">
                      <label>Link de imagen para el menú</label>
                      <input
                        type="text"
                        name="imagen"
                        className="form-control"
                        value={formulario.imagen}
                        onChange={handleChange}
                        placeholder="https://ejemplo.com/imagen.jpg"
                      />
                      <small className="text-muted">
                        Puedes usar un link de internet o una ruta local como /uploads/productos/imagen.jpg
                      </small>
                    </div>

                    {formulario.imagen && (
                      <div className="col-md-12 mb-3">
                        <div className="producto-preview-imagen">
                          <span>Vista previa:</span>
                          <img
                            src={
                              formulario.imagen.startsWith('http')
                                ? formulario.imagen
                                : `${URL}${formulario.imagen}`
                            }
                            alt="Vista previa"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="col-md-3 mb-3">
                      <label>Stock</label>
                      <input
                        type="number"
                        name="stock"
                        className="form-control"
                        value={formulario.stock}
                        onChange={handleChange}
                        min="0"
                        step="0.01"
                        disabled={!formulario.maneja_inventario}
                      />
                    </div>

                    <div className="col-md-3 mb-3 d-flex align-items-end">
                      <label className="productos-check">
                        <input
                          type="checkbox"
                          name="maneja_inventario"
                          checked={formulario.maneja_inventario}
                          onChange={handleChange}
                        />
                        Maneja inventario
                      </label>
                    </div>
                  </div>

                  <div className="d-flex gap-2">
                    <button
                      type="submit"
                      className="btn btn-productos-save"
                      disabled={cargando}
                    >
                      {modoEditar ? 'Guardar cambios' : 'Crear producto'}
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

            <div className="productos-toolbar mt-4">
              <div>
                <h4>Listado de productos</h4>
                <span>{productosFiltrados.length} productos encontrados</span>
              </div>

              <input
                type="text"
                className="form-control productos-busqueda"
                placeholder="Buscar producto..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            <div className="productos-grid mt-4">
              {cargando && productos.length === 0 && (
                <div className="productos-empty">
                  Cargando productos...
                </div>
              )}

              {!cargando && productosFiltrados.length === 0 && (
                <div className="productos-empty">
                  No hay productos registrados.
                </div>
              )}

              {productosFiltrados.map((producto) => {
                const imagenProducto = obtenerImagenProducto(producto);

                return (
                  <div
                    key={producto.id_producto}
                    className={`producto-card ${Number(producto.estado) === 1 ? 'producto-activo' : 'producto-inactivo'}`}
                  >
                    <div className="producto-imagen-box">
                      {imagenProducto ? (
                        <img
                          src={imagenProducto}
                          alt={producto.nombre}
                          className="producto-imagen"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="producto-sin-imagen">
                          🍽️
                        </div>
                      )}
                    </div>

                    <div className="producto-card-top">
                      <div>
                        <span className="producto-categoria">
                          {producto.categoria || 'Sin categoría'}
                        </span>
                        <h3>{producto.nombre}</h3>
                      </div>

                      <span className={`producto-estado ${Number(producto.estado) === 1 ? 'estado-activo' : 'estado-inactivo'}`}>
                        {Number(producto.estado) === 1 ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>

                    <p className="producto-desc">
                      {producto.descripcion || 'Sin descripción'}
                    </p>

                    <div className="producto-precios">
                      <div>
                        <span>Precio</span>
                        <strong>{formatearMoneda(producto.precio)}</strong>
                      </div>

                      <div>
                        <span>Costo</span>
                        <strong>{formatearMoneda(producto.costo)}</strong>
                      </div>
                    </div>

                    <div className="producto-info">
                      <span>
                        Inventario: {Number(producto.maneja_inventario) === 1 ? 'Sí' : 'No'}
                      </span>

                      {Number(producto.maneja_inventario) === 1 && (
                        <span>
                          Stock: {Number(producto.stock || 0)}
                        </span>
                      )}
                    </div>

                    {puedeAdministrar && (
                      <div className="producto-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => editarProducto(producto)}
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          className={`btn btn-sm ${Number(producto.estado) === 1 ? 'btn-outline-warning' : 'btn-outline-success'}`}
                          onClick={() => cambiarEstado(producto)}
                        >
                          {Number(producto.estado) === 1 ? 'Desactivar' : 'Activar'}
                        </button>

                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => eliminarProducto(producto)}
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default Productos;