import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Cliente from './Cliente.jsx'
import Admin from './Admin.jsx'
import Funcionario from './Funcionario.jsx'
import Confirmado from './Confirmado.jsx'
import Evento from './Evento.jsx'

const mode = import.meta.env.VITE_APP_MODE

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={mode === 'funcionario' ? <Navigate to="/funcionario" replace /> : mode === 'admin' ? <Navigate to="/admin" replace /> : <Cliente />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/funcionario" element={<Funcionario />} />
      <Route path="/confirmado" element={<Confirmado />} />
      <Route path="/evento" element={<Evento />} />
    </Routes>
  </BrowserRouter>
)
