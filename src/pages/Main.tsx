/**
 * Punto de entrada de los paneles.
 *
 * Antes de acá solo se confirmaba que la sesión estaba abierta. Ahora decide qué
 * panel mostrar según el rol del usuario, porque los cuatro ven pantallas
 * distintas y no tiene sentido mostrarle al paciente una agenda completa.
 *
 * El despacho es explícito y no un componente genérico con muchos props: cada
 * panel tiene su propia forma de recibir la sección activa, y meterlos todos en
 * un `switch` dentro de un panel gigante hace que cualquier cambio toque todo el
 * archivo.
 */

import PanelLayout from '../components/PanelLayout'
import { Spinner } from '../components/ui'
import { useAuth } from '../context/useAuth'
import { useSeccionPanel } from '../lib/usePanel'
import type { Rol } from '../lib/types'
import PanelAdmin from '../panels/PanelAdmin'
import PanelMedico from '../panels/PanelMedico'
import PanelPaciente from '../panels/PanelPaciente'
import PanelRecepcion from '../panels/PanelRecepcion'

/**
 * Secciones válidas por rol. Tiene que coincidir con `SECCIONES` de
 * `PanelLayout`: es lo que evita que un `?sec=` inventado, o que sobre de una
 * pestaña que este rol no tiene, deje la pantalla en blanco.
 */
const SECCIONES: Record<Rol, string[]> = {
  admin: ['resumen', 'especialidades', 'profesionales', 'agenda', 'consultas', 'cola'],
  recepcion: ['resumen', 'agenda', 'disponibles', 'consultas', 'cola'],
  medico: ['agenda', 'estado'],
  paciente: ['turnos', 'pedir', 'ficha', 'consultas'],
}

const PANELES: Record<Rol, (seccion: string) => React.ReactNode> = {
  admin: (seccion) => <PanelAdmin seccion={seccion} />,
  recepcion: (seccion) => <PanelRecepcion seccion={seccion} />,
  medico: (seccion) => <PanelMedico seccion={seccion} />,
  paciente: (seccion) => <PanelPaciente seccion={seccion} />,
}

export default function Main() {
  const { usuario, cargando } = useAuth()

  // El hook se llama siempre, incluso sin usuario: si se llamara después del
  // `return` del spinner, cambiar de rol en caliente dejaria los hooks del panel
  // anterior sin desbalancear y React se queja.
  const [seccion, cambiarSeccion] = useSeccionPanel(SECCIONES[usuario?.rol ?? 'paciente'])

  if (cargando || !usuario) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <Spinner className="text-2xl" />
      </div>
    )
  }

  return (
    <PanelLayout seccion={seccion} onSeccion={cambiarSeccion}>
      {PANELES[usuario.rol](seccion)}
    </PanelLayout>
  )
}