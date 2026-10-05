/**
 * Panel del paciente.
 *
 * Es el único rol que se registra solo, así que todo lo que ve es suyo: sus
 * turnos, su ficha, sus consultas y su lugar en la cola. Lo único que elige es la
 * especialidad, no el profesional: el sistema le asigna el primero con horario
 * libre, que es lo que se acordó en el sprint.
 */

import { useState } from 'react'

import { Aviso, Card, Cargando, Metrica } from '../components/ui'
import { clinica } from '../lib/api'
import { formatearRelativo, formatearRango, sumarMinutos } from '../lib/fechas'
import { useAccion, useCarga } from '../lib/useCarga'
import { useConfirmacion } from '../lib/usePanel'
import { ApiError } from '../lib/types'
import type {
  Consulta,
  EntradaCola,
  Especialidad,
  FichaMedica,
  RespuestaDisponibilidad,
  ResumenPanel,
  Turno,
} from '../lib/types'
import { AccionesDePaciente, ListaCola, ListaConsultas, TablaTurnos } from './comunes'

export default function PanelPaciente({ seccion }: { seccion: string }) {
  switch (seccion) {
    case 'pedir':
      return <SeccionPedirTurno />
    case 'ficha':
      return <SeccionFicha />
    case 'consultas':
      return <SeccionConsultasPaciente />
    default:
      return <SeccionTurnosPaciente />
  }
}

// ---------------------------------------------------------------------------
// Turnos
// ---------------------------------------------------------------------------

function SeccionTurnosPaciente() {
  const [historico, setHistorico] = useState(false)

  const { datos, cargando, recargar } = useCarga<Turno[]>(
    () => clinica.misTurnos({ historico: historico || undefined }),
    [historico],
  )
  const { datos: resumen } = useCarga<ResumenPanel>(() => clinica.resumen(), [])

  const { dialogo, pedirConfirmacion } = useConfirmacion()

  const [cambiar, cambiando, error] = useAccion(
    async (turno: Turno, estado: 'confirmado' | 'cancelado') => {
      await clinica.cambiarEstadoTurno(turno.id, estado)
      await recargar()
    },
  )

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metrica valor={resumen?.turnos_proximos ?? 0} etiqueta="Turnos próximos" tono="acento" />
        <Metrica valor={resumen?.en_cola ?? 0} etiqueta="En cola de espera" />
        <Metrica valor={resumen?.consultas_abiertas ?? 0} etiqueta="Consultas abiertas" />
        <Metrica
          valor={resumen?.ficha_verificada ? 'Sí' : 'No'}
          etiqueta="Ficha verificada"
          tono={resumen?.ficha_verificada ? 'acento' : 'neutro'}
        />
      </div>

      {error && <Aviso>{error}</Aviso>}

      {resumen && !resumen.ficha_verificada && (
        <Aviso>
          Tu ficha médica todavía no fue revisada por un profesional. Podés pedir turno igual, pero
          conviene completarla.
        </Aviso>
      )}

      <Card
        titulo="Mis turnos"
        acciones={
          <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <input
              type="checkbox"
              checked={historico}
              onChange={(e) => setHistorico(e.target.checked)}
            />
            Ver cancelados y pasados
          </label>
        }
      >
        <TablaTurnos
          turnos={datos ?? []}
          cargando={cargando}
          columnas="solo_paciente"
          renderAcciones={(turno) => (
            <AccionesDePaciente
              turno={turno}
              cancelando={cambiando}
              onCancelar={() =>
                pedirConfirmacion(
                  `¿Cancelar tu turno con ${turno.medico_nombre}? Se libera el horario para otra persona.`,
                  () => cambiar(turno, 'cancelado'),
                )
              }
              onConfirmar={() => cambiar(turno, 'confirmado')}
            />
          )}
        />
      </Card>

      <SeccionColaPaciente />
      {dialogo}
    </>
  )
}

