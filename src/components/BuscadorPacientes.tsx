/**
 * Buscador de pacientes con resultados.
 *
 * Lo usa el alta de turnos (recepción), por eso vive
 * en `components` y no dentro de un panel.
 *
 * Detalle del diseño, que viene del original: la búsqueda va al backend recién
 * con dos caracteres o más, y con un debounce para no pedir una vez por tecla.
 */

import { useEffect, useState } from 'react'

import { clinica } from '../lib/api'
import type { PacienteBusqueda } from '../lib/types'
import { Aviso, Badge, Vacio } from './ui'

/**
 * Buscador con resultados.
 *
 * La búsqueda va al backend recién con dos caracteres o más: el endpoint corta
 * antes para no devolver media base. Se pide con un debounce porque cada tecla
 * sería un request.
 *
 * Los resultados se guardan junto con la consulta que los produjo y se derives
 * en el render, en vez de limpiar con `setState` dentro del efecto: si no, hay
 * un render de más en cada tecla y React avisa.
 */
export default function BuscadorPacientes({
  texto,
  alElegir,
}: {
  texto: string
  alElegir: (paciente: PacienteBusqueda) => void
}) {
  const [consulta, setConsulta] = useState('')
  const [respuesta, setRespuesta] = useState<{ q: string; datos: PacienteBusqueda[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Debounce: 350 ms alcanza para no disparar un request por tecla sin hacer
  // esperar lo suficiente como para que el tipeo se sienta lento.
  useEffect(() => {
    if (texto.trim().length < 2) return
    const id = setTimeout(() => setConsulta(texto.trim()), 350)
    return () => clearTimeout(id)
  }, [texto])

  useEffect(() => {
    if (!consulta) return
    let vigente = true
    clinica
      .buscarPacientes(consulta)
      .then((datos) => {
        if (vigente) {
          setRespuesta({ q: consulta, datos })
          setError(null)
        }
      })
      .catch(() => {
        if (vigente) setError('No se pudo buscar. Probá de nuevo.')
      })
    return () => {
      vigente = false
    }
  }, [consulta])

  const habilitado = texto.trim().length >= 2
  // Mientras la respuesta no corresponde a la consulta vigente, se muestra
  // "buscando". Se deriva en vez de llevar otro estado que hay que acordarse de
  // bajar en el `finally`.
  const buscando = habilitado && respuesta?.q !== consulta
  const resultados = respuesta?.q === consulta ? respuesta.datos : []
  const mostro = habilitado && resultados.length > 0

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            setConsulta(texto.trim())
            setError(null)
          }}
          disabled={!habilitado}
        >
          Buscar
        </button>
        {buscando && (
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Buscando...
          </span>
        )}
        {!habilitado && (
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Escribí al menos 2 letras.
          </span>
        )}
      </div>

      {error && <Aviso>{error}</Aviso>}

      {habilitado && !mostro && !buscando && !error && (
        <Vacio titulo="Sin resultados" descripcion="Probá con otra parte del nombre o del email." />
      )}

      {mostro && (
        <ul className="flex flex-col gap-1">
          {resultados.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => alElegir(p)}
                className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left hover:opacity-80"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <span>
                  <span className="text-sm font-medium">{p.nombre}</span>
                  <span className="ml-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {p.email}
                  </span>
                </span>
                {!p.email_verificado && <Badge tono="peligro">Sin verificar</Badge>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
