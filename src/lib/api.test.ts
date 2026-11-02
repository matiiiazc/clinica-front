import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api, apiFetch, mensajeHttp } from './api'
import { ErrorDeFormulario, esErrorDeRed, mensajeDeError } from './errores'
import { getAccessToken, setAccessToken } from './session'
import { ApiError } from './types'

/** Respuesta JSON falsa, con la forma mínima que usa `apiFetch`. */
function respuesta(status: number, cuerpo?: unknown): Response {
  return new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const fetchMock = vi.fn()

/** Espera que la promesa falle y devuelve el error ya tipado como ApiError. */
async function fallo(promesa: Promise<unknown>): Promise<ApiError> {
  try {
    await promesa
  } catch (e) {
    return e as ApiError
  }
  throw new Error('Se esperaba que fallara y no falló.')
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken(null)
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

describe('apiFetch — camino feliz', () => {
  it('manda JSON con credenciales y devuelve el cuerpo', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(200, { ok: true }))

    const datos = await api.post<{ ok: boolean }>('/api/algo', { a: 1 })

    expect(datos).toEqual({ ok: true })
    const [url, opciones] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/algo')
    expect(opciones.method).toBe('POST')
    expect(opciones.credentials).toBe('include')
    expect(opciones.headers['Content-Type']).toBe('application/json')
    expect(opciones.body).toBe(JSON.stringify({ a: 1 }))
  })

  it('agrega el token de acceso como Bearer', async () => {
    setAccessToken('token-123')
    fetchMock.mockResolvedValueOnce(respuesta(200, {}))

    await api.get('/api/algo')

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token-123')
  })

  it('un 204 devuelve undefined', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await expect(api.delete('/api/algo/1')).resolves.toBeUndefined()
  })
})

describe('apiFetch — errores', () => {
  it('usa el detail del back en un 400', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(400, { code: 'invalid', detail: 'Datos inválidos.' }))

    const error = await fallo(apiFetch('/api/x'))

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(400)
    expect(error.message).toBe('Datos inválidos.')
  })

  it('arma el mensaje por campo con `errors`', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(400, { code: 'invalid', errors: { email: ['Ya existe.'] } }))

    const error = await fallo(apiFetch('/api/x'))

    expect(error.mensajePorCampo('email')).toBe('Ya existe.')
    expect(error.mensajePorCampo('otro')).toBeUndefined()
    expect(error.message).toBe('Ya existe.')
  })

  it('un error de red se normaliza a ApiError con status 0', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const error = await fallo(apiFetch('/api/x'))

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(0)
    expect(error.message).toMatch(/No se pudo conectar/)
    expect(esErrorDeRed(error)).toBe(true)
  })

  it('un 500 muestra un texto amigable y no el detalle técnico del servidor', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(500, { detail: 'Traceback (most recent call last): ...' }))

    const error = await fallo(apiFetch('/api/x'))

    expect(error.message).toMatch(/problema/)
    expect(error.message).not.toMatch(/Traceback/)
  })

  it('un 502 sin JSON (proxy caído) también da el texto amigable', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>Bad gateway</html>', { status: 502 }))

    const error = await fallo(apiFetch('/api/x'))

    expect(error.status).toBe(502)
    expect(error.message).toMatch(/problema/)
  })

  it('el límite de intentos (429 / throttled) se explica en español', async () => {
    fetchMock.mockResolvedValueOnce(
      respuesta(429, { code: 'throttled', detail: 'Request was throttled. Expected available in 897 seconds.' }),
    )

    const error = await fallo(apiFetch('/api/x'))

    expect(error.message).toMatch(/demasiados intentos/)
    expect(error.message).not.toMatch(/throttled/)
  })

  it.each([
    [403, /permiso/],
    [404, /No encontramos/],
  ])('un %i sin detail usa el texto por defecto', async (status, patron) => {
    fetchMock.mockResolvedValueOnce(respuesta(status, {}))
    const error = await fallo(apiFetch('/api/x'))
    expect(error.message).toMatch(patron)
  })

  it('mensajeHttp no inventa texto para un 400', () => {
    expect(mensajeHttp(400)).toBeUndefined()
  })
})

describe('apiFetch — renovación de la sesión (401)', () => {
  it('renueva el token y reintenta UNA vez', async () => {
    setAccessToken('viejo')
    fetchMock
      .mockResolvedValueOnce(respuesta(401, { detail: 'expirado' })) // request original
      .mockResolvedValueOnce(respuesta(200, { tokens: { access: 'nuevo', refresh: 'r' }, user: {} })) // refresh
      .mockResolvedValueOnce(respuesta(200, { dato: 42 })) // reintento

    const datos = await api.get<{ dato: number }>('/api/protegido')

    expect(datos).toEqual({ dato: 42 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/refresh')
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer nuevo')
    expect(getAccessToken()).toBe('nuevo')
  })

  it('si el refresh falla, cierra la sesión con session_expired', async () => {
    setAccessToken('viejo')
    localStorage.setItem('clinica_usuario', '{}')
    fetchMock
      .mockResolvedValueOnce(respuesta(401, {}))
      .mockResolvedValueOnce(respuesta(401, {})) // el refresh también falla

    const error = await fallo(api.get('/api/protegido'))

    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('session_expired')
    expect(getAccessToken()).toBeNull()
    expect(localStorage.getItem('clinica_usuario')).toBeNull()
  })

  it('no entra en bucle: si el reintento vuelve a dar 401, falla', async () => {
    fetchMock
      .mockResolvedValueOnce(respuesta(401, {}))
      .mockResolvedValueOnce(respuesta(200, { tokens: { access: 'nuevo', refresh: 'r' }, user: {} }))
      .mockResolvedValueOnce(respuesta(401, { detail: 'sigue sin permiso' }))

    const error = await fallo(api.get('/api/protegido'))

    expect(error.status).toBe(401)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})

describe('apiFetch — rutas públicas', () => {
  it('un 401 en el login (clave incorrecta) NO intenta renovar la sesión y muestra el mensaje del back', async () => {
    fetchMock.mockResolvedValueOnce(respuesta(401, { code: 'invalid_credentials', detail: 'Email o contraseña incorrectos.' }))

    const error = await fallo(api.post('/api/auth/login', { email: 'a@b.com', password: 'x' }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(error.code).toBe('invalid_credentials')
    expect(error.message).toBe('Email o contraseña incorrectos.')
  })
})

describe('mensajeDeError', () => {
  it('muestra el mensaje de ApiError y de ErrorDeFormulario', () => {
    expect(mensajeDeError(new ApiError(400, 'x', 'Mal dato'))).toBe('Mal dato')
    expect(mensajeDeError(new ErrorDeFormulario('Elegí un paciente'))).toBe('Elegí un paciente')
  })

  it('NO filtra el texto de errores inesperados (pueden ser técnicos)', () => {
    expect(mensajeDeError(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(
      'No se pudo completar la operación.',
    )
    expect(mensajeDeError('texto suelto', 'Falló')).toBe('Falló')
  })
})
