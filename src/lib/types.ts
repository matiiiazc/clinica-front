/**
 * Tipos que devuelve clinica_back.
 * Deben coincidir con apps/accounts/serializers.py.
 */

export type Rol = 'paciente' | 'recepcion' | 'medico' | 'admin'

export interface Usuario {
  id: string
  email: string
  nombre: string
  telefono: string
  rol: Rol
  rol_display: string
  is_clinica: boolean
  email_verified: boolean
  must_change_password: boolean
  date_joined: string
  last_login: string | null
}

export interface Tokens {
  access: string
  refresh: string
}

export interface RespuestaSesion {
  user: Usuario
  tokens: Tokens
}

export interface RespuestaRegistro {
  user: Usuario
  message: string
  /** Solo en desarrollo: el back devuelve el código cuando no hay SMTP. */
  dev_code?: string | null
}

/**
 * Error de la API ya normalizado.
 *
 * El back responde {code, detail} o {code, errors:{campo:[mensajes]}}, así que
 * `mensajePorCampo` permite pintar el error debajo del input que corresponde.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly errores: Record<string, string[]>

  constructor(status: number, code: string, detail: string, errores: Record<string, string[]> = {}) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.errores = errores
  }

  mensajePorCampo(campo: string): string | undefined {
    return this.errores[campo]?.[0]
  }
}
