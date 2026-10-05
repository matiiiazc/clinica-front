/**
 * Piezas compartidas por los cuatro paneles.
 *
 * Admin, recepcion y medico muestran la misma tabla de turnos, la misma bandeja
 * de consultas y la misma cola, con permisos distintos. Si cada panel tuviera la
 * suya, un cambio de estados del turno habria que recordarlo en tres archivos y
 * tarde o temprano uno se queda atras.
 *
 * Lo que cambia por rol son las acciones, y eso se decide con props:
 * `puedeResponder`, `puedeAgendar`, etc.
 */

import { Badge, BotonChico, Cargando, Tabla, Td, Th, Vacio } from '../components/ui'
import { formatearRelativo, formatearRango, tonoEstadoTurno, etiquetaEstadoTurno } from '../lib/fechas'
import type { Consulta, EntradaCola, EstadoTurno, Turno } from '../lib/types'

/** Que el paciente puede hacer con su turno. */
export function AccionesDePaciente({
  turno,
  onCancelar,
  onConfirmar,
  cancelando,
}: {
  turno: Turno
  onCancelar: () => void
  onConfirmar: () => void
  cancelando?: boolean
}) {
  if (turno.estado !== 'pendiente' && turno.estado !== 'confirmado') return null

  return (
    <div className="flex justify-end gap-1">
      {turno.estado === 'pendiente' && (
        <BotonChico tono="exito" onClick={onConfirmar} disabled={cancelando}>
          Confirmar
        </BotonChico>
      )}
      {turno.puede_cancelar && (
        <BotonChico tono="peligro" onClick={onCancelar} disabled={cancelando}>
          Cancelar
        </BotonChico>
      )}
    </div>
  )
}

/** Lo que recepcion y admin pueden hacer con un turno. */
export function AccionesDePersonal({
  turno,
  onEstado,
  cambiando,
}: {
  turno: Turno
  onEstado: (estado: EstadoTurno) => void
  cambiando?: boolean
}) {
  // Los estados posibles los manda el backend (`posibles_estados`), que es quien
  // conoce la tabla de transiciones. Si el front los hardcodea, el dia que se
  // agregue una transicion el boton aparece y el backend responde 400.
  if (turno.posibles_estados.length === 0) {
    return <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Cerrado</span>
  }

  return (
    <div className="flex flex-wrap justify-end gap-1">
      {turno.posibles_estados.map((estado) => (
        <BotonChico
          key={estado}
          onClick={() => onEstado(estado)}
          disabled={cambiando}
          tono={estado === 'cancelado' ? 'peligro' : estado === 'atendido' ? 'exito' : 'neutro'}
        >
          {etiquetaEstadoTurno(estado)}
        </BotonChico>
      ))}
    </div>
  )
}

/**
 * Lo que el médico hace al cerrar la consulta.
 *
 * El tipo del parámetro es el subconjunto que el backend habilita para el
 * profesional, no `EstadoTurno`: el frontend no debe poder ofrecer "confirmar" o
 * "cancelar" en un panel donde el rol no lo permite.
 */
export function AccionesDeMedico({
  turno,
  onEstado,
  cambiando,
}: {
  turno: Turno
  onEstado: (estado: 'atendido' | 'no_asistio') => void
  cambiando?: boolean
}) {
  const opciones: ('atendido' | 'no_asistio')[] = ['atendido', 'no_asistio']
  const disponibles = opciones.filter((e) => turno.posibles_estados.includes(e))

  if (disponibles.length === 0) return null

  return (
    <div className="flex justify-end gap-1">
      {disponibles.map((estado) => (
        <BotonChico
          key={estado}
          onClick={() => onEstado(estado)}
          disabled={cambiando}
          tono={estado === 'atendido' ? 'exito' : 'peligro'}
        >
          {estado === 'atendido' ? 'Atendido' : 'No asistió'}
        </BotonChico>
      ))}
    </div>
  )
}

