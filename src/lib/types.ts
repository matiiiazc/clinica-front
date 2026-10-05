/**
 * Tipos que devuelve clinica_back.
 * Deben coincidir con los serializers de apps/accounts y apps/clinica.
 */

export type Rol = 'paciente' | 'recepcion' | 'medico' | 'admin'

export type EstadoTurno = 'pendiente' | 'confirmado' | 'atendido' | 'cancelado' | 'no_asistio'

export type EstadoMedico = 'libre' | 'atendiendo' | 'inactivo'

export type PeriodoAgenda = 'dia' | 'semana' | 'mes'

export interface Bloqueo {
  id: number
  medico: number
  desde: string
  hasta: string
  motivo: string
}

/** `/api/pacientes?q=`: lo mínimo para elegir a quién agendar un turno. */
export interface PacienteBusqueda {
  id: string
  nombre: string
  email: string
  email_verificado: boolean
}

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

// ---------------------------------------------------------------------------
// Dominio clinico (apps/clinica/serializers.py)
// ---------------------------------------------------------------------------

export interface Especialidad {
  id: number
  nombre: string
  descripcion: string
  activa: boolean
  duracion_turno_minutos: number
  medicos_disponibles: number
}

export interface TramoAgenda {
  id: number
  dia_semana: number
  dia_nombre: string
  /** `HH:MM:SS` tal como lo devuelve el backend. */
  hora_inicio: string
  hora_fin: string
  /** Solo viene en `GET /api/medicos/<id>/agenda`: los inactivos se listan aparte. */
  activo?: boolean
  medico?: number
}

export interface Medico {
  id: number
  nombre: string
  nombre_completo: string
  email: string
  matricula: string
  especialidad: string
  especialidad_id: number
  estado: EstadoMedico
  disponible: boolean
  proximo_horario: string | null
  agendas: TramoAgenda[]
}

export interface DisponibilidadMedico {
  medico_id: number
  medico: string
  especialidad: string
  duracion_minutos: number
  horarios: string[]
}

export interface RespuestaDisponibilidad {
  fecha: string
  medicos: DisponibilidadMedico[]
}

export interface Turno {
  id: number
  paciente: string
  /** UUID del paciente, como string. Va en la URL de su ficha. */
  paciente_id: string
  medico_id: number
  medico_nombre: string
  especialidad: string
  inicio: string
  fin: string
  duracion_minutos: number
  estado: EstadoTurno
  motivo: string
  notas: string
  posibles_estados: EstadoTurno[]
  puede_cancelar: boolean
  puede_asistir: boolean
  created_at: string
}

export interface Consulta {
  id: number
  paciente: string
  paciente_id: string
  mensaje: string
  respuesta: string
  respondida_por: string | null
  estado: 'abierta' | 'respondida'
  esta_abierta: boolean
  creada: string
  respondida_en: string | null
}

export interface EntradaCola {
  id: number
  paciente: string
  paciente_id: string
  especialidad: string
  especialidad_id: number
  medico: string | null
  medico_id: number | null
  prioridad: number
  estado: 'esperando' | 'agendado' | 'descartado'
  desde: string | null
  hasta: string | null
  nota: string
  turno: number | null
  creado: string
}

export interface FichaMedica {
  id: number
  alergias: string
  enfermedades_cronicas: string
  medicacion: string
  observaciones: string
  verificada: boolean
  verificada_por: string | null
  verificada_en: string | null
  creado: string
  actualizado: string
}

/** `/api/panel/resumen`: los numeros de arranque de cada panel. */
export interface ResumenPanel {
  rol: Rol
  usuarios?: number
  especialidades?: number
  medicos?: number
  medicos_libres?: number
  turnos_hoy?: number
  turnos_pendientes?: number
  consultas_abiertas?: number
  esperando?: number
  pendientes_hoy?: number
  estado?: EstadoMedico | null
  turnos_proximos?: number
  en_cola?: number
  ficha_verificada?: boolean
}

/** Paginado de DRF: `PAGE_SIZE` 20. */
export interface Paginado<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
