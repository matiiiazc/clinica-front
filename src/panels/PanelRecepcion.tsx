/**
 * Panel de recepción.
 *
 * Recepción es la mesa de ayuda: ve toda la agenda, asigna turnos, responde
 * consultas y ordena la cola. No toca la configuración de la clínica, así que
 * las secciones de consultas, cola y agenda se importan de `PanelAdmin` en vez
 * de duplicarse. Lo propio de este panel es la búsqueda de paciente y el alta
 * de turno, que son las dos cosas que recepción hace y nadie más.
 */

import { useEffect, useState } from 'react'

import {
  Aviso,
  Badge,
  BarraFiltros,
  BotonChico,
  Campo,
  Card,
  Cargando,
  Metrica,
  Select,
  Vacio,
} from '../components/ui'
import { clinica } from '../lib/api'
import { aInputDate, formatearRelativo, formatearRango } from '../lib/fechas'
import { useAccion, useCarga } from '../lib/useCarga'
import { useConfirmacion } from '../lib/usePanel'
import type { Especialidad, PacienteBusqueda, ResumenPanel } from '../lib/types'
import { SeccionAgenda, SeccionCola, SeccionConsultas } from './PanelAdmin'
import { AccionesDePersonal, TablaTurnos } from './comunes'

export default function PanelRecepcion({ seccion }: { seccion: string }) {
  switch (seccion) {
    case 'agenda':
      return <SeccionAgendaRecepcion />
    case 'disponibles':
      return <SeccionDisponibles />
    case 'consultas':
      return <SeccionConsultas />
    case 'cola':
      return <SeccionCola />
    default:
      return <SeccionResumenRecepcion />
  }
}

function SeccionResumenRecepcion() {
  const { datos, cargando, error } = useCarga<ResumenPanel>(() => clinica.resumen(), [])
  const { datos: hoy, cargando: cargandoHoy } = useCarga(
    () => clinica.turnos({ desde: aInputDate(), hasta: aInputDate() }),
    [],
  )

  if (cargando) return <Cargando filas={3} />
  if (error) return <Aviso>{error}</Aviso>

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Metrica valor={datos?.medicos_libres ?? 0} etiqueta="Profesionales libres" />
        <Metrica valor={datos?.turnos_hoy ?? 0} etiqueta="Turnos hoy" tono="acento" />
        <Metrica valor={datos?.turnos_pendientes ?? 0} etiqueta="Sin confirmar" />
        <Metrica
          valor={datos?.consultas_abiertas ?? 0}
          etiqueta="Consultas abiertas"
          tono={datos?.consultas_abiertas ? 'alerta' : 'neutro'}
        />
        <Metrica valor={datos?.esperando ?? 0} etiqueta="En cola" />
      </div>

      <Card titulo="Turnos de hoy">
        {cargandoHoy ? (
          <Cargando filas={4} />
        ) : (
          <TablaTurnos
            turnos={hoy?.results ?? []}
            cargando={false}
            columnas="medico"
            renderAcciones={(turno) => (
              <AccionesDePersonal turno={turno} onEstado={() => undefined} />
            )}
          />
        )}
      </Card>
    </>
  )
}

// ---------------------------------------------------------------------------
// Alta de turno
// ---------------------------------------------------------------------------

function SeccionAgendaRecepcion() {
  return (
    <>
      <FormAltaTurno />
      <SeccionAgenda />
    </>
  )
}

