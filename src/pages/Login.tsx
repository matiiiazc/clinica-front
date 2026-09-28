import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import AuthLayout from '../components/AuthLayout'
import { Aviso, Campo, Spinner } from '../components/ui'
import { useAuth } from '../context/useAuth'
import { api } from '../lib/api'
import { ApiError, type RespuestaSesion } from '../lib/types'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { iniciarSesion } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [recordarme, setRecordarme] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorCampo, setErrorCampo] = useState<Record<string, string>>({})
  const [cargando, setCargando] = useState(false)

  const destino = (location.state as { from?: string } | null)?.from ?? '/app'

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setErrorCampo({})
    setCargando(true)

    try {
      const data = await api.post<RespuestaSesion>('/api/auth/login', {
        // Si la clave se pega desde un chat o un email suele arrastrar un
        // espacio o salto de linea, y el back la rechaza sin explicar mas.
        email: email.trim(),
        password: password.trim(),
        remember_me: recordarme,
      })
      iniciarSesion(data)

      // Los usuarios de la clinica que aun generaron su clave temporal tienen
      // que cambiarla antes de operar.
      navigate(data.user.must_change_password ? '/cambiar-contrasena' : destino, {
        replace: true,
      })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
        setErrorCampo({
          email: err.mensajePorCampo('email') ?? '',
          password: err.mensajePorCampo('password') ?? '',
        })
      } else {
        setError('No se pudo conectar con el servidor.')
      }
    } finally {
      setCargando(false)
    }
  }

  return (
    <AuthLayout
      titulo="Iniciar sesión"
      subtitulo="Ingresá con tu email y contraseña"
      pie={
        <>
          ¿No tenés cuenta?{' '}
          <Link to="/registro" className="font-medium hover:underline">
            Registrate
          </Link>
        </>
      }
    >
      <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        <Campo id="email" label="Email" error={errorCampo.email || undefined}>
          <input
            id="email"
            type="email"
            className={`field-input ${errorCampo.email ? 'field-input-error' : ''}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ana@correo.com"
            autoComplete="email"
            required
            autoFocus
          />
        </Campo>

        <Campo id="password" label="Contraseña" error={errorCampo.password || undefined}>
          <input
            id="password"
            type="password"
            className={`field-input ${errorCampo.password ? 'field-input-error' : ''}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </Campo>

        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          <input
            type="checkbox"
            checked={recordarme}
            onChange={(e) => setRecordarme(e.target.checked)}
            className="accent-current"
          />
          Recordarme en este dispositivo
        </label>

        {error && <Aviso>{error}</Aviso>}

        <button type="submit" className="btn-primary" disabled={cargando}>
          {cargando && <Spinner size={16} />}
          {cargando ? 'Entrando...' : 'Iniciar sesión'}
        </button>
      </form>
    </AuthLayout>
  )
}
