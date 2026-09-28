/**
 * Cliente HTTP contra clinica_back.
 *
 * Dos cosas importantes:
 *
 * 1. `credentials: 'include'` en todo: la cookie del refresh token es la que
 *    sostiene la sesión y sin esto el navegador no la manda.
 *
 * 2. Refresh automático en un 401. El access token vive 15 minutos, así que en
 *    cualquier sesión larga expira. Cuando pasa, se pide uno nuevo con el refresh
 *    y se reintenta la request original una sola vez, para que el usuario no
 *    sea expulsado de la nada.
 */

import { getAccessToken, setAccessToken, limpiarUsuario } from './session'
import { ApiError, type RespuestaSesion } from './types'

/** Vacío = mismo origen, que el proxy de Vite reenvía al Django en el 8000. */
const API_URL = import.meta.env.VITE_API_URL ?? ''

const REFRESH_PATH = '/api/auth/refresh'

/** Promesa del refresh en curso, para no disparar N refresh a la vez. */
let refreshEnCurso: Promise<boolean> | null = null

async function leerError(response: Response): Promise<ApiError> {
  let body: { code?: string; detail?: string; errors?: Record<string, string[]> } = {}
  try {
    body = await response.json()
  } catch {
    // Respuesta sin JSON (por ejemplo un 502 del proxy): se usa un texto generico.
  }

  const errores = body.errors ?? {}
  const primerDetalle = Object.values(errores).flat()[0]
  const detail = body.detail ?? primerDetalle ?? `Error ${response.status}`

  return new ApiError(response.status, body.code ?? 'error', detail, errores)
}

async function pedirRefresh(): Promise<boolean> {
  // Si ya hay un refresh en curso, se espera ese en vez de pedir otro.
  if (refreshEnCurso) return refreshEnCurso

  refreshEnCurso = (async () => {
    try {
      const response = await fetch(`${API_URL}${REFRESH_PATH}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) return false

      const data = (await response.json()) as RespuestaSesion
      setAccessToken(data.tokens.access)
      return true
    } catch {
      return false
    } finally {
      refreshEnCurso = null
    }
  })()

  return refreshEnCurso
}

interface Opciones extends Omit<RequestInit, 'body'> {
  /** Objeto que se manda como JSON, o un body ya listo (FormData, string). */
  body?: unknown
  /** No intentar refrescar el token en un 401 de este request. */
  sinRefresh?: boolean
}

export async function apiFetch<T>(path: string, { body, sinRefresh, ...options }: Opciones = {}): Promise<T> {
  const token = getAccessToken()

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  }
  if (!headers['Content-Type'] && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers,
    body:
      body === undefined
        ? undefined
        : body instanceof FormData || typeof body === 'string'
          ? body
          : JSON.stringify(body),
  })

  if (response.status === 401 && !sinRefresh && !path.startsWith(REFRESH_PATH)) {
    if (await pedirRefresh()) {
      return apiFetch<T>(path, { body, sinRefresh: true, ...options })
    }
    limpiarUsuario()
    throw new ApiError(401, 'session_expired', 'Tu sesión venció. Volvé a iniciar sesión.')
  }

  if (!response.ok) throw await leerError(response)

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PATCH', body }),
}
