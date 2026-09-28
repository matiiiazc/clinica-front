/**
 * Rutas de la app.
 *
 * /            redirige a /app o /login segun haya sesion
 * /login       publica
 * /registro    publica
 * /verificar   publica (codigo de email)
 * /cambiar-contrasena  requiere sesion
 * /app         requiere sesion
 */

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import RutaPrivada from './components/RutaPrivada'
import { AuthProvider } from './context/AuthProvider'
import { useAuth } from './context/useAuth'
import ChangePassword from './pages/ChangePassword'
import Login from './pages/Login'
import Main from './pages/Main'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'

/** Raiz que manda al lugar correcto segun el estado de la sesion. */
function Raiz() {
  const { usuario, cargando } = useAuth()

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span style={{ color: 'var(--color-text-muted)' }}>Cargando...</span>
      </div>
    )
  }

  return <Navigate to={usuario ? '/app' : '/login'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Raiz />} />

          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Register />} />
          <Route path="/verificar" element={<VerifyEmail />} />

          <Route
            path="/cambiar-contrasena"
            element={
              <RutaPrivada>
                <ChangePassword />
              </RutaPrivada>
            }
          />
          <Route
            path="/app"
            element={
              <RutaPrivada>
                <Main />
              </RutaPrivada>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
