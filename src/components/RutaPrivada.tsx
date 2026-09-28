/**
 * Rutas que exigen sesión.
 *
 * Mientras se recupera la sesión al cargar la app se muestra un spinner en vez
 * de redirigir: si el usuario ya tenía cookie, mandarlo al login sería un
 * parpadeo innecesario.
 */

import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../context/useAuth'
import { Spinner } from '../components/ui'

export default function RutaPrivada({ children }: { children: ReactNode }) {
  const { usuario, cargando } = useAuth()
  const location = useLocation()

  if (cargando) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <Spinner className="text-2xl" />
      </div>
    )
  }

  if (!usuario) {
    // Se guarda de dónde venía para volver ahí después de loguearse.
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return <>{children}</>
}