function FormAltaTurno() {
  const [busqueda, setBusqueda] = useState('')
  const [paciente, setPaciente] = useState<PacienteBusqueda | null>(null)
  const [medicoId, setMedicoId] = useState('')
  const [fecha, setFecha] = useState(aInputDate())
  const [hora, setHora] = useState('09:00')
  const [motivo, setMotivo] = useState('')
  const [exito, setExito] = useState<string | null>(null)

  const { datos: medicos } = useCarga(() => clinica.medicos({ disponibles: true }), [])
  const { dialogo, pedirConfirmacion } = useConfirmacion()

  const [crear, creando, errorCrear] = useAccion(async () => {
    if (!paciente) throw new Error('Elegí un paciente de la lista.')
    const inicio = new Date(`${fecha}T${hora}`)
    const turno = await clinica.crearTurno({
      paciente: paciente.id,
      medico: Number(medicoId),
      inicio: inicio.toISOString(),
      motivo,
    })
    setExito(`Turno confirmado para ${turno.paciente} con ${turno.medico_nombre}.`)
    setMotivo('')
    setPaciente(null)
    setBusqueda('')
  })

  const medicoElegido = (medicos?.results ?? []).find((m) => m.id === Number(medicoId))
  const puedeCrear = Boolean(paciente && medicoId && fecha && hora) && !creando

  return (
    <Card
      titulo="Asignar un turno"
      descripcion="Buscá al paciente por nombre o email, elegí profesional y horario."
    >
      <div className="flex flex-col gap-3">
        <div>
          <label className="field-label" htmlFor="buscar-paciente">
            Paciente
          </label>

          {paciente ? (
            <div
              className="flex items-center justify-between rounded-md border px-3 py-2"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div>
                <div className="text-sm font-medium">{paciente.nombre}</div>
                <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {paciente.email}
                  {!paciente.email_verificado && ' · sin verificar'}
                </div>
              </div>
              <BotonChico onClick={() => setPaciente(null)}>Cambiar</BotonChico>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  id="buscar-paciente"
                  className="field-input"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Nombre o email del paciente"
                />
              </div>
              <BuscadorPacientes texto={busqueda} alElegir={setPaciente} />
            </>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Campo id="turno-medico" label="Profesional" hint="Solo los que están libres.">
            <select
              id="turno-medico"
              className="field-input"
              value={medicoId}
              onChange={(e) => setMedicoId(e.target.value)}
            >
              <option value="">Elegir...</option>
              {(medicos?.results ?? []).map((medico) => (
                <option key={medico.id} value={medico.id}>
                  {medico.nombre_completo} — {medico.especialidad}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="turno-fecha" label="Fecha">
            <input
              id="turno-fecha"
              type="date"
              className="field-input"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </Campo>
          <Campo id="turno-hora" label="Hora">
            <input
              id="turno-hora"
              type="time"
              className="field-input"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            />
          </Campo>
        </div>

        <Campo id="turno-motivo" label="Motivo de consulta">
          <input
            id="turno-motivo"
            className="field-input"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={200}
            placeholder="Opcional"
          />
        </Campo>

        {errorCrear && <Aviso>{errorCrear}</Aviso>}
        {exito && <Aviso tipo="exito">{exito}</Aviso>}

        <div className="flex justify-end">
          <button
            type="button"
            className="btn-primary"
            disabled={!puedeCrear}
            onClick={() =>
              pedirConfirmacion(
                `¿Agendar el turno para ${paciente?.nombre} con ${medicoElegido?.nombre_completo}?`,
                () => crear(),
              )
            }
          >
            {creando ? 'Agendando...' : 'Agendar turno'}
          </button>
        </div>
      </div>

      {dialogo}
    </Card>
  )
}

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
function BuscadorPacientes({
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

// ---------------------------------------------------------------------------
// Disponibilidad
// ---------------------------------------------------------------------------

function SeccionDisponibles() {
  const [fecha, setFecha] = useState(aInputDate())
  const [especialidad, setEspecialidad] = useState('')

  const { datos: especialidades } = useCarga<Especialidad[]>(() => clinica.especialidades(), [])
  const { datos, cargando, error } = useCarga(
    () =>
      clinica.disponibilidad({
        fecha,
        especialidad: especialidad ? Number(especialidad) : undefined,
      }),
    [fecha, especialidad],
  )

  const conHuecos = (datos?.medicos ?? []).filter((m) => m.horarios.length > 0)

  return (
    <>
      <BarraFiltros>
        <div>
          <label className="field-label" htmlFor="disp-fecha">
            Fecha
          </label>
          <input
            id="disp-fecha"
            type="date"
            className="field-input h-9 w-auto py-1"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="disp-esp">
            Especialidad
          </label>
          <Select id="disp-esp" value={especialidad} onChange={setEspecialidad}>
            <option value="">Todas</option>
            {(especialidades ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </Select>
        </div>
      </BarraFiltros>

      {error && <Aviso>{error}</Aviso>}

      <Card
        titulo={`Horarios libres del ${fecha}`}
        descripcion=" sale de la agenda menos los turnos tomados y los bloqueos."
      >
        {cargando ? (
          <Cargando filas={3} />
        ) : conHuecos.length === 0 ? (
          <Vacio
            titulo="Nadie tiene horario libre ese día"
            descripcion="Revisá si los profesionales tienen agenda cargada o si ya se llenaron los turnos."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {conHuecos.map((medico) => (
              <li key={medico.medico_id}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium">{medico.medico}</span>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {medico.especialidad} · {medico.duracion_minutos} min
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {medico.horarios.map((horario) => (
                    <span
                      key={horario}
                      className="rounded-md border px-2 py-1 text-xs tabular-nums"
                      style={{ borderColor: 'var(--color-border)' }}
                      title={formatearRelativo(horario)}
                    >
                      {formatearRango(horario, new Date(new Date(horario).getTime() + medico.duracion_minutos * 60000).toISOString())}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}