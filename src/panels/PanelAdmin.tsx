/**
 * Panel de administración.
 *
 * Es el único rol que ve la clínica entera: cuentas, especialidades,
 * profesionales, agenda, consultas y cola. Recepción ve casi todo lo mismo pero
 * sin tocar la configuración, así que las secciones compartidas viven en
 * `comunes.tsx` y acá solo se agrega lo que es exclusivo de administración.
 */

import { useMemo, useState } from 'react'

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
  Tabla,
  Td,
  Th,
  Vacio,
} from '../components/ui'
import { DIAS_SEMANA, aInputDate, diaSemanaDe, formatearRelativo } from '../lib/fechas'
import { clinica } from '../lib/api'
import { useAccion, useCarga } from '../lib/useCarga'
import { useConfirmacion } from '../lib/usePanel'
import type {
  EstadoTurno,
  Especialidad,
  Medico,
  ResumenPanel,
  Turno,
  Usuario,
} from '../lib/types'
import { AccionesDePersonal, ListaCola, ListaConsultas, TablaTurnos } from './comunes'

export default function PanelAdmin({ seccion }: { seccion: string }) {
  switch (seccion) {
    case 'especialidades':
      return <SeccionEspecialidades />
    case 'profesionales':
      return <SeccionProfesionales />
    case 'agenda':
      return <SeccionAgenda />
    case 'consultas':
      return <SeccionConsultas />
    case 'cola':
      return <SeccionCola />
    default:
      return <SeccionResumen />
  }
}

// ---------------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------------

function SeccionResumen() {
  const { datos, cargando, error } = useCarga<ResumenPanel>(() => clinica.resumen(), [])
  const { datos: cuentas } = useCarga<Usuario[]>(() => clinica.usuarios(), [])

  if (cargando) return <Cargando filas={4} />
  if (error) return <Aviso>{error}</Aviso>
  if (!datos) return null

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Metrica valor={datos.usuarios ?? 0} etiqueta="Usuarios" />
        <Metrica valor={datos.especialidades ?? 0} etiqueta="Especialidades" tono="acento" />
        <Metrica valor={datos.medicos ?? 0} etiqueta="Profesionales" />
        <Metrica valor={datos.turnos_hoy ?? 0} etiqueta="Turnos hoy" tono="acento" />
        <Metrica
          valor={datos.consultas_abiertas ?? 0}
          etiqueta="Consultas abiertas"
          tono={datos.consultas_abiertas ? 'alerta' : 'neutro'}
        />
        <Metrica valor={datos.esperando ?? 0} etiqueta="En cola" />
      </div>

      <Card
        titulo="Cuentas de la clínica"
        descripcion="Lo que el comando create_staff creó, y cualquier alta pública. Solo administración ve esto."
      >
        {!cuentas ? (
          <Cargando filas={3} />
        ) : cuentas.length === 0 ? (
          <Vacio titulo="No hay cuentas cargadas" />
        ) : (
          <TablaUsuarios cuentas={cuentas} />
        )}
      </Card>
    </>
  )
}

