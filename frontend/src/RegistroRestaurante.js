import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import './RegistroRestaurante.css';
import logo from './logo.png';

const URL = process.env.REACT_APP_URL_BACKEND || 'http://localhost:3001';

function RegistroRestaurante() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    nombre_restaurante: '',
    propietario: '',
    telefono: '',
    correo: '',
    direccion: '',
    nit: 'CF',
    tipo_restaurante: '',
    descripcion: '',
    nombre_admin: '',
    usuario: '',
    password: '',
    confirmar_password: ''
  });

  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData({
      ...formData,
      [name]: value
    });
  };

  const validarFormulario = () => {
    if (!formData.nombre_restaurante.trim()) {
      setMensaje({
        type: 'warning',
        text: 'Debes ingresar el nombre del restaurante.'
      });
      return false;
    }

    if (!formData.propietario.trim()) {
      setMensaje({
        type: 'warning',
        text: 'Debes ingresar el nombre del propietario.'
      });
      return false;
    }

    if (!formData.telefono.trim()) {
      setMensaje({
        type: 'warning',
        text: 'Debes ingresar un número de teléfono.'
      });
      return false;
    }

    if (!formData.nombre_admin.trim()) {
      setMensaje({
        type: 'warning',
        text: 'Debes ingresar el nombre del administrador.'
      });
      return false;
    }

    if (!formData.usuario.trim()) {
      setMensaje({
        type: 'warning',
        text: 'Debes ingresar un usuario para iniciar sesión.'
      });
      return false;
    }

    if (!formData.password.trim()) {
      setMensaje({
        type: 'warning',
        text: 'Debes ingresar una contraseña.'
      });
      return false;
    }

    if (formData.password.length < 8) {
      setMensaje({
        type: 'warning',
        text: 'La contraseña debe tener al menos 8 caracteres.'
      });
      return false;
    }

    if (formData.password !== formData.confirmar_password) {
      setMensaje({
        type: 'warning',
        text: 'Las contraseñas no coinciden.'
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje(null);

    if (!validarFormulario()) return;

    try {
      setCargando(true);

      const datosRegistro = {
        nombre_restaurante: formData.nombre_restaurante.trim(),
        propietario: formData.propietario.trim(),
        telefono: formData.telefono.trim(),
        correo: formData.correo.trim(),
        direccion: formData.direccion.trim(),
        nit: formData.nit.trim() || 'CF',
        tipo_restaurante: formData.tipo_restaurante,
        descripcion: formData.descripcion.trim(),
        nombre_admin: formData.nombre_admin.trim(),
        usuario: formData.usuario.trim(),
        password: formData.password
      };

      const response = await axios.post(`${URL}/registro-restaurante`, datosRegistro);

      setMensaje({
        type: 'success',
        text: response.data.mensaje || 'Restaurante registrado correctamente.'
      });

      setTimeout(() => {
        navigate('/login');
      }, 1800);

    } catch (error) {
      console.error('Error al registrar restaurante:', error);

      setMensaje({
        type: 'danger',
        text: error.response?.data?.mensaje || 'No se pudo registrar el restaurante.'
      });

    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="registro-page">
      <div className="registro-light light-one"></div>
      <div className="registro-light light-two"></div>
      <div className="registro-light light-three"></div>

      <div className="registro-wrapper">
        <section className="registro-info">
          <div className="registro-brand">
            <img src={logo} alt="JFCuaR Logo" className="brand-logo" />
            <div>
              <h2>JFCuaR</h2>
              <span>Software</span>
            </div>
          </div>

          <span className="registro-badge">
            Sistema para restaurantes
          </span>

          <h1>Crea tu restaurante y empieza a controlar tus pedidos</h1>

          <p>
            Registra tu restaurante para administrar mesas, pedidos, cocina,
            caja, productos, pagos y reportes desde una plataforma moderna,
            rápida y fácil de usar.
          </p>

          <div className="registro-beneficios">
            <div>
              <strong>🍽️</strong>
              <h3>Mesas</h3>
              <span>Controla mesas libres, ocupadas y reservadas.</span>
            </div>

            <div>
              <strong>👨‍🍳</strong>
              <h3>Cocina</h3>
              <span>Envía pedidos directamente al área de cocina.</span>
            </div>

            <div>
              <strong>💵</strong>
              <h3>Caja</h3>
              <span>Registra pagos, cobros y ventas del día.</span>
            </div>
          </div>
        </section>

        <section className="registro-card">
          <div className="registro-card-header">
            <span>Nuevo registro</span>
            <h2>Registro de restaurante</h2>
            <p>Completa la información para crear tu cuenta.</p>
          </div>

          {mensaje && (
            <div className={`registro-alert registro-alert-${mensaje.type}`} role="alert">
              {mensaje.text}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-section-title">
              <h5>Datos del restaurante</h5>
              <span>Información principal del negocio</span>
            </div>

            <div className="registro-grid">
              <div className="form-group">
                <label>Nombre del restaurante *</label>
                <input
                  type="text"
                  name="nombre_restaurante"
                  value={formData.nombre_restaurante}
                  onChange={handleChange}
                  placeholder="Ej. Restaurante El Buen Sabor"
                  required
                />
              </div>

              <div className="form-group">
                <label>Propietario *</label>
                <input
                  type="text"
                  name="propietario"
                  value={formData.propietario}
                  onChange={handleChange}
                  placeholder="Nombre del propietario"
                  required
                />
              </div>

              <div className="form-group">
                <label>Teléfono *</label>
                <input
                  type="text"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  placeholder="Ej. 5555-5555"
                  required
                />
              </div>

              <div className="form-group">
                <label>Correo</label>
                <input
                  type="email"
                  name="correo"
                  value={formData.correo}
                  onChange={handleChange}
                  placeholder="correo@restaurante.com"
                />
              </div>

              <div className="form-group">
                <label>NIT</label>
                <input
                  type="text"
                  name="nit"
                  value={formData.nit}
                  onChange={handleChange}
                  placeholder="CF"
                />
              </div>

              <div className="form-group">
                <label>Tipo de restaurante</label>
                <select
                  name="tipo_restaurante"
                  value={formData.tipo_restaurante}
                  onChange={handleChange}
                >
                  <option value="">Selecciona una opción</option>
                  <option value="Comida rápida">Comida rápida</option>
                  <option value="Restaurante familiar">Restaurante familiar</option>
                  <option value="Cafetería">Cafetería</option>
                  <option value="Bar restaurante">Bar restaurante</option>
                  <option value="Comedor">Comedor</option>
                  <option value="Pizzería">Pizzería</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div className="form-group full">
                <label>Dirección</label>
                <input
                  type="text"
                  name="direccion"
                  value={formData.direccion}
                  onChange={handleChange}
                  placeholder="Dirección del restaurante"
                />
              </div>

              <div className="form-group full">
                <label>Descripción</label>
                <input
                  type="text"
                  name="descripcion"
                  value={formData.descripcion}
                  onChange={handleChange}
                  placeholder="Breve descripción del restaurante"
                />
              </div>
            </div>

            <div className="registro-divider"></div>

            <div className="form-section-title">
              <h5>Usuario administrador</h5>
              <span>Datos para iniciar sesión</span>
            </div>

            <div className="registro-grid">
              <div className="form-group">
                <label>Nombre del administrador *</label>
                <input
                  type="text"
                  name="nombre_admin"
                  value={formData.nombre_admin}
                  onChange={handleChange}
                  placeholder="Nombre completo"
                  required
                />
              </div>

              <div className="form-group">
                <label>Usuario para iniciar sesión *</label>
                <input
                  type="text"
                  name="usuario"
                  value={formData.usuario}
                  onChange={handleChange}
                  placeholder="Ej. restaurante_admin"
                  required
                />
              </div>

              <div className="form-group">
                <label>Contraseña *</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Mínimo 8 caracteres"
                  required
                />
              </div>

              <div className="form-group">
                <label>Confirmar contraseña *</label>
                <input
                  type="password"
                  name="confirmar_password"
                  value={formData.confirmar_password}
                  onChange={handleChange}
                  placeholder="Repite la contraseña"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-registro"
              disabled={cargando}
            >
              {cargando ? 'Creando restaurante...' : 'Crear mi restaurante'}
            </button>

            <div className="login-link">
              ¿Ya tienes una cuenta? <Link to="/login">Inicia sesión</Link>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

export default RegistroRestaurante;