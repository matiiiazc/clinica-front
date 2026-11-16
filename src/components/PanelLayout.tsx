/** Navegación común de los paneles de paciente y personal clínico. */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  ClipboardList,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Stethoscope,
  Users,
} from 'lucide-react'

import { useAuth } from '../context/useAuth'
import type { Rol } from '../lib/types'
import BotonTema from './BotonTema'

interface Seccion {
  id: string
  label: string
  icono: typeof LayoutDashboard
}

const SECCIONES: Record<Rol, Seccion[]> = {
  admin: [
    { id: 'resumen', label: 'Resumen', icono: LayoutDashboard },
    { id: 'especialidades', label: 'Especialidades', icono: ClipboardList },
    { id: 'profesionales', label: 'Profesionales', icono: Users },
    { id: 'agenda', label: 'Agenda', icono: CalendarDays },
    { id: 'consultas', label: 'Consultas', icono: ListChecks },
    { id: 'cola', label: 'Cola de espera', icono: ClipboardList },
  ],
  recepcion: [
    { id: 'resumen', label: 'Resumen', icono: LayoutDashboard },
    { id: 'agenda', label: 'Agenda', icono: CalendarDays },
    { id: 'disponibles', label: 'Disponibles', icono: Stethoscope },
    { id: 'consultas', label: 'Consultas', icono: ListChecks },
    { id: 'cola', label: 'Cola de espera', icono: ClipboardList },
  ],
  medico: [
    { id: 'agenda', label: 'Mi agenda', icono: CalendarDays },
    { id: 'estado', label: 'Mi estado', icono: Stethoscope },
  ],
  paciente: [
    { id: 'turnos', label: 'Mis turnos', icono: CalendarDays },
    { id: 'pedir', label: 'Pedir turno', icono: Stethoscope },
    { id: 'ficha', label: 'Ficha médica', icono: HeartPulse },
    { id: 'historial', label: 'Historial clínico', icono: ClipboardList },
    { id: 'consultas', label: 'Consultas', icono: ListChecks },
  ],
}

export default function PanelLayout({
  children,
  seccion,
  onSeccion,
}: {
  children: React.ReactNode
  seccion: string
  onSeccion: (id: string) => void
}) {
  const { usuario, cerrarSesion } = useAuth()
  const navegar = useNavigate()
  const [saliendo, setSaliendo] = useState(false)

  const secciones = usuario ? (SECCIONES[usuario.rol] ?? []) : []
  const etiquetaActual = secciones.find((s) => s.id === seccion)?.label
  const nombre = usuario?.nombre || usuario?.email || 'Usuario'
  const inicial = nombre.trim().charAt(0).toLocaleUpperCase('es-AR') || 'U'

  useEffect(() => {
    document.title = etiquetaActual ? `Clínica · ${etiquetaActual}` : 'Clínica'
  }, [etiquetaActual])

  if (!usuario) return null

  async function handleLogout() {
    if (saliendo) return
    setSaliendo(true)
    try {
      await cerrarSesion()
      navegar('/login', { replace: true })
    } finally {
      setSaliendo(false)
    }
  }

  return (
    <div className="min-h-screen">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-40 focus:rounded-md focus:px-3 focus:py-1.5 focus:text-sm"
        style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-heading)' }}
      >
        Saltar al contenido
      </a>

      <header className="clinic-header">
        <div className="clinic-header-inner">
          <div className="clinic-header-brand">
            <span className="clinic-brand-mark">
              <HeartPulse size={20} aria-hidden="true" />
            </span>
            <span>
              <span className="clinic-brand-name">Clínica</span>
              <span className="clinic-brand-caption">Portal de atención</span>
            </span>
          </div>

          <div className="clinic-header-tools">
            <div className="clinic-user-chip">
              <span className="clinic-user-avatar" aria-hidden="true">{inicial}</span>
              <span className="min-w-0">
                <span className="clinic-user-name block">{nombre}</span>
                <span className="clinic-user-role block">{usuario.rol_display}</span>
              </span>
            </div>
            <BotonTema className="clinic-header-action" />
            <button
              type="button"
              onClick={() => navegar('/cambiar-contrasena')}
              className="clinic-header-action"
              title="Cambiar contraseña"
            >
              <KeyRound size={16} aria-hidden="true" />
              <span>Contraseña</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={saliendo}
              className="clinic-header-action"
            >
              <LogOut size={16} aria-hidden="true" />
              <span>{saliendo ? 'Saliendo…' : 'Salir'}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="clinic-workspace">
        <aside className="clinic-sidebar">
          <p className="clinic-sidebar-label">Secciones</p>
          <nav aria-label="Secciones del panel">
            <ul className="clinic-nav-list">
              {secciones.map((s) => {
                const Icono = s.icono
                const activo = seccion === s.id
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onSeccion(s.id)}
                      aria-current={activo ? 'page' : undefined}
                      className="clinic-nav-button"
                    >
                      <Icono size={17} aria-hidden="true" />
                      <span>{s.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>
        </aside>

        <main id="contenido" tabIndex={-1} className="clinic-main outline-none">
          <div className="clinic-main-inner page-enter flex flex-col gap-5">{children}</div>
        </main>
      </div>
    </div>
  )
}