function TablaUsuarios({ cuentas }: { cuentas: Usuario[] }) {
  return (
    <Tabla>
      <thead>
        <tr>
          <Th>Email</Th>
          <Th>Nombre</Th>
          <Th>Rol</Th>
          <Th>Estado</Th>
          <Th>Último acceso</Th>
        </tr>
      </thead>
      <tbody>
        {cuentas.map((cuenta) => (
          <tr key={cuenta.id}>
            <Td className="font-medium">{cuenta.email}</Td>
            <Td className="text-xs">{cuenta.nombre || '—'}</Td>
            <Td>
              <Badge tono={cuenta.rol === 'admin' ? 'acento' : 'neutro'}>{cuenta.rol_display}</Badge>
            </Td>
            <Td>
              {cuenta.email_verified ? (
                <Badge tono="exito">Verificado</Badge>
              ) : (
                <Badge tono="peligro">Sin verificar</Badge>
              )}
              {cuenta.must_change_password && (
                <span className="ml-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  debe cambiar la clave
                </span>
              )}
            </Td>
            <Td className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {cuenta.last_login ? formatearRelativo(cuenta.last_login) : 'nunca'}
            </Td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  )
}

// ---------------------------------------------------------------------------
// Especialidades
// ---------------------------------------------------------------------------

function SeccionEspecialidades() {
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [duracion, setDuracion] = useState('30')
  const [errorForm, setErrorForm] = useState<string | null>(null)

  const { datos, cargando, recargar } = useCarga<Especialidad[]>(() => clinica.especialidades(true), [])

  const [crear, creando, errorCrear] = useAccion(async () => {
    await clinica.crearEspecialidad({
      nombre,
      descripcion,
      duracion_turno_minutos: Number(duracion) || 30,
    })
    setNombre('')
    setDescripcion('')
    await recargar()
  })

  const [toggle, toggleando] = useAccion(async (especialidad: Especialidad) => {
    await clinica.actualizarEspecialidad(especialidad.id, { activa: !especialidad.activa })
    await recargar()
  })

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErrorForm(null)
    if (!nombre.trim()) {
      setErrorForm('Escribí el nombre de la especialidad.')
      return
    }
    await crear()
  }

  return (
    <>
      <Card titulo="Nueva especialidad" descripcion="Cada especialidad define cuánto dura un turno.">
        <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem_auto] sm:items-end">
          <Campo id="esp-nombre" label="Nombre" error={errorForm ?? undefined}>
            <input
              id="esp-nombre"
              className="field-input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Cardiología"
              maxLength={80}
            />
          </Campo>
          <Campo id="esp-desc" label="Descripción">
            <input
              id="esp-desc"
              className="field-input"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Opcional"
              maxLength={200}
            />
          </Campo>
          <Campo id="esp-dur" label="Duración (min)">
            <input
              id="esp-dur"
              className="field-input"
              type="number"
              min={10}
              max={240}
              step={5}
              value={duracion}
              onChange={(e) => setDuracion(e.target.value)}
            />
          </Campo>
          <button type="submit" className="btn-primary" disabled={creando}>
            {creando ? 'Guardando...' : 'Crear'}
          </button>
        </form>
        {errorCrear && (
          <div className="mt-2">
            <Aviso>{errorCrear}</Aviso>
          </div>
        )}
      </Card>

      <Card titulo="Especialidades">
        {cargando ? (
          <Cargando filas={3} />
        ) : (datos?.length ?? 0) === 0 ? (
          <Vacio titulo="No hay especialidades" descripcion="Crea la primera para poder agendar turnos." />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Nombre</Th>
                <Th>Duración</Th>
                <Th>Profesionales libres</Th>
                <Th>Estado</Th>
                <Th className="text-right">Acción</Th>
              </tr>
            </thead>
            <tbody>
              {datos?.map((esp) => (
                <tr key={esp.id}>
                  <Td>
                    <div className="font-medium">{esp.nombre}</div>
                    {esp.descripcion && (
                      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {esp.descripcion}
                      </div>
                    )}
                  </Td>
                  <Td className="tabular-nums">{esp.duracion_turno_minutos} min</Td>
                  <Td className="tabular-nums">
                    {esp.medicos_disponibles}
                    {esp.medicos_disponibles === 0 && (
                      <span className="ml-1 text-xs" style={{ color: 'var(--color-danger)' }}>
                        sin turnos
                      </span>
                    )}
                  </Td>
                  <Td>
                    {esp.activa ? <Badge tono="exito">Activa</Badge> : <Badge tono="neutro">Inactiva</Badge>}
                  </Td>
                  <Td>
                    <div className="flex justify-end">
                      <BotonChico onClick={() => toggle(esp)} disabled={toggleando}>
                        {esp.activa ? 'Desactivar' : 'Activar'}
                      </BotonChico>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </Card>
    </>
  )
}

// ---------------------------------------------------------------------------
// Profesionales
// ---------------------------------------------------------------------------

function SeccionProfesionales() {
  const { datos, cargando, recargar } = useCarga(
    () => clinica.medicos({ conProximo: true }),
    [],
  )
  const { datos: especialidades } = useCarga<Especialidad[]>(() => clinica.especialidades(true), [])
  const [filtroEsp, setFiltroEsp] = useState('')
  const [seleccionado, setSeleccionado] = useState<number | null>(null)

  const medicos = useMemo(() => {
    const todos = datos?.results ?? []
    return filtroEsp ? todos.filter((m) => m.especialidad_id === Number(filtroEsp)) : todos
  }, [datos, filtroEsp])

  const medicoVigente = medicos.find((m) => m.id === seleccionado) ?? null

  if (cargando) return <Cargando filas={4} />

  return (
    <>
      <Card titulo="Alta de profesional">
        <FormAltaMedico
          especialidades={especialidades ?? []}
          alGuardar={async () => {
            await recargar()
          }}
        />
      </Card>

      <BarraFiltros>
        <div>
          <label className="field-label" htmlFor="filtro-esp">
            Especialidad
          </label>
          <Select id="filtro-esp" value={filtroEsp} onChange={setFiltroEsp}>
            <option value="">Todas</option>
            {(especialidades ?? [])
              .filter((e) => e.activa)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
          </Select>
        </div>
      </BarraFiltros>

      <Card titulo={`Profesionales (${medicos.length})`}>
        {medicos.length === 0 ? (
          <Vacio titulo="No hay profesionales" descripcion="Cargá uno arriba para empezar a agendar." />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Nombre</Th>
                <Th>Matrícula</Th>
                <Th>Especialidad</Th>
                <Th>Estado</Th>
                <Th>Agenda semanal</Th>
                <Th>Próximo hueco</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {medicos.map((medico) => (
                <tr key={medico.id} style={seleccionado === medico.id ? { opacity: 0.6 } : undefined}>
                  <Td>
                    <div className="font-medium">{medico.nombre_completo}</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {medico.email}
                    </div>
                  </Td>
                  <Td className="text-xs tabular-nums">{medico.matricula}</Td>
                  <Td className="text-xs">{medico.especialidad}</Td>
                  <Td>
                    <Badge tono={medico.estado === 'libre' ? 'exito' : medico.estado === 'inactivo' ? 'peligro' : 'neutro'}>
                      {medico.estado}
                    </Badge>
                  </Td>
                  <Td className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {medico.agendas.length === 0 ? (
                      <span style={{ color: 'var(--color-danger)' }}>sin horario</span>
                    ) : (
                      medico.agendas.map((a) => `${a.dia_nombre.slice(0, 3)} ${a.hora_inicio}`).join(' · ')
                    )}
                  </Td>
                  <Td className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {medico.proximo_horario ? formatearRelativo(medico.proximo_horario) : '—'}
                  </Td>
                  <Td>
                    <div className="flex justify-end">
                      <BotonChico
                        onClick={() => setSeleccionado(seleccionado === medico.id ? null : medico.id)}
                      >
                        {seleccionado === medico.id ? 'Cerrar' : 'Agenda'}
                      </BotonChico>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </Card>

      {medicoVigente && (
        <Card
          titulo={`Agenda y bloqueos de ${medicoVigente.nombre_completo}`}
          descripcion={`${medicoVigente.especialidad} · ${medicoVigente.matricula}`}
        >
          <EditorAgenda medico={medicoVigente} alCambiar={recargar} />
        </Card>
      )}
    </>
  )
}

function FormAltaMedico({
  especialidades,
  alGuardar,
}: {
  especialidades: Especialidad[]
  alGuardar: () => Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [matricula, setMatricula] = useState('')
  const [especialidad, setEspecialidad] = useState('')
  const [exito, setExito] = useState<string | null>(null)

  const [crear, creando, error] = useAccion(async () => {
    await clinica.crearMedico({
      email,
      matricula,
      especialidad: Number(especialidad),
    })
    setExito(`${email} ahora es profesional.`)
    setEmail('')
    setMatricula('')
    setEspecialidad('')
    await alGuardar()
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setExito(null)
        void crear()
      }}
      className="grid gap-3 sm:grid-cols-[1fr_10rem_1fr_auto] sm:items-end"
    >
      <Campo
        id="med-email"
        label="Email de una cuenta existente"
        hint="El paciente primero se registra solo; después se lo promueve."
        error={error ?? undefined}
      >
        <input
          id="med-email"
          type="email"
          className="field-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="medico@correo.com"
        />
      </Campo>
      <Campo id="med-mat" label="Matrícula">
        <input
          id="med-mat"
          className="field-input"
          value={matricula}
          onChange={(e) => setMatricula(e.target.value)}
          maxLength={64}
        />
      </Campo>
      <Campo id="med-esp" label="Especialidad">
        <select
          id="med-esp"
          className="field-input"
          value={especialidad}
          onChange={(e) => setEspecialidad(e.target.value)}
        >
          <option value="">Elegir...</option>
          {especialidades
            .filter((e) => e.activa)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
        </select>
      </Campo>
      <button
        type="submit"
        className="btn-primary"
        disabled={creando || !email.trim() || !matricula.trim() || !especialidad}
      >
        {creando ? 'Creando...' : 'Dar de alta'}
      </button>
      {exito && (
        <div className="sm:col-span-4">
          <Aviso tipo="exito">{exito}</Aviso>
        </div>
      )}
    </form>
  )
}

function EditorAgenda({ medico, alCambiar }: { medico: Medico; alCambiar: () => Promise<void> }) {
  const [dia, setDia] = useState(String(diaSemanaDe()))
  const [desde, setDesde] = useState('09:00')
  const [hasta, setHasta] = useState('13:00')

  const { datos: tramos, cargando } = useCarga(() => clinica.agenda(medico.id), [medico.id])
  const { datos: bloqueos } = useCarga(() => clinica.bloqueos(medico.id), [medico.id])

  const [agregar, agregando] = useAccion(async () => {
    // El backend espera HH:MM:SS. Mandar "09:00" lo rechaza, y el mensaje de
    // error no dice nada del formato, asi que se arma acá.
    await clinica.crearAgenda(medico.id, {
      dia_semana: Number(dia),
      hora_inicio: `${desde}:00`,
      hora_fin: `${hasta}:00`,
    })
    await alCambiar()
  })

  const [quitar, quitando] = useAccion(async (agendaId: number) => {
    await clinica.borrarAgenda(medico.id, agendaId)
    await alCambiar()
  })

  const activos = (tramos ?? []).filter((t) => t.activo)
  const inactivos = (tramos ?? []).filter((t) => !t.activo)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="field-label" htmlFor="ag-dia">
            Día
          </label>
          <Select id="ag-dia" value={dia} onChange={setDia}>
            {DIAS_SEMANA.map((nombre, indice) => (
              <option key={nombre} value={indice}>
                {nombre}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="field-label" htmlFor="ag-desde">
            Desde
          </label>
          <input
            id="ag-desde"
            type="time"
            className="field-input w-28"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="ag-hasta">
            Hasta
          </label>
          <input
            id="ag-hasta"
            type="time"
            className="field-input w-28"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => agregar()}
          disabled={agregando || desde >= hasta}
          title={desde >= hasta ? 'La hora de fin tiene que ser posterior.' : undefined}
        >
          {agregando ? 'Guardando...' : 'Agregar tramo'}
        </button>
        {agregando === false && desde >= hasta && (
          <span className="text-xs" style={{ color: 'var(--color-danger)' }}>
            La hora de fin tiene que ser posterior a la de inicio.
          </span>
        )}
      </div>

      <div>
        <h3 className="mb-1.5 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
          Tramos activos
        </h3>
        {cargando ? (
          <Cargando filas={2} />
        ) : activos.length === 0 ? (
          <Vacio titulo="Sin horario" descripcion="Sin tramos no se pueden agendar turnos." />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {activos.map((tramo) => (
              <li
                key={tramo.id}
                className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <span>
                  <span className="font-medium">{tramo.dia_nombre}</span>{' '}
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    {tramo.hora_inicio.slice(0, 5)} - {tramo.hora_fin.slice(0, 5)}
                  </span>
                </span>
                <BotonChico tono="peligro" onClick={() => quitar(tramo.id)} disabled={quitando}>
                  Quitar
                </BotonChico>
              </li>
            ))}
          </ul>
        )}
        {inactivos.length > 0 && (
          <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {inactivos.length} tramo(s) dado(s) de baja en el historial.
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-1.5 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
          Bloqueos (vacaciones, feriados)
        </h3>
        {(bloqueos ?? []).length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Sin bloqueos.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {bloqueos?.map((bloqueo) => (
              <li key={bloqueo.id} className="text-xs">
                {bloqueo.motivo || 'Sin motivo'} · {bloqueo.desde.slice(0, 10)} → {bloqueo.hasta.slice(0, 10)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

export function SeccionAgenda() {
  const [fecha, setFecha] = useState(aInputDate())
  const [estado, setEstado] = useState('')

  const { datos, cargando, recargar } = useCarga(
    () => clinica.turnos({ desde: fecha, hasta: fecha, estado: estado || undefined }),
    [fecha, estado],
  )

  const [cambiar, cambiando] = useAccion(async (turno: Turno, nuevo: EstadoTurno) => {
    await clinica.cambiarEstadoTurno(turno.id, nuevo)
    await recargar()
  })

  return (
    <>
      <BarraFiltros>
        <div>
          <label className="field-label" htmlFor="ag-fecha">
            Fecha
          </label>
          <input
            id="ag-fecha"
            type="date"
            className="field-input h-9 w-auto py-1"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="ag-estado">
            Estado
          </label>
          <Select id="ag-estado" value={estado} onChange={setEstado}>
            <option value="">Todos</option>
            <option value="pendiente">Pendientes</option>
            <option value="confirmado">Confirmados</option>
            <option value="atendido">Atendidos</option>
            <option value="cancelado">Cancelados</option>
            <option value="no_asistio">No asistieron</option>
          </Select>
        </div>
        {/*
          Con `true` muestra el spinner: es un clic explícito del usuario, y
          tapar la tabla sin avisar se lee como que se rompió. Los `recargar()`
          que van después de crear o cambiar algo usan el modo sin spinner,
          porque ahí la tabla no tiene por qué desaparecer.
        */}
        <BotonChico onClick={() => recargar(true)}>Actualizar</BotonChico>
      </BarraFiltros>

      <Card titulo={`Turnos del ${fecha}`}>
        <TablaTurnos
          turnos={datos?.results ?? []}
          cargando={cargando}
          columnas="medico"
          renderAcciones={(turno) => (
            <AccionesDePersonal
              turno={turno}
              cambiando={cambiando}
              onEstado={(nuevo) => cambiar(turno, nuevo)}
            />
          )}
        />
      </Card>
    </>
  )
}

// ---------------------------------------------------------------------------
// Consultas y cola
// ---------------------------------------------------------------------------

export function SeccionConsultas() {
  const [filtro, setFiltro] = useState<'abierta' | 'respondida' | ''>('abierta')
  const [respondiendo, setRespondiendo] = useState<number | null>(null)
  const [texto, setTexto] = useState('')

  const { datos, cargando, recargar } = useCarga(
    () => clinica.consultas(filtro || undefined),
    [filtro],
  )

  const [responder, respondiendo_, errorResponder] = useAccion(async (id: number) => {
    await clinica.responderConsulta(id, texto)
    setRespondiendo(null)
    setTexto('')
    await recargar()
  })

  return (
    <>
      <BarraFiltros>
        <div>
          <label className="field-label" htmlFor="cq-estado">
            Estado
          </label>
          <Select id="cq-estado" value={filtro} onChange={(v) => setFiltro(v as typeof filtro)}>
            <option value="abierta">Abiertas</option>
            <option value="respondida">Respondidas</option>
            <option value="">Todas</option>
          </Select>
        </div>
      </BarraFiltros>

      {errorResponder && <Aviso>{errorResponder}</Aviso>}

      <Card>
        <ListaConsultas
          consultas={datos ?? []}
          cargando={cargando}
          puedeResponder
          respondiendoId={respondiendo_ ? respondiendo : null}
          onResponder={(consulta) => {
            setRespondiendo(consulta.id)
            setTexto('')
          }}
        />

        {respondiendo !== null && (
          <div
            className="mt-3 rounded-lg border p-3"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <Campo id="cq-resp" label="Respuesta">
              <textarea
                id="cq-resp"
                className="field-input min-h-24"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Escribí la respuesta..."
              />
            </Campo>
            <div className="mt-2 flex justify-end gap-2">
              <BotonChico onClick={() => setRespondiendo(null)}>Cancelar</BotonChico>
              <BotonChico
                tono="exito"
                onClick={() => responder(respondiendo)}
                disabled={respondiendo_ || !texto.trim()}
              >
                Enviar respuesta
              </BotonChico>
            </div>
            <p className="mt-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Una consulta se responde una sola vez: después queda cerrada.
            </p>
          </div>
        )}
      </Card>
    </>
  )
}

export function SeccionCola() {
  const [filtro, setFiltro] = useState<'esperando' | 'agendado' | ''>('esperando')
  const [agendando, setAgendando] = useState<number | null>(null)
  const [inicio, setInicio] = useState('')

  const { datos, cargando, recargar } = useCarga(
    () => clinica.cola(filtro || undefined),
    [filtro],
  )

  const { dialogo, pedirConfirmacion } = useConfirmacion()

  const [prioridad, errorPrioridad] = useAccion(async (id: number, nueva: number) => {
    await clinica.cambiarPrioridad(id, nueva)
    await recargar()
  })

  const [agendarDeCola, agendando_, errorAgendar] = useAccion(async (id: number) => {
    await clinica.agendarDesdeCola(id, new Date(inicio).toISOString())
    setAgendando(null)
    setInicio('')
    await recargar()
  })

  const [salir, saliendo, errorSalir] = useAccion(async (id: number) => {
    await clinica.salirDeCola(id)
    await recargar()
  })

  return (
    <>
      <BarraFiltros>
        <div>
          <label className="field-label" htmlFor="cola-estado">
            Estado
          </label>
          <Select id="cola-estado" value={filtro} onChange={(v) => setFiltro(v as typeof filtro)}>
            <option value="esperando">Esperando</option>
            <option value="agendado">Con turno</option>
            <option value="">Todas</option>
          </Select>
        </div>
      </BarraFiltros>

      {errorPrioridad && <Aviso>{errorPrioridad}</Aviso>}
      {errorAgendar && <Aviso>{errorAgendar}</Aviso>}
      {errorSalir && <Aviso>{errorSalir}</Aviso>}

      <Card>
        <ListaCola
          entradas={datos ?? []}
          cargando={cargando}
          puedeGestionar
          onPrioridad={(entrada) => prioridad(entrada.id, entrada.prioridad >= 10 ? 0 : 10)}
          onAgendar={(entrada) => {
            setAgendando(entrada.id)
            setInicio('')
          }}
          onSalir={(entrada) =>
            pedirConfirmacion(
              `¿Sacar a ${entrada.paciente} de la cola de ${entrada.especialidad}? Queda registrado que estuvo esperando.`,
              () => salir(entrada.id),
            )
          }
        />

        {agendando !== null && (
          <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'var(--color-border)' }}>
            <p className="mb-2 text-sm">Elegí el horario del turno que se le va a dar.</p>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="field-label" htmlFor="cola-inicio">
                  Fecha y hora
                </label>
                <input
                  id="cola-inicio"
                  type="datetime-local"
                  className="field-input w-56"
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                />
              </div>
              <BotonChico onClick={() => setAgendando(null)}>Cancelar</BotonChico>
              <BotonChico
                tono="exito"
                onClick={() => agendando !== null && agendarDeCola(agendando)}
                disabled={agendando_ || !inicio}
              >
                Confirmar turno
              </BotonChico>
            </div>
            <p className="mt-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              El sistema elige el primer profesional de la especialidad con ese horario libre. Si
              ninguno tiene lugar, avisa y la entrada sigue esperando.
            </p>
          </div>
        )}
      </Card>

      {dialogo}
      {saliendo && (
        <span className="sr-only" role="status">
          Actualizando la cola
        </span>
      )}
    </>
  )
}