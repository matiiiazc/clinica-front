/**
 * Contexto de sesión: la definición va aparte del provider para que el
 * fast refresh de Vite funcione (un archivo que exporta componentes y hooks
 * juntos rompe el HMR).
 */

import { createContext } from 'react'

import type { RespuestaSesion, Usuario } from '../lib/types'

export interface AuthContextValue {
  usuario: Usuario | null
  /** True mientras se consulta al back si hay sesión recuperable. */
  cargando: boolean
  iniciarSesion: (sesion: RespuestaSesion) => void
  cerrarSesion: () => Promise<void>
  actualizarUsuario: (usuario: Usuario) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
