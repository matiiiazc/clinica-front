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

import { getAccessToken, limpiarUsuario, setAccessToken } from './session'
import {
  ApiError,
  type Bloqueo,
  type Consulta,
  type EntradaCola,
  type Especialidad,
  type EstadoMedico,
  type EstadoTurno,
  type FichaMedica,
  type Medico,
  type PacienteBusqueda,
  type Paginado,
  type PeriodoAgenda,
  type RespuestaDisponibilidad,
  type RespuestaSesion,
  type ResumenPanel,
  type Rol,
  type TramoAgenda,
  type Turno,
  type Usuario,
} from './types'

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
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
}

/** `/api/clinica` no existe como prefijo: apps.clinica cuelga de `/api/` directo. */
export const clinica = {
  resumen: () => api.get<ResumenPanel>('/api/panel/resumen'),

  especialidades: (todas = false) => api.get<Especialidad[]>(`/api/especialidades${todas ? '?todas=1' : ''}`),
  crearEspecialidad: (body: { nombre: string; descripcion?: string; duracion_turno_minutos?: number }) =>
    api.post<Especialidad>('/api/especialidades', body),
  actualizarEspecialidad: (id: number, body: Partial<Especialidad>) =>
    api.patch<Especialidad>(`/api/especialidades/${id}`, body),

  /** `/api/auth/usuarios`. Solo admin. */
  usuarios: (params?: { rol?: Rol; q?: string }) => {
    const q = new URLSearchParams()
    if (params?.rol) q.set('rol', params.rol)
    if (params?.q) q.set('q', params.q)
    const suffix = q.toString()
    return api.get<Usuario[]>(`/api/auth/usuarios${suffix ? `?${suffix}` : ''}`)
  },

  medicos: (params?: { especialidad?: number; disponibles?: boolean; conProximo?: boolean }) => {
    const q = new URLSearchParams()
    if (params?.especialidad) q.set('especialidad', String(params.especialidad))
    if (params?.disponibles) q.set('disponibles', '1')
    if (params?.conProximo) q.set('con_proximo', '1')
    const suffix = q.toString()
    return api.get<Paginado<Medico>>(`/api/medicos${suffix ? `?${suffix}` : ''}`)
  },
  crearMedico: (body: { email: string; matricula: string; especialidad: number }) =>
    api.post<Medico>('/api/medicos', body),
  miPerfilMedico: () => api.get<Medico>('/api/medicos/mi-perfil'),
  cambiarEstadoMedico: (estado: EstadoMedico) => api.patch<Medico>('/api/medicos/mi-perfil', { estado }),
  agenda: (medicoId: number) => api.get<TramoAgenda[]>(`/api/medicos/${medicoId}/agenda`),
  crearAgenda: (medicoId: number, body: { dia_semana: number; hora_inicio: string; hora_fin: string }) =>
    api.post<TramoAgenda>(`/api/medicos/${medicoId}/agenda`, body),
  borrarAgenda: (medicoId: number, agendaId: number) =>
    api.delete<void>(`/api/medicos/${medicoId}/agenda/${agendaId}`),
  bloqueos: (medicoId: number) => api.get<Bloqueo[]>(`/api/medicos/${medicoId}/bloqueos`),
  crearBloqueo: (medicoId: number, body: { desde: string; hasta: string; motivo?: string }) =>
    api.post<Bloqueo>(`/api/medicos/${medicoId}/bloqueos`, body),

  disponibilidad: (params: { fecha: string; medico?: number; especialidad?: number }) => {
    const q = new URLSearchParams({ fecha: params.fecha })
    if (params.medico) q.set('medico', String(params.medico))
    if (params.especialidad) q.set('especialidad', String(params.especialidad))
    return api.get<RespuestaDisponibilidad>(`/api/disponibilidad?${q}`)
  },

  turnos: (params?: { estado?: string; medico?: number; desde?: string; hasta?: string }) => {
    const q = new URLSearchParams()
    if (params?.estado) q.set('estado', params.estado)
    if (params?.medico) q.set('medico', String(params.medico))
    if (params?.desde) q.set('desde', params.desde)
    if (params?.hasta) q.set('hasta', params.hasta)
    const suffix = q.toString()
    return api.get<Paginado<Turno>>(`/api/turnos${suffix ? `?${suffix}` : ''}`)
  },
  misTurnos: (params?: { periodo?: PeriodoAgenda; historico?: boolean }) => {
    const q = new URLSearchParams()
    if (params?.periodo) q.set('periodo', params.periodo)
    if (params?.historico) q.set('historico', '1')
    const suffix = q.toString()
    return api.get<Turno[]>(`/api/turnos/mios${suffix ? `?${suffix}` : ''}`)
  },
  turno: (id: number) => api.get<Turno>(`/api/turnos/${id}`),
  crearTurno: (body: { paciente: string; medico: number; inicio: string; motivo?: string }) =>
    api.post<Turno>('/api/turnos', body),
  cambiarEstadoTurno: (id: number, estado: EstadoTurno) => api.patch<Turno>(`/api/turnos/${id}`, { estado }),
  solicitarTurno: (body: { especialidad: number; inicio: string; motivo?: string }) =>
    api.post<Turno>('/api/turnos/solicitar', body),

  consultas: (estado?: 'abierta' | 'respondida') =>
    api.get<Consulta[]>(`/api/consultas${estado ? `?estado=${estado}` : ''}`),
  crearConsulta: (mensaje: string) => api.post<Consulta>('/api/consultas', { mensaje }),
  responderConsulta: (id: number, respuesta: string) =>
    api.post<Consulta>(`/api/consultas/${id}/responder`, { respuesta }),

  cola: (estado?: 'esperando' | 'agendado' | 'descartado') =>
    api.get<EntradaCola[]>(`/api/cola${estado ? `?estado=${estado}` : ''}`),
  entrarEnCola: (body: { especialidad: number; medico?: number; nota?: string }) =>
    api.post<EntradaCola>('/api/cola', body),
  cambiarPrioridad: (id: number, prioridad: number) => api.patch<EntradaCola>(`/api/cola/${id}/prioridad`, { prioridad }),
  agendarDesdeCola: (id: number, inicio: string) =>
    api.post<{ entrada: EntradaCola; turno: Turno }>(`/api/cola/${id}/agendar`, { inicio }),
  salirDeCola: (id: number) => api.delete<void>(`/api/cola/${id}`),

  buscarPacientes: (q: string) =>
    api.get<PacienteBusqueda[]>(`/api/pacientes?q=${encodeURIComponent(q)}`),

  miFicha: () => api.get<FichaMedica>('/api/ficha'),
  editarFicha: (body: Partial<FichaMedica>) => api.patch<FichaMedica>('/api/ficha', body),
  fichaDe: (pacienteId: string) => api.get<FichaMedica>(`/api/pacientes/${pacienteId}/ficha`),
  verificarFicha: (pacienteId: string, nota?: string) =>
    api.post<FichaMedica>(`/api/pacientes/${pacienteId}/ficha`, { nota }),
}
