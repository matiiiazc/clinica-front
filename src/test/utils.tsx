/**
 * Ayudas para las pruebas de pantallas.
 *
 * Casi todas las pantallas necesitan estar dentro de un Router (para los links)
 * y del ToastProvider (para los avisos). Esto lo arma en una línea.
 */

import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'

import { AuthContext, type AuthContextValue } from '../context/auth-context'
import { ToastProvider } from '../context/ToastProvider'
import type { EntradaCola, Usuario } from '../lib/types'

export function renderConApp(ui: ReactElement, { ruta = '/' }: { ruta?: string } = {}) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>,
  )
}

export function usuarioDePrueba(parcial: Partial<Usuario> = {}): Usuario {
  return {
    id: 'u-1',
    email: 'ana@correo.com',
    nombre: 'Ana Pérez',
    telefono: '',
    rol: 'recepcion',
    rol_display: 'Recepción',
    is_clinica: true,
    email_verified: true,
    must_change_password: false,
    date_joined: '2026-01-01T00:00:00Z',
    last_login: null,
    ...parcial,
  }
}

export function authDePrueba(parcial: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    usuario: null,
    cargando: false,
    iniciarSesion: () => undefined,
    cerrarSesion: async () => undefined,
    actualizarUsuario: () => undefined,
    ...parcial,
  }
}

export function renderConAuth(ui: ReactElement, auth: AuthContextValue, { ruta = '/' }: { ruta?: string } = {}) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <AuthContext.Provider value={auth}>
        <ToastProvider>{ui}</ToastProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

/** Una entrada de la cola con valores razonables; se pisa lo que importe. */
export function entradaDePrueba(parcial: Partial<EntradaCola> = {}): EntradaCola {
  return {
    id: 1,
    paciente: 'Paciente Uno',
    paciente_id: 'p-1',
    especialidad: 'Clínica médica',
    especialidad_id: 1,
    medico: null,
    medico_id: null,
    estado: 'esperando',
    desde: null,
    hasta: null,
    nota: '',
    turno: null,
    creado: new Date().toISOString(),
    ...parcial,
  }
}

/** ISO de "hace N minutos". */
export function haceMinutos(minutos: number): string {
  return new Date(Date.now() - minutos * 60_000).toISOString()
}
