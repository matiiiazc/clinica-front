import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import AuthLayout from '../components/AuthLayout'
import { Aviso, Campo, Spinner } from '../components/ui'
import { api } from '../lib/api'
import { ApiError, type RespuestaRegistro } from '../lib/types'

export default function Register() {
  const navigate = useNavigate()

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [alergias, setAlergias] = useState('')
  const [cronicas, setCronicas] = useState('')
  const [medicacion, setMedicacion] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [cargando, setCargando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setErrores({})

    if (password !== passwordConfirm) {
      setErrores({ passwordConfirm: 'Las contraseñas no coinciden.' })
      return
    }

    setCargando(true)
    try {
      const data = await api.post<RespuestaRegistro>('/api/auth/register', {
        nombre,
        email,
        telefono,
        password,
        password_confirm: passwordConfirm,
        // La ficha de salud es obligatoria: el back la rechaza si falta.
        // "Ninguna" es una respuesta válida, el silencio no.
        ficha_alergias: alergias,
        ficha_enfermedades_cronicas: cronicas,
        ficha_medicacion: medicacion,
        ficha_observaciones: observaciones,
      })

      // El registro no abre sesión: hay que verificar el email primero.
      navigate('/verificar', {
        state: { email: data.user.email, devCode: data.dev_code ?? null },
      })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
        setErrores({
          nombre: err.mensajePorCampo('nombre') ?? '',
          email: err.mensajePorCampo('email') ?? '',
          telefono: err.mensajePorCampo('telefono') ?? '',
          password: err.mensajePorCampo('password') ?? '',
          password_confirm: err.mensajePorCampo('password_confirm') ?? '',
          ficha_alergias: err.mensajePorCampo('ficha_alergias') ?? '',
          ficha_enfermedades_cronicas:
            err.mensajePorCampo('ficha_enfermedades_cronicas') ?? '',
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
      titulo="Crear cuenta"
      subtitulo="Registrate como paciente para acceder a la clínica"
      pie={
        <>
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="font-medium hover:underline">
            Iniciá sesión
          </Link>
        </>
      }
    >
      <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        <Campo id="nombre" label="Nombre y apellido" error={errores.nombre || undefined}>
          <input
            id="nombre"
            className={`field-input ${errores.nombre ? 'field-input-error' : ''}`}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ana Perez"
            autoComplete="name"
            required
            autoFocus
          />
        </Campo>

        <Campo id="email" label="Email" error={errores.email || undefined}>
          <input
            id="email"
            type="email"
            className={`field-input ${errores.email ? 'field-input-error' : ''}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ana@correo.com"
            autoComplete="email"
            required
          />
        </Campo>

        <Campo id="telefono" label="Teléfono" error={errores.telefono || undefined} hint="Opcional">
          <input
            id="telefono"
            type="tel"
            className={`field-input ${errores.telefono ? 'field-input-error' : ''}`}
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="11 1234 5678"
            autoComplete="tel"
          />
        </Campo>

        <Campo
          id="password"
          label="Contraseña"
          error={errores.password || undefined}
          hint="Mínimo 8 caracteres"
        >
          <input
            id="password"
            type="password"
            className={`field-input ${errores.password ? 'field-input-error' : ''}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </Campo>

        <Campo
          id="passwordConfirm"
          label="Repetir contraseña"
          error={errores.passwordConfirm || undefined}
        >
          <input
            id="passwordConfirm"
            type="password"
            className={`field-input ${errores.passwordConfirm ? 'field-input-error' : ''}`}
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </Campo>

        <fieldset className="flex flex-col gap-4 border-t border-zinc-200 pt-4">
          <legend className="text-sm font-medium text-zinc-700">
            Ficha de salud
          </legend>
          <p className="text-xs text-zinc-500">
            La necesitamos para atenderte bien. Si no tenés nada, escribí
            &quot;Ninguna&quot;. Queda registrada y la ve el profesional que te
            atiende.
          </p>

          <Campo
            id="alergias"
            label="Alergias"
            error={errores.ficha_alergias || undefined}
            hint="Medicamentos, alimentos, látex…"
          >
            <textarea
              id="alergias"
              rows={2}
              className={`field-input ${errores.ficha_alergias ? 'field-input-error' : ''}`}
              value={alergias}
              onChange={(e) => setAlergias(e.target.value)}
              placeholder="Penicilina"
              required
            />
          </Campo>

          <Campo
            id="cronicas"
            label="Enfermedades crónicas"
            error={errores.ficha_enfermedades_cronicas || undefined}
            hint="Hipertensión, diabetes, asma…"
          >
            <textarea
              id="cronicas"
              rows={2}
              className={`field-input ${errores.ficha_enfermedades_cronicas ? 'field-input-error' : ''}`}
              value={cronicas}
              onChange={(e) => setCronicas(e.target.value)}
              placeholder="Ninguna"
              required
            />
          </Campo>

          <Campo id="medicacion" label="Medicación habitual" hint="Opcional">
            <textarea
              id="medicacion"
              rows={2}
              className="field-input"
              value={medicacion}
              onChange={(e) => setMedicacion(e.target.value)}
              placeholder="Losartan 50mg por la mañana"
            />
          </Campo>

          <Campo
            id="observaciones"
            label="Observaciones"
            hint="Opcional. Lo que creas que el profesional debería saber."
          >
            <textarea
              id="observaciones"
              rows={2}
              className="field-input"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </Campo>
        </fieldset>

        {error && <Aviso>{error}</Aviso>}

        <button type="submit" className="btn-primary" disabled={cargando}>
          {cargando && <Spinner size={16} />}
          {cargando ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>
    </AuthLayout>
  )
}
