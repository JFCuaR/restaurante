import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import AuthContext from './AuthContext';
import Sidebar from './sidebar';
import Navbar from './Navbar';
import './Reportes.css';

const URL = process.env.REACT_APP_URL_BACKEND || 'http://localhost:3001';

function Reportes() {
  const { token, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const fechaActual = new Date();

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [cargando, setCargando] = useState(false);

  const [anio, setAnio] = useState(fechaActual.getFullYear());
  const [mes, setMes] = useState(fechaActual.getMonth() + 1);

  const [resumen, setResumen] = useState(null);
  const [productos, setProductos] = useState([]);
  const [gastos, setGastos] = useState([]);

  const authToken = token || localStorage.getItem('token');

  const getConfig = () => ({
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  });

  const meses = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' }
  ];

  const toggleSidebar = () => {
    setSidebarOpen(!isSidebarOpen);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const cargarReportes = async () => {
    try {
      setCargando(true);

      const params = `?anio=${anio}&mes=${mes}`;

      const [resumenRes, productosRes, gastosRes] = await Promise.all([
        axios.get(`${URL}/reportes/resumen${params}`, getConfig()),
        axios.get(`${URL}/reportes/productos${params}`, getConfig()),
        axios.get(`${URL}/reportes/gastos${params}`, getConfig())
      ]);

      setResumen(resumenRes.data);
      setProductos(productosRes.data || []);
      setGastos(gastosRes.data || []);

    } catch (error) {
      console.error('Error cargando reportes:', error);

      if (error.response?.status === 401 || error.response?.status === 403) {
        Swal.fire('Sesión vencida', 'Inicia sesión nuevamente', 'warning');
        logout();
        navigate('/login');
        return;
      }

      Swal.fire(
        'Error',
        error.response?.data?.mensaje || 'No se pudieron cargar los reportes',
        'error'
      );

    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarReportes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatearMoneda = (valor) => {
    return `Q${Number(valor || 0).toFixed(2)}`;
  };

  const nombreMes = meses.find((m) => Number(m.value) === Number(mes))?.label || '';

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

          <div className="container-fluid reportes-container">

            <div className="reportes-header mt-4">
              <div>
                <span className="reportes-badge">Reportes</span>
                <h2>Reportes del restaurante</h2>
                <p>
                  Consulta ventas, pagos, gastos, ganancias y productos más vendidos.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-reportes-refresh"
                onClick={cargarReportes}
                disabled={cargando}
              >
                {cargando ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>

            <div className="reportes-filtros mt-4">
              <div>
                <label>Mes</label>
                <select
                  className="form-control"
                  value={mes}
                  onChange={(e) => setMes(Number(e.target.value))}
                >
                  {meses.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Año</label>
                <input
                  type="number"
                  className="form-control"
                  value={anio}
                  onChange={(e) => setAnio(Number(e.target.value))}
                />
              </div>

              <div className="d-flex align-items-end">
                <button
                  type="button"
                  className="btn btn-reportes-save"
                  onClick={cargarReportes}
                >
                  Buscar
                </button>
              </div>
            </div>

            {resumen && (
              <>
                <div className="periodo-reporte mt-4">
                  Reporte de <strong>{nombreMes} {anio}</strong>
                </div>

                <div className="reportes-cards mt-4">
                  <div className="reporte-card">
                    <span>Ventas</span>
                    <h3>{formatearMoneda(resumen.resumen.ventas_total)}</h3>
                    <p>Pedidos pagados: {resumen.resumen.pedidos_pagados}</p>
                  </div>

                  <div className="reporte-card">
                    <span>Pagos recibidos</span>
                    <h3>{formatearMoneda(resumen.resumen.pagos_total)}</h3>
                    <p>Total cobrado en el mes</p>
                  </div>

                  <div className="reporte-card gasto">
                    <span>Gastos</span>
                    <h3>{formatearMoneda(resumen.resumen.gastos_total)}</h3>
                    <p>Registros: {resumen.resumen.total_gastos}</p>
                  </div>

                  <div className={`reporte-card ${resumen.resumen.ganancia >= 0 ? 'ganancia' : 'perdida'}`}>
                    <span>Ganancia</span>
                    <h3>{formatearMoneda(resumen.resumen.ganancia)}</h3>
                    <p>Ventas menos gastos</p>
                  </div>

                  <div className="reporte-card">
                    <span>Propinas</span>
                    <h3>{formatearMoneda(resumen.resumen.propinas_total)}</h3>
                    <p>Total de propinas</p>
                  </div>

                  <div className="reporte-card">
                    <span>Descuentos</span>
                    <h3>{formatearMoneda(resumen.resumen.descuentos_total)}</h3>
                    <p>Total descontado</p>
                  </div>
                </div>

                <div className="reportes-grid mt-4">
                  <section className="reportes-panel">
                    <h4>Estados de pedidos</h4>

                    <div className="estado-reporte-lista">
                      <div>
                        <span>En cocina</span>
                        <strong>{resumen.estados_pedidos.en_cocina}</strong>
                      </div>

                      <div>
                        <span>Preparando</span>
                        <strong>{resumen.estados_pedidos.preparando}</strong>
                      </div>

                      <div>
                        <span>Listos</span>
                        <strong>{resumen.estados_pedidos.listos}</strong>
                      </div>

                      <div>
                        <span>Entregados</span>
                        <strong>{resumen.estados_pedidos.entregados}</strong>
                      </div>

                      <div>
                        <span>Pagados</span>
                        <strong>{resumen.estados_pedidos.pagados}</strong>
                      </div>

                      <div>
                        <span>Cancelados</span>
                        <strong>{resumen.estados_pedidos.cancelados}</strong>
                      </div>
                    </div>
                  </section>

                  <section className="reportes-panel">
                    <h4>Pagos por método</h4>

                    <div className="estado-reporte-lista">
                      <div>
                        <span>Efectivo</span>
                        <strong>{formatearMoneda(resumen.pagos.efectivo)}</strong>
                      </div>

                      <div>
                        <span>Tarjeta</span>
                        <strong>{formatearMoneda(resumen.pagos.tarjeta)}</strong>
                      </div>

                      <div>
                        <span>Transferencia</span>
                        <strong>{formatearMoneda(resumen.pagos.transferencia)}</strong>
                      </div>

                      <div>
                        <span>Mixto</span>
                        <strong>{formatearMoneda(resumen.pagos.mixto)}</strong>
                      </div>

                      <div>
                        <span>Otro</span>
                        <strong>{formatearMoneda(resumen.pagos.otro)}</strong>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="reportes-grid mt-4">
                  <section className="reportes-panel">
                    <h4>Productos más vendidos</h4>

                    {productos.length === 0 && (
                      <div className="reportes-empty">
                        No hay productos vendidos en este periodo.
                      </div>
                    )}

                    {productos.map((item, index) => (
                      <div key={item.id_producto} className="producto-reporte-item">
                        <div>
                          <span>#{index + 1}</span>
                          <strong>{item.producto}</strong>
                          <p>{item.categoria || 'Sin categoría'}</p>
                        </div>

                        <div>
                          <strong>{Number(item.cantidad_vendida || 0)}</strong>
                          <p>{formatearMoneda(item.total_vendido)}</p>
                        </div>
                      </div>
                    ))}
                  </section>

                  <section className="reportes-panel">
                    <h4>Gastos por categoría</h4>

                    {gastos.length === 0 && (
                      <div className="reportes-empty">
                        No hay gastos en este periodo.
                      </div>
                    )}

                    {gastos.map((item) => (
                      <div key={item.categoria} className="gasto-reporte-item">
                        <div>
                          <strong>{item.categoria}</strong>
                          <p>{item.cantidad} registros</p>
                        </div>

                        <span>{formatearMoneda(item.total)}</span>
                      </div>
                    ))}
                  </section>
                </div>
              </>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}

export default Reportes;