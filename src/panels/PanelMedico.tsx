/**
 * Panel del profesional.
 *
 * El médico tiene dos cosas que hacer: ver la agenda y decir si atiende. No
 * agenda, no toca la cola, no ve los turnos de otros. Solo suyos.
 */

import { useState } from 'react'

import { Aviso, Badge, BarraFiltros, Card, Cargando, Metrica, Select, Vacio } from '../components/ui'
import { clinica } from '../lib/api'
import { etiquetaEstadoMedico } from '../lib/fechas'
import { useAccion, useCarga } from '../lib/useCarga'
import { useConfirmacion } from '../lib/usePanel'
import type { EstadoMedico, Medico, PeriodoAgenda, ResumenPanel, Turno } from '../lib/types'
import { AccionesDeMedico, TablaTurnos } from './comunes'

export default function PanelMedico({ seccion }: { seccion: string }) {
  const { datos: perfil, cargando, error } = useCarga<Medico>(() => clinica.miPerfilMedico(), [])

  if (cargando) return <Cargando filas={4} />

  if (error) {
    return (
      <Aviso>
        Tu usuario no tiene un perfil de médico asociado. Pedile a administración que te dé de alta
        desde el panel de profesionales.
      </Aviso>
    )
  }

  if (!perfil) return null

  return seccion === 'estado' ? <SeccionEstado perfil={perfil} /> : <SeccionAgendaMedico perfil={perfil} />
}

function SeccionAgendaMedico({ perfil }: { perfil: Medico }) {
  const [periodo, setPeriodo] = useState<PeriodoAgenda>('dia')

  const { datos, cargando, recargar } = useCarga<Turno[]>(
    () => clinica.misTurnos({ periodo }),
    [periodo],
  )
  const { datos: resumen } = useCarga<ResumenPanel>(() => clinica.resumen(), [])

  const { dialogo, pedirConfirmacion } = useConfirmacion()

  const [cerrar, cerrando, errorCerrar] = useAccion(
    async (turno: Turno, estado: 'atendido' | 'no_asistio') => {
      await clinica.cambiarEstadoTurno(turno.id, estado)
      await recargar()
    },
  )

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metrica valor={resumen?.turnos_hoy ?? 0} etiqueta="Turnos hoy" tono="acento" />
        <Metrica valor={resumen?.pendientes_hoy ?? 0} etiqueta="Pendientes hoy" />
        <Metrica valor={perfil.especialidad} etiqueta="Especialidad" />
        <Metrica
          valor={etiquetaEstadoMedico(perfil.estado)}
          etiqueta="Tu estado"
          tono={perfil.estado === 'libre' ? 'acento' : 'neutro'}
        />
      </div>

      <BarraFiltros>
        <div>
          <label className="field-label" htmlFor="per-periodo">
            Ver
          </label>
          <Select id="per-periodo" value={periodo} onChange={(v) => setPeriodo(v as PeriodoAgenda)}>
            <option value="dia">Hoy</option>
            <option value="semana">Esta semana</option>
            <option value="mes">Este mes</option>
          </Select>
        </div>
      </BarraFiltros>

      {errorCerrar && <Aviso>{errorCerrar}</Aviso>}

      <Card titulo={`Agenda de ${perfil.nombre_completo}`}>
        <TablaTurnos
          turnos={datos ?? []}
          cargando={cargando}
          columnas="solo_paciente"
          renderAcciones={(turno) => (
            <AccionesDeMedico
              turno={turno}
              cambiando={cerrando}
              onEstado={(estado) => {
                const texto =
                  estado === 'atendido'
                    ? `¿Marcar el turno de ${turno.paciente} como atendido?`
                    : `¿Marcar el turno de ${turno.paciente} como no asistido?`
                pedirConfirmacion(texto, () => cerrar(turno, estado))
              }}
            />
          )}
        />
      </Card>

      {perfil.agendas.length === 0 && (
        <Aviso>
          Todavía no tenés horarios cargados. Sin agenda no te pueden agendar turnos: pedile a
          recepción que te asigne un tramo semanal.
        </Aviso>
      )}

      {dialogo}
    </>
  )
}

function SeccionEstado({ perfil }: { perfil: Medico }) {
  const [explicacion, setExplicacion] = useState(
    'Estás libre: la recepción puede agendarte turnos.',
  )

  const [cambiar, cambiando, error] = useAccion(async (estado: EstadoMedico) => {
    await clinica.cambiarEstadoMedico(estado)
  })

  const OPCIONES: { valor: EstadoMedico; titulo: string; texto: string }[] = [
    {
      valor: 'libre',
      titulo: 'Libre',
      texto: 'Estás tomando pacientes. Es el estado normal para atiende.',
    },
    {
      valor: 'atendiendo',
      titulo: 'Atendiendo',
      texto: 'Estás con un paciente ahora. La recepción ve que estabés ocupado.',
    },
    {
      valor: 'inactivo',
      titulo: 'Inactivo',
      texto: 'No estás atendiendo: vacaciones, capacitaciones. Los turnos que ya tenés no se borran; los cancela recepción.',
    },
  ]

  return (
    <>
      {error && <Aviso>{error}</Aviso>}

      <Card
        titulo="Tu estado"
        descripcion="No cambia los turnos que ya tenés: solo avisa a la recepción si pueden agendarte."
      >
        <div className="flex flex-col gap-2">
          {OPCIONES.map((opcion) => {
            const actual = perfil.estado === opcion.valor
            return (
              <button
                key={opcion.valor}
                type="button"
                disabled={cambiando || actual}
                onClick={() => {
                  setExplicacion(opcion.texto)
                  cambiar(opcion.valor)
                }}
                className="flex items-start justify-between gap-3 rounded-lg border p-3 text-left disabled:opacity-60"
                style={{
                  borderColor: actual ? 'var(--color-accent)' : 'var(--color-border)',
                }}
              >
                <span>
                  <span className="text-sm font-medium">{opcion.titulo}</span>
                  <span className="mt-0.5 block text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {opcion.texto}
                  </span>
                </span>
                {actual && <Badge tono="acento">Actual</Badge>}
              </button>
            )
          })}
        </div>

        <p className="mt-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {explicacion}
        </p>
      </Card>

      <Card titulo="Tu horario semanal">
        {perfil.agendas.length === 0 ? (
          <Vacio titulo="Sin horario cargado" descripcion="Pedile a recepción que configure tus tramos." />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {perfil.agendas.map((tramo) => (
              <li
                key={tramo.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <span className="font-medium">{tramo.dia_nombre}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>
                  {tramo.hora_inicio} - {tramo.hora_fin}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Cambiar el horario lo hace recepción o administración, no vos.
        </p>
      </Card>

      <Card titulo="Cómo se calcula tu agenda">
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Los horarios que la recepción puede agendarte salen de tus tramos semanales menos los
          turnos ya tomados y los bloqueos. La duración de cada turno la define tu especialidad, no
          vos. Por eso nunca se superponen dos turnos en el mismo horario.
        </p>
      </Card>
    </>
  )
}