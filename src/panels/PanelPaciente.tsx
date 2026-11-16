/**
 * Panel del paciente.
 *
 * Es el único rol que se registra solo, así que todo lo que ve es suyo: sus
 * turnos, su ficha, sus consultas y su lugar en la cola. Lo único que elige es la
 * especialidad, no el profesional: el sistema le asigna el primero con horario
 * libre, que es lo que se acordó en el sprint.
 */

import { useState } from 'react'

import { Aviso, Badge, Card, Cargando, Metrica, Tabla, Td, Th } from '../components/ui'
import { useToast } from '../context/useToast'
import { clinica } from '../lib/api'
import { mensajeDeError } from '../lib/errores'
import { formatearRelativo, formatearRango, sumarMinutos } from '../lib/fechas'
import { hayErrores, soloConError, validarTexto } from '../lib/validaciones'
import { useAccion, useCarga } from '../lib/useCarga'
import { useConfirmacion } from '../lib/usePanel'
import { ApiError } from '../lib/types'
import type {
  Consulta,
  EntradaCola,
  Especialidad,
  FichaMedica,
  HistorialClinico,
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
    case 'historial':
      return <SeccionHistorialClinico />
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
        setError(mensajeDeError(e, 'No se pudo pedir el turno.'))
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
                min={aInputHoy()}
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

          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Si es una urgencia, no pidas turno por acá: acercate a la clínica o avisale a recepción, que
            te atiende primero.
          </p>

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
              className="btn-primary btn-auto"
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
          className="btn-primary btn-auto"
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
  const [errores, setErrores] = useState<Record<string, string>>({})
  const toast = useToast()

  // Antes el guardado no tenía manejo de errores: si el servidor fallaba, el
  // botón "Guardar" parecía no hacer nada. Ahora el error se muestra.
  const [guardar, guardando, errorGuardar] = useAccion(async (ficha: FichaMedica) => {
    await clinica.editarFicha({
      alergias: ficha.alergias.trim(),
      enfermedades_cronicas: ficha.enfermedades_cronicas.trim(),
      medicacion: (ficha.medicacion ?? '').trim(),
      observaciones: (ficha.observaciones ?? '').trim(),
    })
    toast.mostrar('exito', 'Ficha guardada. Un profesional la va a revisar.')
    setEditando(false)
    setBorrador(null)
    await recargar()
  })

  if (cargando) return <Cargando filas={4} />
  if (!datos) return <Aviso>No encontramos tu ficha médica. Contactá a recepción.</Aviso>

  function intentarGuardar() {
    if (!borrador) return
    const encontrados = {
      alergias: validarTexto(borrador.alergias, {
        etiqueta: 'las alergias (si no tenés, escribí Ninguna)',
        max: 500,
      }),
      enfermedades_cronicas: validarTexto(borrador.enfermedades_cronicas, {
        etiqueta: 'las enfermedades crónicas (si no tenés, escribí Ninguna)',
        max: 500,
      }),
      medicacion: validarTexto(borrador.medicacion ?? '', { etiqueta: 'la medicación', max: 500, obligatorio: false }),
      observaciones: validarTexto(borrador.observaciones ?? '', {
        etiqueta: 'las observaciones',
        max: 500,
        obligatorio: false,
      }),
    }
    if (hayErrores(encontrados)) {
      setErrores(soloConError(encontrados))
      return
    }
    setErrores({})
    void guardar(borrador)
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
                setErrores({})
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
                  className={`field-input min-h-16 ${errores[campo.clave] ? 'field-input-error' : ''}`}
                  value={String(borrador[campo.clave] ?? '')}
                  maxLength={500}
                  onChange={(e) => {
                    setBorrador({ ...borrador, [campo.clave]: e.target.value })
                    setErrores((previos) => ({ ...previos, [campo.clave]: '' }))
                  }}
                />
                {errores[campo.clave] && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--color-danger)' }}>
                    {errores[campo.clave]}
                  </p>
                )}
              </div>
            ))}
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Al guardar, la ficha vuelve a quedar sin verificar hasta que un profesional la revise.
            </p>
            {errorGuardar && <Aviso>{errorGuardar}</Aviso>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setEditando(false)
                  setBorrador(null)
                  setErrores({})
                }}
              >
                Cancelar
              </button>
              <button type="button" className="btn-primary btn-auto" onClick={intentarGuardar} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar'}
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
  const [errorMensaje, setErrorMensaje] = useState<string | undefined>()
  const toast = useToast()

  const { datos, cargando, recargar } = useCarga<Consulta[]>(() => clinica.consultas(), [])

  const [enviar, enviando, error] = useAccion(async () => {
    await clinica.crearConsulta(mensaje.trim())
    toast.mostrar('exito', 'Consulta enviada. Recepción te va a responder.')
    setMensaje('')
    await recargar()
  })

  function intentarEnviar() {
    const problema = validarTexto(mensaje, { etiqueta: 'la consulta', min: 5, max: 1000 })
    setErrorMensaje(problema)
    if (!problema) void enviar()
  }

  return (
    <>
      <Card titulo="Escribir una consulta">
        <textarea
          className={`field-input min-h-24 ${errorMensaje ? 'field-input-error' : ''}`}
          value={mensaje}
          maxLength={1000}
          onChange={(e) => {
            setMensaje(e.target.value)
            setErrorMensaje(undefined)
          }}
          placeholder="Escribí tu consulta para recepción..."
          aria-label="Consulta"
        />
        {errorMensaje && (
          <p className="mt-1 text-xs" style={{ color: 'var(--color-danger)' }}>
            {errorMensaje}
          </p>
        )}
        {error && (
          <div className="mt-2">
            <Aviso>{error}</Aviso>
          </div>
        )}
        <div className="mt-2 flex justify-end">
          <button type="button" className="btn-primary btn-auto" onClick={intentarEnviar} disabled={enviando}>
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

// ---------------------------------------------------------------------------
// Historial clinico
// ---------------------------------------------------------------------------

function SeccionHistorialClinico() {
  const { datos, cargando, error } = useCarga<HistorialClinico>(
    () => clinica.historialClinico(),
    [],
  )
  const toast = useToast()

  if (cargando) return <Cargando filas={4} />
  if (error) return <Aviso>{error}</Aviso>
  if (!datos) return <Aviso>No se pudo cargar el historial clínico.</Aviso>

  const turnosCerrados = datos.turnos.filter(
    (t) => t.estado !== 'pendiente' && t.estado !== 'confirmado',
  )
  const consultasRespondidas = datos.consultas.filter((c) => c.estado === 'respondida')

  return (
    <>
      <Card
        titulo="Historial clínico"
        descripcion={`Turnos, ficha médica y consultas de ${datos.paciente.nombre}.`}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metrica
            valor={datos.turnos.length}
            etiqueta="Turnos registrados"
            tono="acento"
          />
          <Metrica
            valor={turnosCerrados.length}
            etiqueta="Turnos atendidos o cerrados"
          />
          <Metrica valor={datos.consultas.length} etiqueta="Consultas enviadas" />
          <Metrica
            valor={datos.ficha_medica ? 'Sí' : 'No'}
            etiqueta="Ficha médica cargada"
            tono={datos.ficha_medica ? 'acento' : 'neutro'}
          />
        </div>

        {/* Ficha médica */}
        <Card titulo="Tu ficha médica">
          {datos.ficha_medica ? (
            <dl className="flex flex-col gap-3">
              <div>
                <dt className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  Alergias
                </dt>
                <dd className="mt-0.5 text-sm whitespace-pre-wrap">
                  {datos.ficha_medica.alergias || <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  Enfermedades crónicas
                </dt>
                <dd className="mt-0.5 text-sm whitespace-pre-wrap">
                  {datos.ficha_medica.enfermedades_cronicas || (
                    <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  Medicación actual
                </dt>
                <dd className="mt-0.5 text-sm whitespace-pre-wrap">
                  {datos.ficha_medica.medicacion || (
                    <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  Observaciones
                </dt>
                <dd className="mt-0.5 text-sm whitespace-pre-wrap">
                  {datos.ficha_medica.observaciones || (
                    <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                  )}
                </dd>
              </div>
              {datos.ficha_medica.verificada && (
                <div>
                  <dt className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    Verificada
                  </dt>
                  <dd className="mt-0.5 text-sm" style={{ color: 'var(--color-success)' }}>
                    Por {datos.ficha_medica.verificada_por}
                    {datos.ficha_medica.verificada_en ? ` · ${formatearRelativo(datos.ficha_medica.verificada_en)}` : ''}.
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <Vacio
              titulo="Sin ficha médica todavía"
              descripcion="Cuando un profesional la complete, aparecerá acá con tus alergias, enfermedades crónicas y medicación."
            />
          )}
        </Card>

        {/* Historial de turnos */}
        <Card
          titulo="Historial de turnos"
          acciones={
            turnosCerrados.length > 0 ? (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => toast.mostrar('exito', 'Historial actualizado.')}
              >
                Actualizar
              </button>
            ) : undefined
          }
        >
          {datos.turnos.length === 0 ? (
            <Vacio
              titulo="Sin turnos registrados"
              descripcion="Cuando pidas o te asignen un turno, aparecerá acá."
            />
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <Th>Fecha y hora</Th>
                  <Th>Profesional</Th>
                  <Th>Especialidad</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Motivo</Th>
                </tr>
              </thead>
              <tbody>
                {datos.turnos.map((turno) => (
                  <tr key={turno.id}>
                    <Td className="whitespace-nowrap">
                      <div className="font-medium">{formatearRango(turno.inicio, turno.fin)}</div>
                      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {formatearRelativo(turno.inicio)}
                      </div>
                    </Td>
                    <Td>{turno.medico || '—'}</Td>
                    <Td>{turno.especialidad_nombre}</Td>
                    <Td>
                      <Badge tono={tonoEstadoTurno(turno.estado)}>
                        {etiquetaEstadoTurno(turno.estado)}
                      </Badge>
                    </Td>
                    <Td className="max-w-[16rem] truncate text-right text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {turno.motivo || '—'}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
        </Card>

        {/* Consultas */}
        <Card
          titulo="Consultas a recepción"
          descripcion="Mensajes que enviaste y las respuestas del equipo."
        >
          {datos.consultas.length === 0 ? (
            <Vacio
              titulo="Sin consultas"
              descripcion="Cuando escribas una consulta, aparecerá acá con su respuesta."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {datos.consultas.map((consulta) => (
                <li
                  key={consulta.id}
                  className="rounded-lg border p-3"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">{consulta.estado}</div>
                    <div className="flex items-center gap-2">
                      <Badge tono={consulta.estado === 'abierta' ? 'neutro' : 'exito'}>
                        {consulta.estado === 'abierta' ? 'Abierta' : 'Respondida'}
                      </Badge>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {formatearRelativo(consulta.creada)}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1.5 text-sm whitespace-pre-wrap">{consulta.mensaje}</p>
                  {consulta.respuesta && (
                    <div
                      className="mt-2 rounded-md p-2.5 text-sm"
                      style={{ backgroundColor: 'var(--color-bg)' }}
                    >
                      <div className="mb-1 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                        Respuesta de {consulta.respondida_por_nombre || 'el equipo'}
                      </div>
                      <p className="whitespace-pre-wrap">{consulta.respuesta}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Card>
    </>
  )
}
