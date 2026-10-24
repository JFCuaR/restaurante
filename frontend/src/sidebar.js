import React, { useContext, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import AuthContext from './AuthContext';
import './Sidebar.css';

const ROLES = {
  ADMINISTRADOR: 'ADMINISTRADOR',
  GERENTE: 'GERENTE',
  CAJA: 'CAJA',
  MESERO: 'MESERO',
  COCINA: 'COCINA'
};

const TODOS_LOS_ROLES = [
  ROLES.ADMINISTRADOR,
  ROLES.GERENTE,
  ROLES.CAJA,
  ROLES.MESERO,
  ROLES.COCINA
];

const menuPorRol = [
  {
    titulo: 'PRINCIPAL',
    roles: TODOS_LOS_ROLES,
    opciones: [
      {
        nombre: 'Inicio',
        ruta: '/Home',
        icono: '🏠',
        roles: TODOS_LOS_ROLES
      },
      {
        nombre: 'Menú visual',
        ruta: '/MenuVisual',
        icono: '📋',
        roles: TODOS_LOS_ROLES
      },
      {
        nombre: 'Administrar menú',
        ruta: '/MenuRestaurante',
        icono: '🍽️',
        roles: [
          ROLES.ADMINISTRADOR,
          ROLES.GERENTE
        ]
      }
    ]
  },

  {
    titulo: 'OPERACIÓN',
    roles: [
      ROLES.ADMINISTRADOR,
      ROLES.GERENTE,
      ROLES.MESERO,
      ROLES.CAJA
    ],
    opciones: [
      {
        nombre: 'Mesas',
        ruta: '/mesas',
        icono: '🍽️',
        roles: [
          ROLES.ADMINISTRADOR,
          ROLES.GERENTE,
          ROLES.MESERO
        ]
      },
      {
        nombre: 'Nuevo pedido',
        ruta: '/nuevo-pedido',
        icono: '🧾',
        roles: [
          ROLES.ADMINISTRADOR,
          ROLES.GERENTE,
          ROLES.MESERO
        ]
      },
      {
        nombre: 'Pedidos',
        ruta: '/pedidos',
        icono: '📋',
        roles: [
          ROLES.ADMINISTRADOR,
          ROLES.GERENTE,
          ROLES.MESERO,
          ROLES.CAJA
        ]
      }
    ]
  },

  {
    titulo: 'COCINA',
    roles: [
      ROLES.ADMINISTRADOR,
      ROLES.GERENTE,
      ROLES.COCINA
    ],
    opciones: [
      {
        nombre: 'Pedidos en cocina',
        ruta: '/cocina',
        icono: '👨‍🍳',
        roles: [
          ROLES.ADMINISTRADOR,
          ROLES.GERENTE,
          ROLES.COCINA
        ]
      }
    ]
  },

  {
    titulo: 'CAJA',
    roles: [
      ROLES.ADMINISTRADOR,
      ROLES.GERENTE,
      ROLES.CAJA
    ],
    opciones: [
      {
        nombre: 'Caja y cobros',
        ruta: '/caja',
        icono: '💵',
        roles: [
          ROLES.ADMINISTRADOR,
          ROLES.GERENTE,
          ROLES.CAJA
        ]
      },
      {
        nombre: 'Historial de pagos',
        ruta: '/pagos',
        icono: '💳',
        roles: [
          ROLES.ADMINISTRADOR,
          ROLES.GERENTE,
          ROLES.CAJA
        ]
      },
      {
        nombre: 'Gastos',
        ruta: '/gastos',
        icono: '🧾',
        roles: [
          ROLES.ADMINISTRADOR,
          ROLES.GERENTE,
          ROLES.CAJA
        ]
      }
    ]
  },

  {
    titulo: 'ADMINISTRACIÓN',
    roles: [
      ROLES.ADMINISTRADOR,
      ROLES.GERENTE
    ],
    opciones: [
      {
        nombre: 'Productos',
        ruta: '/productos',
        icono: '🍔',
        roles: [
          ROLES.ADMINISTRADOR,
          ROLES.GERENTE
        ]
      },
      {
        nombre: 'Categorías',
        ruta: '/categorias',
        icono: '🗂️',
        roles: [
          ROLES.ADMINISTRADOR,
          ROLES.GERENTE
        ]
      },
      {
        nombre: 'Clientes',
        ruta: '/clientes',
        icono: '👥',
        roles: [
          ROLES.ADMINISTRADOR,
          ROLES.GERENTE
        ]
      },
      {
        nombre: 'Reportes',
        ruta: '/reportes',
        icono: '📊',
        roles: [
          ROLES.ADMINISTRADOR,
          ROLES.GERENTE
        ]
      }
    ]
  },

  {
    titulo: 'SISTEMA',
    roles: [ROLES.ADMINISTRADOR],
    opciones: [
      {
        nombre: 'Usuarios',
        ruta: '/usuarios',
        icono: '👤',
        roles: [ROLES.ADMINISTRADOR]
      },
      {
        nombre: 'Configuración',
        ruta: '/configuracion',
        icono: '⚙️',
        roles: [ROLES.ADMINISTRADOR]
      }
    ]
  }
];

const nombresRoles = {
  ADMINISTRADOR: 'Administrador',
  GERENTE: 'Gerente',
  CAJA: 'Cajero',
  MESERO: 'Mesero',
  COCINA: 'Cocinero'
};

const Sidebar = ({ isOpen }) => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [cerrando, setCerrando] = useState(false);

  const rol = String(user?.rol || '')
    .trim()
    .toUpperCase();

  const seccionesPermitidas = useMemo(() => {
    if (!rol) {
      return [];
    }

    return menuPorRol
      .filter((seccion) => seccion.roles.includes(rol))
      .map((seccion) => ({
        ...seccion,
        opciones: seccion.opciones.filter((opcion) =>
          opcion.roles.includes(rol)
        )
      }))
      .filter((seccion) => seccion.opciones.length > 0);
  }, [rol]);

  const handleCerrarSesion = async () => {
    const result = await Swal.fire({
      title: '¿Deseas cerrar sesión?',
      text: 'Tu sesión será cerrada.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cerrar sesión',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      reverseButtons: true
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      setCerrando(true);

      await logout();

      navigate('/login', {
        replace: true
      });
    } catch (error) {
      console.error('Error al cerrar sesión:', error);

      await Swal.fire({
        title: 'Error',
        text: 'No se pudo cerrar sesión correctamente.',
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
    } finally {
      setCerrando(false);
    }
  };

  const claseEnlace = ({ isActive }) =>
    `submenu-item ${isActive ? 'submenu-item-active' : ''}`;

  return (
    <aside
      id="sidebar-wrapper"
      className={`d-flex flex-column bg-dark ${
        isOpen ? 'open' : ''
      }`}
      style={{ minHeight: '100vh' }}
    >
      <div className="sidebar-header text-white text-center py-4 border-bottom border-secondary">
        <h5 className="mb-1">SISTEMA DE</h5>
        <h6 className="text-warning mb-0">RESTAURANTE</h6>
      </div>

      {user && (
        <div className="sidebar-user text-white text-center p-3 border-bottom border-secondary">
          <div className="sidebar-user-avatar">
            {(user.nombre || user.usuario || 'U')
              .charAt(0)
              .toUpperCase()}
          </div>

          <p className="mb-1 mt-2">
            <strong>
              {user.nombre || user.usuario || 'Usuario'}
            </strong>
          </p>

          {user.nombre_restaurante && (
            <small className="d-block text-light opacity-75 mb-1">
              {user.nombre_restaurante}
            </small>
          )}

          <span className="sidebar-role-badge">
            {nombresRoles[rol] || rol || 'Sin rol'}
          </span>
        </div>
      )}

      <nav className="list-group list-group-flush flex-grow-1 sidebar-navigation">
        {seccionesPermitidas.map((seccion) => (
          <div
            className="menu-section"
            key={seccion.titulo}
          >
            <div className="menu-title">
              {seccion.titulo}
            </div>

            <div className="menu-content">
              {seccion.opciones.map((opcion) => (
                <NavLink
                  key={opcion.ruta}
                  to={opcion.ruta}
                  className={claseEnlace}
                >
                  <span
                    className="submenu-icon"
                    aria-hidden="true"
                  >
                    {opcion.icono}
                  </span>

                  <span>{opcion.nombre}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        {user && seccionesPermitidas.length === 0 && (
          <div className="p-3 text-center text-warning">
            <small>
              El usuario no tiene un rol válido asignado.
            </small>
          </div>
        )}
      </nav>

      <div className="sidebar-footer text-white text-center p-3 mt-auto border-top border-secondary">
        <button
          type="button"
          className="btn btn-outline-light btn-sm mb-3 w-100"
          onClick={handleCerrarSesion}
          disabled={cerrando}
        >
          {cerrando
            ? 'Cerrando sesión...'
            : 'Cerrar sesión'}
        </button>

        <small className="d-block">
          Sistema Restaurante
        </small>

        <small className="d-block">
          JFCuaR
        </small>

        <small className="d-block text-light opacity-75">
          Contacto: (+502) 4746-1123
        </small>
      </div>
    </aside>
  );
};

export default Sidebar;