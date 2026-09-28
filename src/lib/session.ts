/**
 * Estado de sesión en el navegador.
 *
 * El access token vive SOLO en memoria: si se guardara en localStorage, un XSS
 * podría leerlo. La sesión real se sostiene con la cookie HttpOnly del refresh
 * token, que el JavaScript de la página no puede tocar.
 *
 * Lo único que se persiste es el usuario, para que al recargar la página se
 * pueda pintar la UI antes de validar el token (nada sensible: sin hash, sin
 * token, sin permiso real).
 */

import type { Usuario } from './types'

const STORAGE_KEY = 'clinica_usuario'

let accessEnMemoria: string | null = null

export function setAccessToken(token: string | null): void {
  accessEnMemoria = token
}

export function getAccessToken(): string | null {
  return accessEnMemoria
}

export function guardarUsuario(user: Usuario): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
}

export function leerUsuario(): Usuario | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Usuario
  } catch {
    limpiarUsuario()
    return null
  }
}

export function limpiarUsuario(): void {
  accessEnMemoria = null
  localStorage.removeItem(STORAGE_KEY)
}
