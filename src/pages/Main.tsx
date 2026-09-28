/**
 * Pantalla principal. Es un placeholder a propósito: el diseño y las secciones
 * definitivas todavía no están definidos, así que acá solo se confirma que la
 * sesión quedó abierta y se da la opción de cambiar la contraseña o salir.
 */

import { KeyRound, LogOut, Stethoscope } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../context/useAuth'

export default function Main() {
  const { usuario, cerrarSesion } = useAuth()
  const navigate = useNavigate()

  async function salir() {
    await cerrarSesion()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4">
          <span className="font-semibold" style={{ color: 'var(--color-text-heading)' }}>
            Clínica
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => navigate('/cambiar-contrasena')}
              title="Cambiar contraseña"
            >
              <KeyRound size={16} />
              <span className="hidden sm:inline">Contraseña</span>
            </button>
            <button type="button" className="btn-ghost" onClick={salir} title="Cerrar sesión">
              <LogOut size={16} />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="page-enter w-full max-w-md text-center">
          <div
            className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <Stethoscope size={26} style={{ color: 'var(--color-accent)' }} aria-hidden="true" />
          </div>

          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ color: 'var(--color-text-heading)' }}
          >
            Próximamente
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Acá van a estar los turnos, los profesionales y la historia clínica.
          </p>

          {usuario && (
            <div
              className="mt-8 rounded-xl p-4 text-left text-sm"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <p className="font-medium" style={{ color: 'var(--color-text-heading)' }}>
                Sesión iniciada
              </p>
              <dl className="mt-2 space-y-1" style={{ color: 'var(--color-text-muted)' }}>
                <div className="flex justify-between gap-4">
                  <dt>Email</dt>
                  <dd className="truncate">{usuario.email}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Rol</dt>
                  <dd>{usuario.rol_display}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Email verificado</dt>
                  <dd>{usuario.email_verified ? 'Sí' : 'No'}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
