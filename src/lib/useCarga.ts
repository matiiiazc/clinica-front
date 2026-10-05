/**
 * Hook de carga de datos para los paneles.
 *
 * Almost todos los paneles hacen lo mismo: pedir una lista al back, manejar el
 * estado de carga y el de error, y volver a pedir despues de una accion. Sin
 * esto, cada pantalla repite el mismo `useState` x3 y un `catch` que se olvida
 * seguido, que es como se termina mostrando "undefined" en pantalla.
 *
 * `recargar` se expone porque la mayoria de las acciones (agendar un turno,
 * responder una consulta) terminan en un `await recargar()`.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiError } from '../lib/types'

export interface EstadoCarga<T> {
  datos: T | null
  cargando: boolean
  error: string | null
  /**
   * Vuelve a pedir los datos.
   *
   * `conSpinner` es para el recargado manual (el botón "Actualizar"): sin él, la
   * tabla se vacía y vuelve a aparecer, que en una pantalla que se mira toda la
   * mañana se lee como que se rompió.
   */
  recargar: (conSpinner?: boolean) => Promise<void>
}

export function useCarga<T>(cargar: () => Promise<T>, deps: unknown[] = []): EstadoCarga<T> {
  const [datos, setDatos] = useState<T | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Guarda la funcion en un ref para no romper la referencia cuando el panel
  // pasa una lambda nueva en cada render.
  const fnRef = useRef(cargar)
  fnRef.current = cargar

  const vigente = useRef(true)
  useEffect(() => {
    vigente.current = true
    return () => {
      vigente.current = false
    }
  }, [])

  const recargar = useCallback(async (mostrarCargando = false) => {
    if (mostrarCargando) setCargando(true)
    try {
      const resultado = await fnRef.current()
      if (!vigente.current) return
      setDatos(resultado)
      setError(null)
    } catch (e) {
      if (!vigente.current) return
      // Los 401 los maneja `api.ts` refrescando el token; si llegamos aca es
      // que la sesion murio de verdad y RutaPrivada va a redirigir.
      setError(e instanceof ApiError ? e.message : 'No se pudo conectar con el servidor.')
    } finally {
      if (vigente.current) setCargando(false)
    }
  }, [])

  /* eslint-disable react-hooks/exhaustive-deps -- deps es dinámico por diseño: lo
   pasa el panel y define qué cambio dispara la carga (fecha, filtro, periodo).
   `recargar` es estable por useCallback, así que no hace falta incluirlo. */
  useEffect(() => {
    setCargando(true)
    void recargar()
  }, deps)
  /* eslint-enable react-hooks/exhaustive-deps */

  return { datos, cargando, error, recargar }
}

export function useAccion<TArgs extends unknown[], TResult>(
  accion: (...args: TArgs) => Promise<TResult>,
): [(...args: TArgs) => Promise<TResult | undefined>, boolean, string | null, () => void] {
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ejecutar = useCallback(
    async (...args: TArgs) => {
      setWorking(true)
      setError(null)
      try {
        return await accion(...args)
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'No se pudo completar la operación.')
        return undefined
      } finally {
        setWorking(false)
      }
    },
    [accion],
  )

  return [ejecutar, working, error, () => setError(null)]
}