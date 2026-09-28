/** Piezas de UI compartidas por los formularios. */

import type { ReactNode } from 'react'

import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

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
          {hint}
        </p>
      ) : null}
    </div>
  )
}