function SeccionColaPaciente() {
  const { datos, cargando } = useCarga<EntradaCola[]>(() => clinica.cola('esperando'), [])

  if (cargando) return null
  if ((datos ?? []).length === 0) return null

  return (
    <Card titulo="Tu lugar en la cola de espera">
      <ListaCola
        entradas={datos ?? []}
        cargando={false}
        puedeGestionar={false}
        onPrioridad={() => undefined}
        onAgendar={() => undefined}
      />
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Pedir turno
// ---------------------------------------------------------------------------

function SeccionPedirTurno() {
  const [especialidadId, setEspecialidadId] = useState('')
  const [fecha, setFecha] = useState(aInputHoy())
  const [horario, setHorario] = useState('')
  const [motivo, setMotivo] = useState('')
  const [exito, setExito] = useState<string | null>(null)
  const [puedeEsperar, setPuedeEsperar] = useState<number | null>(null)

  const { datos: especialidades, cargando: cargandoEsp } = useCarga<Especialidad[]>(
    () => clinica.especialidades(),
    [],
  )
  const { datos: disponibilidad, cargando: cargandoDisp } = useCarga<RespuestaDisponibilidad | null>(
    () =>
      especialidadId
        ? clinica.disponibilidad({ fecha, especialidad: Number(especialidadId) })
        : Promise.resolve(null),
    [fecha, especialidadId],
  )

  // Los horarios vienen con el offset del servidor. `<input type="datetime-local">`
  // no entiende "2026-06-15T10:00:00-03:00", asi que se recorta a los minutos
  // locales: el substring no convierte nada, solo saca el offset.
  //
  // La duracion viaja por medico y no por horario: es la de la especialidad, y
  // varia (clinica general dura 20, el resto 30). Sin arrastrarla, el selector
  // terminaria mostrando "10:00 - 10:00".
  const opciones = (disponibilidad?.medicos ?? []).flatMap((medico) =>
    medico.horarios.map((iso) => ({
      iso,
      medico: medico.medico,
      especialidad: medico.especialidad,
      minutos: medico.duracion_minutos,
    })),
  )

  const [solicitando, setSolicitando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * El 409 no es un fallo: es la respuesta que el backend da cuando en esa
   * franja no queda ningún profesional libre. Por eso se maneja acá y no en el
   * `error` genérico: el mensaje dice que se puede entrar a la cola, y mostrarlo
   * como error rojo escondería la salida.
   */
  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setExito(null)
    setError(null)
    setPuedeEsperar(null)

    if (!especialidadId || !horario) return

    setSolicitando(true)
    try {
      const turno = await clinica.solicitarTurno({
        especialidad: Number(especialidadId),
        inicio: new Date(horario).toISOString(),
        motivo,
      })
      setExito(`Listo: tu turno quedó pedido con ${turno.medico_nombre}.`)
      setHorario('')
      setMotivo('')
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setPuedeEsperar(Number(especialidadId))
      } else {
        setError(e instanceof ApiError ? e.message : 'No se pudo pedir el turno.')
      }
    } finally {
      setSolicitando(false)
    }
  }

  return (
    <>
      <Card
        titulo="Pedir un turno"
        descripcion="Elegís la especialidad y el horario. Te asignamos el primer profesional libre."
      >
        <form onSubmit={enviar} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="field-label" htmlFor="pedir-esp">
                Especialidad
              </label>
              <select
                id="pedir-esp"
                className="field-input"
                value={especialidadId}
                onChange={(e) => {
                  setEspecialidadId(e.target.value)
                  setHorario('')
                }}
              >
                <option value="">Elegir...</option>
                {(especialidades ?? [])
                  .filter((e) => e.activa && e.medicos_disponibles > 0)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre} · {e.duracion_turno_minutos} min
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="pedir-fecha">
                Fecha
              </label>
              <input
                id="pedir-fecha"
                type="date"
                className="field-input"
                value={fecha}
                onChange={(e) => {
                  setFecha(e.target.value)
                  setHorario('')
                }}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="pedir-hora">
                Horario
              </label>
              <select
                id="pedir-hora"
                className="field-input"
                value={horario}
                onChange={(e) => setHorario(e.target.value)}
                disabled={!especialidadId || cargandoDisp}
              >
                <option value="">
                  {cargandoDisp ? 'Buscando...' : opciones.length ? 'Elegir...' : 'Sin horarios'}
                </option>
                {opciones.map((opcion) => (
                  <option key={opcion.iso} value={opcion.iso}>
                    {formatearRango(opcion.iso, sumarMinutos(opcion.iso, opcion.minutos))} · {opcion.medico}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="pedir-motivo">
              Motivo de consulta
            </label>
            <input
              id="pedir-motivo"
              className="field-input"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={200}
              placeholder="Opcional"
            />
          </div>

          {cargandoEsp && <span className="text-xs">Cargando especialidades...</span>}

          {opciones.length === 0 && especialidadId && !cargandoDisp && (
            <Aviso>
              No hay horarios libres para esa especialidad ese día. Probá con otra fecha o entrá a
              la cola de espera.
            </Aviso>
          )}

          {error && <Aviso>{error}</Aviso>}
          {exito && <Aviso tipo="exito">{exito}</Aviso>}

          <div className="flex justify-end">
            <button
              type="submit"
              className="btn-primary"
              disabled={solicitando || !especialidadId || !horario}
            >
              {solicitando ? 'Pidiendo...' : 'Pedir turno'}
            </button>
          </div>
        </form>
      </Card>

      <ColaDeEspera
        especialidadId={especialidadId}
        puedeEsperar={puedeEsperar}
        alEntrar={() => setPuedeEsperar(null)}
      />
    </>
  )
}

function ColaDeEspera({
  especialidadId,
  puedeEsperar,
  alEntrar,
}: {
  especialidadId: string
  puedeEsperar: number | null
  alEntrar: () => void
}) {
  const [entrar, entrando, error] = useAccion(async () => {
    await clinica.entrarEnCola({ especialidad: Number(especialidadId) })
    alEntrar()
  })

  if (!puedeEsperar) return null

  return (
    <Card titulo="Cola de espera">
      <p className="text-sm">
        Para esa especialidad no hay horarios libres. Si entrás a la cola, recepción te avisa un
        turno en cuanto se libere uno.
      </p>
      {error && (
        <div className="mt-2">
          <Aviso>{error}</Aviso>
        </div>
      )}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          className="btn-primary"
          onClick={entrar}
          disabled={entrando || !especialidadId}
        >
          {entrando ? 'Entrando...' : 'Entrar a la cola'}
        </button>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Ficha
// ---------------------------------------------------------------------------

function SeccionFicha() {
  const { datos, cargando, recargar } = useCarga<FichaMedica>(() => clinica.miFicha(), [])
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState<FichaMedica | null>(null)

  if (cargando) return <Cargando filas={4} />
  if (!datos) return <Aviso>No encontramos tu ficha médica. Contactá a recepción.</Aviso>

  async function guardar() {
    if (!borrador) return
    await clinica.editarFicha({
      alergias: borrador.alergias,
      enfermedades_cronicas: borrador.enfermedades_cronicas,
      medicacion: borrador.medicacion,
      observaciones: borrador.observaciones,
    })
    setEditando(false)
    await recargar()
  }

  const campos: { clave: keyof FichaMedica; etiqueta: string; obligatorio?: boolean }[] = [
    { clave: 'alergias', etiqueta: 'Alergias', obligatorio: true },
    { clave: 'enfermedades_cronicas', etiqueta: 'Enfermedades crónicas', obligatorio: true },
    { clave: 'medicacion', etiqueta: 'Medicación actual' },
    { clave: 'observaciones', etiqueta: 'Observaciones' },
  ]

  return (
    <>
      <Card
        titulo="Tu ficha médica"
        descripcion="La lee el profesional antes de atenderte. Si no tenés nada, escribí Ninguna."
        acciones={
          editando ? undefined : (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setBorrador({ ...datos })
                setEditando(true)
              }}
            >
              Editar
            </button>
          )
        }
      >
        {!datos.verificada && (
          <div className="mb-3">
            <Aviso>Tu ficha todavía no fue verificada por un profesional.</Aviso>
          </div>
        )}

        {datos.verificada && (
          <p className="mb-3 text-xs" style={{ color: 'var(--color-success)' }}>
            Verificada por {datos.verificada_por}
            {datos.verificada_en ? ` · ${formatearRelativo(datos.verificada_en)}` : ''}.
          </p>
        )}

        {editando && borrador ? (
          <div className="flex flex-col gap-3">
            {campos.map((campo) => (
              <div key={campo.clave}>
                <label className="field-label" htmlFor={`ficha-${campo.clave}`}>
                  {campo.etiqueta}
                  {campo.obligatorio && (
                    <span className="ml-1 text-xs" style={{ color: 'var(--color-danger)' }}>
                      obligatorio
                    </span>
                  )}
                </label>
                <textarea
                  id={`ficha-${campo.clave}`}
                  className="field-input min-h-16"
                  value={String(borrador[campo.clave] ?? '')}
                  onChange={(e) => setBorrador({ ...borrador, [campo.clave]: e.target.value })}
                />
              </div>
            ))}
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Al guardar, la ficha vuelve a quedar sin verificar hasta que un profesional la revise.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setEditando(false)
                  setBorrador(null)
                }}
              >
                Cancelar
              </button>
              <button type="button" className="btn-primary" onClick={guardar}>
                Guardar
              </button>
            </div>
          </div>
        ) : (
          <dl className="flex flex-col gap-3">
            {campos.map((campo) => (
              <div key={campo.clave}>
                <dt className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  {campo.etiqueta}
                </dt>
                <dd className="mt-0.5 text-sm whitespace-pre-wrap">
                  {String(datos[campo.clave]) || <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Card>
    </>
  )
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

function SeccionConsultasPaciente() {
  const [mensaje, setMensaje] = useState('')

  const { datos, cargando, recargar } = useCarga<Consulta[]>(() => clinica.consultas(), [])

  const [enviar, enviando, error] = useAccion(async () => {
    await clinica.crearConsulta(mensaje)
    setMensaje('')
    await recargar()
  })

  return (
    <>
      <Card titulo="Escribir una consulta">
        <textarea
          className="field-input min-h-24"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder="Escribí tu consulta para recepción..."
          aria-label="Consulta"
        />
        {error && (
          <div className="mt-2">
            <Aviso>{error}</Aviso>
          </div>
        )}
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            className="btn-primary"
            onClick={() => enviar()}
            disabled={enviando || !mensaje.trim()}
          >
            {enviando ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </Card>

      <Card titulo="Mis consultas">
        <ListaConsultas
          consultas={datos ?? []}
          cargando={cargando}
          puedeResponder={false}
          onResponder={() => undefined}
        />
      </Card>
    </>
  )
}

/** Hoy en `YYYY-MM-DD`. Mismo criterio que `aInputDate`, sin argumentos. */
function aInputHoy(): string {
  const hoy = new Date()
  const mes = String(hoy.getMonth() + 1).padStart(2, '0')
  const dia = String(hoy.getDate()).padStart(2, '0')
  return `${hoy.getFullYear()}-${mes}-${dia}`
}