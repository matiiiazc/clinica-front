import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { MailCheck } from 'lucide-react'

import AuthLayout from '../components/AuthLayout'
import { Aviso, Campo, Spinner } from '../components/ui'
import { useAuth } from '../context/useAuth'
import { api } from '../lib/api'
import { ApiError, type RespuestaSesion } from '../lib/types'

const LARGO_CODIGO = 6

interface EstadoInicial {
  email?: string
  devCode?: string | null
}

export default function VerifyEmail() {
  const navigate = useNavigate()
  const location = useLocation()
  const { iniciarSesion } = useAuth()
  const inicial = (location.state as EstadoInicial | null) ?? {}

  const [email, setEmail] = useState(inicial.email ?? '')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [segundosParaReenviar, setSegundosParaReenviar] = useState(0)
  const inputCodigo = useRef<HTMLInputElement>(null)

  // Cuenta regresiva del botón de reenvío.
  useEffect(() => {
    if (segundosParaReenviar <= 0) return
    const timer = setTimeout(() => setSegundosParaReenviar((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [segundosParaReenviar])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    try {
      const data = await api.post<RespuestaSesion>('/api/auth/verify-email', {
        email,
        code: codigo,
      })
      // Verificar ya abre sesión: el back devuelve los tokens.
      iniciarSesion(data)
      navigate('/app', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor.')
      setCodigo('')
      inputCodigo.current?.focus()
    } finally {
      setCargando(false)
    }
  }

  async function reenviar() {
    setError(null)
    try {
      const data = await api.post<{ dev_code?: string | null }>('/api/auth/resend-code', { email })
      setSegundosParaReenviar(60)
      if (data.dev_code) setCodigo(data.dev_code)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo reenviar el código.')
    }
  }

  return (
    <AuthLayout
      titulo="Verificá tu email"
      subtitulo={
        inicial.email
          ? `Te enviamos un código de ${LARGO_CODIGO} dígitos a ${inicial.email}`
          : `Ingresá el código de ${LARGO_CODIGO} dígitos que te enviamos por email`
      }
      pie={
        <>
          ¿Ya lo verificaste?{' '}
          <Link to="/login" className="font-medium hover:underline">
            Iniciá sesión
          </Link>
        </>
      }
    >
      <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        {!inicial.email && (
          <Campo id="email" label="Email">
            <input
              id="email"
              type="email"
              className="field-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              autoFocus
            />
          </Campo>
        )}

        <Campo id="codigo" label="Código de verificación">
          <input
            id="codigo"
            ref={inputCodigo}
            className="field-input text-center text-2xl tracking-[0.5em]"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, LARGO_CODIGO))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={LARGO_CODIGO}
            required
            autoFocus={!inicial.email}
          />
        </Campo>

        {inicial.devCode && (
          <Aviso tipo="exito">
            <strong>Modo desarrollo:</strong> el código es {inicial.devCode} (no hay SMTP
            configurado, el backend lo muestra en vez de mandarlo por email).
          </Aviso>
        )}

        {error && <Aviso>{error}</Aviso>}

        <button
          type="submit"
          className="btn-primary"
          disabled={cargando || codigo.length !== LARGO_CODIGO}
        >
          {cargando && <Spinner size={16} />}
          {cargando ? 'Verificando...' : 'Verificar email'}
        </button>

        <button
          type="button"
          className="btn-ghost"
          onClick={reenviar}
          disabled={segundosParaReenviar > 0 || !email}
        >
          {segundosParaReenviar > 0
            ? `Podés pedir otro código en ${segundosParaReenviar}s`
            : 'No recibí el código, envialo de nuevo'}
        </button>
      </form>

      <p
        className="mt-6 flex items-start gap-2 text-xs"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <MailCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        El código vence a los 10 minutos y sirve una sola vez.
      </p>
    </AuthLayout>
  )
}
