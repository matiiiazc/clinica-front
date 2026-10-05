/**
 * Hooks de los paneles.
 *
 * Viven aparte de los componentes a propósito: un archivo que exporta un
 * componente y un hook rompe el fast refresh de Vite, que es lo que hace que un
 * cambio guardado se vea al instante sin recargar la página.
 */

import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { AlertTriangle } from 'lucide-react'

import { BotonChico } from '../components/ui'

/**
 * Confirmación antes de una acción irreversible.
 *
 * Cancelar un turno libera el horario de otro y le llega un mensaje al
 * paciente. Por eso el texto dice a quién y a qué hora, para no confirmar a
 * ciegas.
 */
export function useConfirmacion() {
  const [pendiente, setPendiente] = useState<{ texto: string; onOk: () => void } | null>(null)

  const dialogo = pendiente && (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm rounded-xl border p-4"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-start gap-2">
          <AlertTriangle size={18} style={{ color: 'var(--color-danger)' }} aria-hidden="true" />
          <p className="text-sm">{pendiente.texto}</p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <BotonChico onClick={() => setPendiente(null)}>Volver</BotonChico>
          <BotonChico
            tono="peligro"
            onClick={() => {
              pendiente.onOk()
              setPendiente(null)
            }}
          >
            Confirmar
          </BotonChico>
        </div>
      </div>
    </div>
  )

  return {
    dialogo,
    pedirConfirmacion: (texto: string, onOk: () => void) => setPendiente({ texto, onOk }),
  }
}

/**
 * Sección activa del panel, guardada en la URL como `?sec=agenda`.
 *
 * Va en el query string y no en estado interno para que el panel sea enlazable:
 * si recepción le pasa la pantalla de la cola a otra persona, el link abre en la
 * cola y no en el resumen.
 *
 * Se usa `useSearchParams` y no `window.location.search` a mano para que el
 * cambio de sección dispare un render: leer la URL directo hace que el tab
 * cambie de color un render tarde, o no cambie.
 */
export function useSeccionPanel(valoresValidos: string[]): [string, (id: string) => void] {
  const [parametros, setParametros] = useSearchParams()
  const pedida = parametros.get('sec') ?? valoresValidos[0]
  const seccion = valoresValidos.includes(pedida) ? pedida : valoresValidos[0]

  function cambiar(id: string) {
    const siguiente = new URLSearchParams(parametros)
    siguiente.set('sec', id)
    // `replace` y no `push`: cambiar de tab no debería llenar el historial del
    // navegador de pantallas que el usuario no quiere volver a abrir.
    setParametros(siguiente, { replace: true })
  }

  return [seccion, cambiar]
}