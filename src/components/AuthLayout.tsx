/** Contenedor centrado de las pantallas públicas (login, registro, etc). */

import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

export default function AuthLayout({
  titulo,
  subtitulo,
  children,
  pie,
}: {
  titulo: string
  subtitulo?: string
  children: ReactNode
  pie?: ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link
            to="/"
            className="text-lg font-semibold tracking-tight"
            style={{ color: 'var(--color-text-heading)' }}
          >
            Clínica
          </Link>
        </div>

        <div
          className="rounded-2xl border p-6 shadow-sm sm:p-8"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <h1
            className="text-xl font-semibold"
            style={{ color: 'var(--color-text-heading)' }}
          >
            {titulo}
          </h1>
          {subtitulo && (
            <p className="mt-1 mb-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {subtitulo}
            </p>
          )}
          <div className={subtitulo ? '' : 'mt-6'}>{children}</div>
        </div>

        {pie && (
          <p className="mt-6 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {pie}
          </p>
        )}
      </div>
    </div>
  )
}
