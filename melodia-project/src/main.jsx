import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Cliente from './Cliente.jsx'
import Admin from './Admin.jsx'
import Funcionario from './Funcionario.jsx'
import Confirmado from './Confirmado.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Cliente />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/funcionario" element={<Funcionario />} />
      <Route path="/confirmado" element={<Confirmado />} />
    </Routes>
  </BrowserRouter>
)
