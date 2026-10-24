// src/Navbar.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from './AuthContext';
import { useContext } from 'react';
import miImagen from './logo_JFCuaR_clinico.jpg';


const Navbar = ({ toggleSidebar }) => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-light border-bottom">
      <button className="btn btn-primary" id="menu-toggle" onClick={toggleSidebar}>
        Menu
      </button>
      
      <span style={{ marginLeft: '10px', fontWeight: '600', fontFamily: 'Poppins, sans-serif' ,fontSize: '22px', color: '#333' }}>
  Bienvenido{user ? `, ${user.nombre}` : ''}
</span>

      <button className="btn btn-danger ml-auto" onClick={handleLogout}>
        
        Cerrar Sesión
      </button>
    </nav>
  );
};

export default Navbar;
