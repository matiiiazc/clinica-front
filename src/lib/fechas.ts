/**
 * Formateo de fechas de la clinica.
 *
 * Toda fecha que llega de la API es ISO-8601 con offset (`2026-06-15T10:00:00-03:00`).
 * No se formatea a mano en cada componente: si un panel muestra `2026-06-15` y otro
 * `15/06/26`, el usuario piensa que son datos distintos.
 *
 * Se usa `Intl` con locale `es-AR`. Ojo con la zona horaria: el back manda el
 * offset explícito, asi que `new Date(iso)` ya cae en el instante correcto y
 * formatearlo con `timeZone` distinto al del navegador lo descoloca. Por eso
 * `formatearHora` no pasa `timeZone`: usa el del navegador, que en una clinica
 * local es el que espera el usuario.
 */

import type { EstadoMedico, EstadoTurno } from './types'

const LOCALE = 'es-AR'

const ETIQUETA_ESTADO_TURNO: Record<EstadoTurno, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  atendido: 'Atendido',
  cancelado: 'Cancelado',
  no_asistio: 'No asistió',
}

/** Color por estado. Se usa el mismo para el badge en toda la app. */
const TONO_ESTADO_TURNO: Record<EstadoTurno, 'neutro' | 'info' | 'exito' | 'peligro'> = {
  pendiente: 'neutro',
  confirmado: 'info',
  atendido: 'exito',
  cancelado: 'peligro',
  no_asistio: 'peligro',
}

export function etiquetaEstadoTurno(estado: EstadoTurno): string {
  return ETIQUETA_ESTADO_TURNO[estado] ?? estado
}

export function tonoEstadoTurno(estado: EstadoTurno): 'neutro' | 'info' | 'exito' | 'peligro' {
  return TONO_ESTADO_TURNO[estado] ?? 'neutro'
}

export function etiquetaEstadoMedico(estado: EstadoMedico): string {
  return { libre: 'Libre', atendiendo: 'Atendiendo', inactivo: 'Inactivo' }[estado] ?? estado
}

/** `15/06/2026` */
export function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE)
}

/** `10:00` */
export function formatearHora(iso: string): string {
  return new Date(iso).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })
}

/** `10:00 - 10:30` */
export function formatearRango(inicio: string, fin: string): string {
  return `${formatearHora(inicio)} - ${formatearHora(fin)}`
}

/**
 * Suma minutos a un ISO y lo devuelve como ISO.
 *
 * Para pintar el rango de un horario: el backend manda solo el inicio y la
 * duracion en minutos aparte, porque es la de la especialidad y no la del turno.
 * Se devuelve ISO y no un `Date` porque los helpers de arriba esperan ISO.
 */
export function sumarMinutos(iso: string, minutos: number): string {
  return new Date(new Date(iso).getTime() + minutos * 60_000).toISOString()
}

/**
 * `lun 15/06` para las cabeceras de agenda, donde importa el dia de la semana.
 * Sin el nombre del dia, "15/06" en una columna de semana no dice nada.
 */
export function formatearDiaCorto(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  })
}

/** `15 de junio` */
export function formatearFechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'long' })
}

/** `Hoy`, `Mañana` o la fecha corta. Para las agendas por periodo. */
export function formatearDiaRelativo(iso: string): string {
  const hoy = new Date()
  const objetivo = new Date(iso)
  const aLasMilm = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const dias = Math.round((aLasMilm(objetivo) - aLasMilm(hoy)) / 86_400_000)

  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Mañana'
  if (dias === -1) return 'Ayer'
  return formatearDiaCorto(iso)
}

/** `hace 5 minutos`, `en 3 días`. */
export function formatearRelativo(iso: string): string {
  const delta = (new Date(iso).getTime() - Date.now()) / 1000
  const fmt = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })
  const abs = (unidad: Intl.RelativeTimeFormatUnit) => fmt.format(Math.round(delta), unidad)
  if (Math.abs(delta) < 60) return abs('second')
  if (Math.abs(delta) < 3600) return abs('minute')
  if (Math.abs(delta) < 86_400) return abs('hour')
  if (Math.abs(delta) < 2_592_000) return abs('day')
  return formatearFecha(iso)
}

/**
 * `YYYY-MM-DD` de hoy o del dia que se le pase.
 *
 * Para los `<input type="date">`, que no aceptan otra cosa. Construir el string a
 * mano con `toISOString()` correria la fecha: `toISOString()` es UTC, y con
 * Argentina en UTC-3 una fecha local de medianoche sale como el dia anterior.
 */
export function aInputDate(fecha: Date = new Date()): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

/** Nombre de un dia de la semana en el orden que usa `Agenda.dia_semana` (0 = lunes). */
export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

/** El dia de la semana de hoy, en el formato de `dia_semana` (0 = lunes). */
export function diaSemanaDe(fecha: Date = new Date()): number {
  return (fecha.getDay() + 6) % 7
}