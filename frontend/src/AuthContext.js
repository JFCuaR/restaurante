// src/AuthContext.js
import React, { createContext, useState, useEffect } from 'react';
import api from './api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validarSesion = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get('/profile');

        setUser({
          ...res.data.user,
          idCaja: res.data.user.idCaja || null,
          estadoCaja: res.data.user.estadoCaja || null,
        });
      } catch (error) {
        setUser(null);
        setToken('');
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };

    validarSesion();
  }, [token]);

  const login = (nuevoToken, userData) => {
    localStorage.setItem('token', nuevoToken);
    setToken(nuevoToken);

    setUser({
      ...userData,
      idCaja: userData.idCaja || null,
      estadoCaja: userData.estadoCaja || null,
    });
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;