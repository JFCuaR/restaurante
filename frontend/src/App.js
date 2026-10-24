import React from 'react';
import { Route, Routes } from 'react-router-dom';

import Home from './Home';
import Login from './Login';
import PrivateRoute from './PrivateRoute';
import { AuthProvider } from './AuthContext';



import RegistroTienda from './RegistroRestaurante';
import GestionPedidos from './GestionPedidos';

import RegistroRestaurante from './RegistroRestaurante';
import Mesas from './Mesas';
import Productos from './Productos';
import Categorias from './Categorias';
import NuevoPedido from './NuevoPedido';
import Cocina from './Cocina';
import Pedidos from './Pedidos';
import Caja from './Caja';
import Gastos from './Gastos';
import Reportes from './Reportes';
import Usuarios from './Usuarios';
import Clientes from './Clientes';
import Configuracion from './Configuracion';
import Pagos from './Pagos';
import MenuRestaurante from './MenuRestaurante';
import MenuVisual from './MenuVisual';
import RecuperarAcceso from './RecuperarAcceso';

import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  return (
    <AuthProvider>
      <Routes>

        {/* LOGIN */}
        <Route path="/login" element={<Login />} />

        {/* REGISTRO DE TIENDA */}

        <Route path="/registro-restaurante" element={<RegistroRestaurante />} />

        {/* HOME */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />

        <Route
          path="/Home"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />


        <Route
  path="/mesas"
  element={
    <PrivateRoute>
      <Mesas />
    </PrivateRoute>
  }
/>

<Route
  path="/productos"
  element={
    <PrivateRoute>
      <Productos />
    </PrivateRoute>
  }
/>

      <Route
  path="/categorias"
  element={
    <PrivateRoute>
      <Categorias />
    </PrivateRoute>
  }
/>  

<Route
  path="/nuevo-pedido"
  element={
    <PrivateRoute>
      <NuevoPedido />
    </PrivateRoute>
  }
/>

<Route
  path="/cocina"
  element={
    <PrivateRoute>
      <Cocina />
    </PrivateRoute>
  }
/>

<Route
  path="/pedidos"
  element={
    <PrivateRoute>
      <Pedidos />
    </PrivateRoute>
  }
/>

<Route
  path="/caja"
  element={
    <PrivateRoute>
      <Caja />
    </PrivateRoute>
  }
/>

<Route
  path="/gastos"
  element={
    <PrivateRoute>
      <Gastos />
    </PrivateRoute>
  }
/>

<Route
  path="/reportes"
  element={
    <PrivateRoute>
      <Reportes />
    </PrivateRoute>
  }
/>

<Route
  path="/usuarios"
  element={
    <PrivateRoute>
      <Usuarios />
    </PrivateRoute>
  }
/>

<Route
  path="/clientes"
  element={
    <PrivateRoute>
      <Clientes />
    </PrivateRoute>
  }
/>

<Route
  path="/configuracion"
  element={
    <PrivateRoute>
      <Configuracion />
    </PrivateRoute>
  }
/>

<Route
  path="/pagos"
  element={
    <PrivateRoute>
      <Pagos />
    </PrivateRoute>
  }
/>

<Route
  path="/MenuRestaurante"
  element={
    <PrivateRoute>
      <MenuRestaurante />
    </PrivateRoute>
  }
/>

<Route path="/recuperar-acceso" element={<RecuperarAcceso />} />

<Route
  path="/MenuVisual"
  element={
    <PrivateRoute>
      <MenuVisual />
    </PrivateRoute>
  }
/>

      </Routes>
    </AuthProvider>
  );
}

export default App;