export function TablaTurnos({
  turnos,
  cargando,
  columnas,
  renderAcciones,
}: {
  turnos: Turno[]
  cargando: boolean
  columnas: 'medico' | 'solo_paciente'
  renderAcciones?: (turno: Turno) => React.ReactNode
}) {
  if (cargando) return <Cargando filas={4} />
  if (turnos.length === 0) {
    return <Vacio titulo="No hay turnos para mostrar" descripcion="Cambiá los filtros o esperá que se carguen." />
  }

  return (
    <Tabla>
      <thead>
        <tr>
          <Th>Hora</Th>
          <Th>{columnas === 'medico' ? 'Paciente' : 'Profesional'}</Th>
          {columnas === 'medico' && <Th>Motivo</Th>}
          <Th>Estado</Th>
          {renderAcciones && <Th className="text-right">Acciones</Th>}
        </tr>
      </thead>
      <tbody>
        {turnos.map((turno) => (
          <tr key={turno.id}>
            <Td className="whitespace-nowrap">
              <div className="font-medium">{formatearRango(turno.inicio, turno.fin)}</div>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {formatearRelativo(turno.inicio)}
              </div>
            </Td>
            <Td>
              <div>{columnas === 'medico' ? turno.paciente : turno.medico_nombre}</div>
              {columnas === 'medico' && (
                <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {turno.especialidad}
                </div>
              )}
            </Td>
            {columnas === 'medico' && (
              <Td className="max-w-[14rem] truncate text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {turno.motivo || '—'}
              </Td>
            )}
            <Td>
              <Badge tono={tonoEstadoTurno(turno.estado)}>{etiquetaEstadoTurno(turno.estado)}</Badge>
            </Td>
            {renderAcciones && (
              <Td>
                <div className="flex justify-end">{renderAcciones(turno)}</div>
              </Td>
            )}
          </tr>
        ))}
      </tbody>
    </Tabla>
  )
}

/** Bandeja de consultas. `puedeResponder` la abre recepcion y admin. */
export function ListaConsultas({
  consultas,
  cargando,
  puedeResponder,
  onResponder,
  respondiendoId,
}: {
  consultas: Consulta[]
  cargando: boolean
  puedeResponder: boolean
  onResponder: (consulta: Consulta) => void
  respondiendoId?: number | null
}) {
  if (cargando) return <Cargando filas={3} />
  if (consultas.length === 0) {
    return <Vacio titulo="No hay consultas" descripcion="Cuando un paciente escriba algo, aparece acá." />
  }

  return (
    <ul className="flex flex-col gap-2">
      {consultas.map((consulta) => (
        <li
          key={consulta.id}
          className="rounded-lg border p-3"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium">{consulta.paciente}</div>
            <div className="flex items-center gap-2">
              <Badge tono={consulta.esta_abierta ? 'neutro' : 'exito'}>
                {consulta.esta_abierta ? 'Abierta' : 'Respondida'}
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
                Respuesta de {consulta.respondida_por}
              </div>
              <p className="whitespace-pre-wrap">{consulta.respuesta}</p>
            </div>
          )}

          {puedeResponder && consulta.esta_abierta && (
            <div className="mt-2 flex justify-end">
              <BotonChico onClick={() => onResponder(consulta)} disabled={respondiendoId === consulta.id}>
                Responder
              </BotonChico>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Cola de espera, ordenada como la devuelve el backend (urgente antes). */
export function ListaCola({
  entradas,
  cargando,
  puedeGestionar,
  onPrioridad,
  onAgendar,
  onSalir,
}: {
  entradas: EntradaCola[]
  cargando: boolean
  puedeGestionar: boolean
  onPrioridad: (entrada: EntradaCola) => void
  onAgendar: (entrada: EntradaCola) => void
  onSalir?: (entrada: EntradaCola) => void
}) {
  if (cargando) return <Cargando filas={3} />
  if (entradas.length === 0) {
    return <Vacio titulo="La cola está vacía" descripcion="Nadie está esperando un turno por ahora." />
  }

  return (
    <ul className="flex flex-col gap-2">
      {entradas.map((entrada) => (
        <li key={entrada.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium">{entrada.paciente}</div>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {entrada.especialidad}
                {entrada.medico ? ` · ${entrada.medico}` : ' · sin profesional asignado'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tono={entrada.prioridad >= 10 ? 'peligro' : 'neutro'}>
                {entrada.prioridad >= 10 ? 'Urgente' : 'Normal'}
              </Badge>
              <Badge tono={entrada.estado === 'esperando' ? 'info' : 'exito'}>
                {entrada.estado === 'esperando' ? 'Esperando' : entrada.estado === 'agendado' ? 'Con turno' : 'Descartada'}
              </Badge>
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Espera desde {entrada.creado ? formatearRelativo(entrada.creado) : '—'}
              {entrada.nota ? ` · ${entrada.nota}` : ''}
            </span>

            <div className="flex flex-wrap justify-end gap-1">
              {entrada.estado === 'agendado' && entrada.turno && (
                <BotonChico tono="neutro" disabled title="Ya tiene turno asignado">
                  Turno #{entrada.turno}
                </BotonChico>
              )}
              {puedeGestionar && entrada.estado === 'esperando' && (
                <>
                  <BotonChico onClick={() => onPrioridad(entrada)}>
                    {entrada.prioridad >= 10 ? 'Bajar a normal' : 'Marcar urgente'}
                  </BotonChico>
                  <BotonChico tono="exito" onClick={() => onAgendar(entrada)}>
                    Agendar
                  </BotonChico>
                </>
              )}
              {onSalir && entrada.estado === 'esperando' && (
                <BotonChico tono="peligro" onClick={() => onSalir(entrada)}>
                  Salir de la cola
                </BotonChico>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}