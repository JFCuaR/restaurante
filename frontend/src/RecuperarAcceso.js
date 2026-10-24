import React, { useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import logo from './logo.png';
import './RecuperarAcceso.css';

const URL = process.env.REACT_APP_URL_BACKEND || 'http://localhost:3001';

function RecuperarAcceso() {
  const navigate = useNavigate();

  const [paso, setPaso] = useState(1);
  const [cargando, setCargando] = useState(false);

  const [correo, setCorreo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [tokenTemporal, setTokenTemporal] = useState('');

  const [usuarioEncontrado, setUsuarioEncontrado] = useState('');
  const [nombreEncontrado, setNombreEncontrado] = useState('');

  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');

  const solicitarCodigo = async (e) => {
    e.preventDefault();

    if (!correo.trim()) {
      Swal.fire('Correo requerido', 'Ingresa tu correo electrónico', 'warning');
      return;
    }

    try {
      setCargando(true);

      const response = await axios.post(`${URL}/recuperar-acceso/solicitar`, {
        correo: correo.trim().toLowerCase()
      });

      Swal.fire(
        'Código enviado',
        response.data.mensaje || 'Si el correo está registrado, recibirás un código.',
        'success'
      );

      setPaso(2);

    } catch (error) {
      console.error('Error solicitando código:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo solicitar la recuperación',
        'error'
      );

    } finally {
      setCargando(false);
    }
  };

  const verificarCodigo = async (e) => {
    e.preventDefault();

    if (!codigo.trim()) {
      Swal.fire('Código requerido', 'Ingresa el código que recibiste por correo', 'warning');
      return;
    }

    if (codigo.trim().length < 6) {
      Swal.fire('Código inválido', 'El código debe tener 6 dígitos', 'warning');
      return;
    }

    try {
      setCargando(true);

      const response = await axios.post(`${URL}/recuperar-acceso/verificar`, {
        correo: correo.trim().toLowerCase(),
        codigo: codigo.trim()
      });

      setTokenTemporal(response.data.token_temporal);
      setUsuarioEncontrado(response.data.usuario || '');
      setNombreEncontrado(response.data.nombre || '');

      Swal.fire(
        'Código verificado',
        response.data.mensaje || 'Código verificado correctamente',
        'success'
      );

      setPaso(3);

    } catch (error) {
      console.error('Error verificando código:', error);

      Swal.fire(
        'Código inválido',
        error.response?.data?.mensaje || 'El código no es válido o ya expiró',
        'error'
      );

    } finally {
      setCargando(false);
    }
  };

  const cambiarPassword = async (e) => {
    e.preventDefault();

    if (!nuevaPassword || !confirmarPassword) {
      Swal.fire('Campos requeridos', 'Ingresa y confirma tu nueva contraseña', 'warning');
      return;
    }

    if (nuevaPassword.length < 8) {
      Swal.fire(
        'Contraseña débil',
        'La nueva contraseña debe tener al menos 8 caracteres',
        'warning'
      );
      return;
    }

    if (nuevaPassword !== confirmarPassword) {
      Swal.fire('No coinciden', 'Las contraseñas no coinciden', 'warning');
      return;
    }

    if (!tokenTemporal) {
      Swal.fire(
        'Sesión expirada',
        'Vuelve a solicitar un nuevo código de recuperación',
        'warning'
      );
      setPaso(1);
      return;
    }

    try {
      setCargando(true);

      const response = await axios.post(`${URL}/recuperar-acceso/cambiar-password`, {
        token_temporal: tokenTemporal,
        nueva_password: nuevaPassword,
        confirmar_password: confirmarPassword
      });

      await Swal.fire({
        title: 'Contraseña actualizada',
        text: response.data.mensaje || 'Ya puedes iniciar sesión con tu nueva contraseña',
        icon: 'success',
        confirmButtonText: 'Ir al login',
        confirmButtonColor: '#ea580c'
      });

      navigate('/login');

    } catch (error) {
      console.error('Error cambiando contraseña:', error);

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudo cambiar la contraseña',
        'error'
      );

    } finally {
      setCargando(false);
    }
  };

  const reiniciarProceso = () => {
    setPaso(1);
    setCodigo('');
    setTokenTemporal('');
    setUsuarioEncontrado('');
    setNombreEncontrado('');
    setNuevaPassword('');
    setConfirmarPassword('');
  };

  return (
    <div className="recuperar-page">
      <div className="recuperar-bg-light recuperar-light-one"></div>
      <div className="recuperar-bg-light recuperar-light-two"></div>
      <div className="recuperar-bg-light recuperar-light-three"></div>

      <div className="recuperar-wrapper">

        <div className="recuperar-info">
          <div className="recuperar-brand-box">
            <img src={logo} alt="JFCuaR Logo" className="recuperar-brand-logo" />

            <div>
              <h2>JFCuaR</h2>
              <span>Software</span>
            </div>
          </div>

          <span className="recuperar-badge">
            Recuperación segura
          </span>

          <h1>
            Recupera tu acceso de forma segura
          </h1>

          <p>
            Te enviaremos un código de verificación al correo registrado.
            Con ese código podrás recuperar tu usuario y cambiar tu contraseña.
          </p>

          <div className="recuperar-steps-info">
            <div className={paso === 1 ? 'activo' : paso > 1 ? 'completado' : ''}>
              <strong>1</strong>
              <span>Correo</span>
            </div>

            <div className={paso === 2 ? 'activo' : paso > 2 ? 'completado' : ''}>
              <strong>2</strong>
              <span>Código</span>
            </div>

            <div className={paso === 3 ? 'activo' : ''}>
              <strong>3</strong>
              <span>Contraseña</span>
            </div>
          </div>
        </div>

        <div className="recuperar-card">
          <div className="recuperar-logo-box">
            <img src={logo} alt="logo" className="recuperar-logo" />
          </div>

          <div className="recuperar-card-header">
            <h2>Recuperar acceso</h2>

            {paso === 1 && (
              <p>Ingresa el correo con el que fue creada tu cuenta.</p>
            )}

            {paso === 2 && (
              <p>Ingresa el código de 6 dígitos enviado a tu correo.</p>
            )}

            {paso === 3 && (
              <p>Crea una nueva contraseña para tu cuenta.</p>
            )}
          </div>

          <div className="recuperar-progress">
            <div className={`progress-item ${paso >= 1 ? 'activo' : ''}`}>1</div>
            <div className={`progress-line ${paso >= 2 ? 'activo' : ''}`}></div>
            <div className={`progress-item ${paso >= 2 ? 'activo' : ''}`}>2</div>
            <div className={`progress-line ${paso >= 3 ? 'activo' : ''}`}></div>
            <div className={`progress-item ${paso >= 3 ? 'activo' : ''}`}>3</div>
          </div>

          {paso === 1 && (
            <form onSubmit={solicitarCodigo}>
              <div className="recuperar-form-group">
                <label>Correo electrónico</label>
                <input
                  type="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  autoComplete="email"
                  required
                />
              </div>

              <button
                type="submit"
                className="btn-recuperar-primary"
                disabled={cargando}
              >
                {cargando ? 'Enviando código...' : 'Enviar código'}
              </button>
            </form>
          )}

          {paso === 2 && (
            <form onSubmit={verificarCodigo}>
              <div className="recuperar-email-box">
                <span>Correo</span>
                <strong>{correo}</strong>
              </div>

              <div className="recuperar-form-group">
                <label>Código de verificación</label>
                <input
                  type="text"
                  value={codigo}
                  onChange={(e) => {
                    const valor = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setCodigo(valor);
                  }}
                  placeholder="000000"
                  maxLength="6"
                  className="codigo-input"
                  autoComplete="one-time-code"
                  required
                />
              </div>

              <button
                type="submit"
                className="btn-recuperar-primary"
                disabled={cargando}
              >
                {cargando ? 'Verificando...' : 'Verificar código'}
              </button>

              <button
                type="button"
                className="btn-recuperar-secondary"
                onClick={solicitarCodigo}
                disabled={cargando}
              >
                Reenviar código
              </button>

              <button
                type="button"
                className="btn-recuperar-link"
                onClick={reiniciarProceso}
                disabled={cargando}
              >
                Cambiar correo
              </button>
            </form>
          )}

          {paso === 3 && (
            <form onSubmit={cambiarPassword}>
              {(usuarioEncontrado || nombreEncontrado) && (
                <div className="recuperar-user-box">
                  {nombreEncontrado && (
                    <p>
                      <span>Nombre</span>
                      <strong>{nombreEncontrado}</strong>
                    </p>
                  )}

                  {usuarioEncontrado && (
                    <p>
                      <span>Usuario</span>
                      <strong>{usuarioEncontrado}</strong>
                    </p>
                  )}
                </div>
              )}

              <div className="recuperar-form-group">
                <label>Nueva contraseña</label>
                <input
                  type="password"
                  value={nuevaPassword}
                  onChange={(e) => setNuevaPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="recuperar-form-group">
                <label>Confirmar contraseña</label>
                <input
                  type="password"
                  value={confirmarPassword}
                  onChange={(e) => setConfirmarPassword(e.target.value)}
                  placeholder="Confirma tu nueva contraseña"
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="recuperar-password-rules">
                <span className={nuevaPassword.length >= 8 ? 'cumple' : ''}>
                  Mínimo 8 caracteres
                </span>

                <span className={nuevaPassword && nuevaPassword === confirmarPassword ? 'cumple' : ''}>
                  Las contraseñas deben coincidir
                </span>
              </div>

              <button
                type="submit"
                className="btn-recuperar-primary"
                disabled={cargando}
              >
                {cargando ? 'Actualizando...' : 'Cambiar contraseña'}
              </button>
            </form>
          )}

          <button
            type="button"
            className="btn-volver-login"
            onClick={() => navigate('/login')}
            disabled={cargando}
          >
            Volver al inicio de sesión
          </button>
        </div>

      </div>
    </div>
  );
}

export default RecuperarAcceso;