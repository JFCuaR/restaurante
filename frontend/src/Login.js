import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthContext from './AuthContext';
import axios from 'axios';
import logo from './logo.png';
import './Login.css';

const URL = process.env.REACT_APP_URL_BACKEND || 'http://localhost:3001';

const Login = () => {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!usuario.trim() || !password.trim()) {
      alert('Debes ingresar usuario y contraseña');
      return;
    }

    try {
      setCargando(true);

      const response = await axios.post(`${URL}/login`, {
        usuario: usuario.trim(),
        password
      });

      if (response.data.token) {
        const token = response.data.token;
        const usuarioData = response.data.usuario;

        const user = {
          id: usuarioData.id_usuario,
          id_usuario: usuarioData.id_usuario,
          id_restaurante: usuarioData.id_restaurante,
          nombre: usuarioData.nombre,
          usuario: usuarioData.usuario,
          rol: usuarioData.rol,
          nombre_restaurante: usuarioData.nombre_restaurante
        };

        login(token, user);

        if (
          user.rol === 'ADMINISTRADOR' ||
          user.rol === 'GERENTE' ||
          user.rol === 'CAJA' ||
          user.rol === 'MESERO'
        ) {
          navigate('/Home');
        } else if (user.rol === 'COCINA') {
          navigate('/cocina');
        } else {
          alert('Rol desconocido, contacta con el administrador');
        }
      }

    } catch (error) {
      console.error('Error al iniciar sesión:', error);

      if (error.response) {
        if (error.response.status === 401) {
          alert('Usuario o contraseña incorrectos');
        } else if (error.response.status === 403) {
          alert(error.response.data?.mensaje || 'Cuenta o restaurante desactivado');
        } else if (error.response.status === 429) {
          alert('Demasiados intentos de login. Intenta más tarde.');
        } else {
          alert(error.response.data?.mensaje || 'Error del servidor');
        }
      } else {
        alert('No se pudo conectar con el servidor');
      }

    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-light light-one"></div>
      <div className="login-bg-light light-two"></div>
      <div className="login-bg-light light-three"></div>

      <div className="login-wrapper">

        <div className="login-info">
          <div className="brand-box">
            <img src={logo} alt="JFCuaR Logo" className="brand-logo" />

            <div>
              <h2>JFCuaR</h2>
              <span>Software</span>
            </div>
          </div>

          <span className="login-badge">
            Sistema de gestión para restaurantes
          </span>

          <h1>
            Controla mesas, pedidos, cocina y caja desde un solo lugar
          </h1>

          <p>
            Administra tu restaurante de forma moderna y segura. Lleva el control
            de mesas, productos, pedidos en cocina, cobros, pagos y reportes diarios.
          </p>

          <div className="login-features">
            <div>
              <strong>🍽️</strong>
              <span>Mesas</span>
            </div>

            <div>
              <strong>🧾</strong>
              <span>Pedidos</span>
            </div>

            <div>
              <strong>👨‍🍳</strong>
              <span>Cocina</span>
            </div>

            <div>
              <strong>💵</strong>
              <span>Caja</span>
            </div>
          </div>
        </div>

        <div className="login-card">
          <div className="image-container">
            <img src={logo} alt="logo" className="login-logo" />
          </div>

          <div className="login-card-header">
            <h2>Bienvenido</h2>
            <p>Ingresa tus datos para acceder al restaurante</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="usuario">
                Usuario
              </label>

              <input
                type="text"
                id="usuario"
                placeholder="Ingresa tu usuario"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">
                Contraseña
              </label>

              <input
                type="password"
                id="password"
                placeholder="Ingresa tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              className="btn-login-submit"
              disabled={cargando}
            >
              {cargando ? 'Ingresando...' : 'Ingresar al sistema'}
            </button>

            <button
              type="button"
              className="btn-link-recuperar"
              onClick={() => navigate('/recuperar-acceso')}
              disabled={cargando}
            >
              ¿Olvidaste tu usuario o contraseña?
            </button>

            <div className="register-link">
              <span>¿No tienes restaurante registrado?</span>
              <Link to="/registro-restaurante">
                Crear mi restaurante
              </Link>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
};

export default Login;