/**
 * Provider de sesión.
 *
 * Al montar la app intenta recuperar la sesión: si hay cookie del refresh
 * token, pide un access nuevo y queda logueado sin pasar por el login. Si no hay
 * cookie, se borra el usuario cacheado en localStorage.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { api } from '../lib/api'
import { guardarUsuario, leerUsuario, limpiarUsuario, setAccessToken } from '../lib/session'
import type { RespuestaSesion, Usuario } from '../lib/types'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  // Se parte del usuario cacheado para no parpadear el login al recargar, pero
  // `cargando` sigue en true hasta confirmar con el back.
  const [usuario, setUsuario] = useState<Usuario | null>(() => leerUsuario())
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false

    async function recuperarSesion() {
      try {
        const data = await api.post<RespuestaSesion>('/api/auth/refresh')
        if (cancelado) return
        setAccessToken(data.tokens.access)
        guardarUsuario(data.user)
        setUsuario(data.user)
      } catch {
        // Sin cookie o refresh vencido: sesion cerrada.
        if (cancelado) return
        limpiarUsuario()
        setUsuario(null)
      } finally {
        if (!cancelado) setCargando(false)
      }
    }

    void recuperarSesion()
    return () => {
      cancelado = true
    }
  }, [])

  const iniciarSesion = useCallback((sesion: RespuestaSesion) => {
    setAccessToken(sesion.tokens.access)
    guardarUsuario(sesion.user)
    setUsuario(sesion.user)
  }, [])

  const cerrarSesion = useCallback(async () => {
    try {
      await api.post('/api/auth/logout')
    } catch {
      // Si el logout falla, igual se limpia del lado del navegador.
    }
    limpiarUsuario()
    setUsuario(null)
  }, [])

  const actualizarUsuario = useCallback((nuevo: Usuario) => {
    guardarUsuario(nuevo)
    setUsuario(nuevo)
  }, [])

  const valor = useMemo<AuthContextValue>(
    () => ({ usuario, cargando, iniciarSesion, cerrarSesion, actualizarUsuario }),
    [usuario, cargando, iniciarSesion, cerrarSesion, actualizarUsuario],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
