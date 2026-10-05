/** Piezas de UI compartidas por los formularios y los paneles. */

import type { ReactNode } from 'react'

import { AlertCircle, CheckCircle2, Inbox, Loader2 } from 'lucide-react'

export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`shrink-0 animate-spin ${className}`} aria-hidden="true" />
}

export function Aviso({
  tipo = 'error',
  children,
}: {
  tipo?: 'error' | 'exito'
  children: ReactNode
}) {
  const esError = tipo === 'error'
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
      style={{
        backgroundColor: esError ? 'var(--color-danger-bg)' : 'var(--color-success-bg)',
        color: esError ? 'var(--color-danger)' : 'var(--color-success)',
      }}
    >
      {esError ? (
        <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      ) : (
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      )}
      <span>{children}</span>
    </div>
  )
}

interface CampoProps {
  id: string
  label: string
  error?: string
  hint?: string
  children: ReactNode
}

/** Label + input + mensaje de error, para que los formularios queden parejos. */
export function Campo({ id, label, error, hint, children }: CampoProps) {
  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {hint}</p>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Piezas de los paneles
// ---------------------------------------------------------------------------

export function Card({
  titulo,
  descripcion,
  acciones,
  children,
}: {
  titulo?: string
  descripcion?: string
  acciones?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      className="rounded-xl border p-4"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      {titulo && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">{titulo}</h2>
            {descripcion && (
              <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {descripcion}
              </p>
            )}
          </div>
          {acciones && <div className="flex shrink-0 items-center gap-2">{acciones}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

/** Numero grande de arranque de un panel. */
export function Metrica({
  valor,
  etiqueta,
  tono = 'neutro',
}: {
  valor: number | string
  etiqueta: string
  tono?: 'neutro' | 'acento' | 'alerta'
}) {
  const color = tono === 'alerta' ? 'var(--color-danger)' : tono === 'acento' ? 'var(--color-accent)' : undefined
  return (
    <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
      <div className="text-xl font-semibold tabular-nums" style={color ? { color } : undefined}>
        {valor}
      </div>
      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {etiqueta}
      </div>
    </div>
  )
}

/**
 * Etiqueta de estado con color.
 *
 * El color nunca es el unico portador del significado: siempre va la palabra
 * también, porque el panel se usa en una sala de espera y no todos distinguen
 * un rojo de un verde.
 */
export function Badge({ children, tono = 'neutro' }: { children: ReactNode; tono?: 'neutro' | 'info' | 'exito' | 'peligro' | 'acento' }) {
  const colores = {
    neutro: { bg: 'var(--color-bg)', fg: 'var(--color-text-muted)' },
    info: { bg: 'var(--color-accent)', fg: 'var(--color-surface)' },
    exito: { bg: 'var(--color-success-bg)', fg: 'var(--color-success)' },
    peligro: { bg: 'var(--color-danger-bg)', fg: 'var(--color-danger)' },
    acento: { bg: 'var(--color-accent)', fg: 'var(--color-surface)' },
  }[tono]

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: colores.bg, color: colores.fg }}
    >
      {children}
    </span>
  )
}

/** Estado vacio con accion opcional. */
export function Vacio({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string
  descripcion?: string
  accion?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <Inbox size={28} style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" />
      <p className="text-sm font-medium">{titulo}</p>
      {descripcion && (
        <p className="max-w-sm text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {descripcion}
        </p>
      )}
      {accion}
    </div>
  )
}

/** Estado de carga para las tablas. */
export function Cargando({ filas = 3 }: { filas?: number }) {
  return (
    <div className="flex flex-col gap-2 p-1" aria-busy="true" aria-live="polite">
      {Array.from({ length: filas }, (_, i) => (
        <div
          key={i}
          className="h-9 animate-pulse rounded"
          style={{ backgroundColor: 'var(--color-bg)' }}
        />
      ))}
      <span className="sr-only">Cargando...</span>
    </div>
  )
}

/** Tabla responsive: en pantalla chica pasa a una lista de tarjetas. */
export function Tabla({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

export function Th({
  children,
  className = '',
  style,
}: {
  children?: ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <th
      className={`border-b pb-2 text-left text-xs font-medium tracking-wide uppercase ${className}`}
      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)', ...style }}
      scope="col"
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  className = '',
  style,
}: {
  children?: ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <td
      className={`border-b py-2.5 align-middle ${className}`}
      style={{ borderColor: 'var(--color-border)', ...style }}
    >
      {children}
    </td>
  )
}

/**
 * Boton chico para acciones dentro de una fila.
 *
 * `tono="peligro"` se reserva para lo irreversible (borrar, descartar): un rojo
 * junto a un boton normal alcanza para que alguien apriete el equivocado.
 */
export function BotonChico({
  children,
  onClick,
  disabled,
  tono = 'neutro',
  type = 'button',
  title,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  tono?: 'neutro' | 'peligro' | 'exito'
  type?: 'button' | 'submit'
  title?: string
}) {
  const activo = tono === 'peligro' ? 'var(--color-danger)' : tono === 'exito' ? 'var(--color-success)' : undefined
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50"
      style={{
        borderColor: activo ?? 'var(--color-border)',
        color: activo,
      }}
    >
      {children}
    </button>
  )
}

/** Fila de filtros: todos los controles de una pantalla, en una banda. */
export function BarraFiltros({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex flex-wrap items-end gap-2 rounded-lg border p-3"
      style={{ borderColor: 'var(--color-border)' }}
    >
      {children}
    </div>
  )
}

/** Select compacto para los filtros. */
export function Select({
  id,
  value,
  onChange,
  children,
  disabled,
}: {
  id: string
  value: string
  onChange: (valor: string) => void
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="field-input h-9 w-auto py-1 text-sm"
    >
      {children}
    </select>
  )
}
