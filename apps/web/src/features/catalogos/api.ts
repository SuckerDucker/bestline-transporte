import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { pedir, type Paginado } from '../../api/cliente'

export type Recurso = 'vehiculos' | 'operadores' | 'zonas' | 'hoteles'
export type Filtros = Record<string, string | number | boolean | undefined>

/** Listado paginado de un catálogo. Mantiene la página anterior mientras carga. */
export function useListado<T>(recurso: Recurso, filtros: Filtros) {
  return useQuery({
    queryKey: [recurso, filtros],
    queryFn: () => pedir<Paginado<T>>(`/${recurso}`, { query: filtros }),
    placeholderData: keepPreviousData,
  })
}

/** Alta (POST) o edición (PATCH) según si se recibe un id. */
export function useGuardar<T>(recurso: Recurso) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, datos }: { id?: number; datos: object }) =>
      id
        ? pedir<T>(`/${recurso}/${id}`, { metodo: 'PATCH', cuerpo: datos })
        : pedir<T>(`/${recurso}`, { metodo: 'POST', cuerpo: datos }),
    // Se invalidan los listados para que la tabla muestre el cambio.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [recurso] }),
  })
}

/**
 * Desactivación lógica (vehículos y operadores: PATCH /:id/desactivar) o
 * eliminación (zonas y hoteles: DELETE /:id, que responde 409 si está en uso).
 */
export function useQuitar(recurso: Recurso, modo: 'desactivar' | 'eliminar') {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      modo === 'desactivar'
        ? pedir(`/${recurso}/${id}/desactivar`, { metodo: 'PATCH' })
        : pedir(`/${recurso}/${id}`, { metodo: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [recurso] }),
  })
}

/** Devuelve el valor después de una pausa (para no consultar en cada tecla). */
export function useRetrasado<T>(valor: T, milisegundos = 300): T {
  const [retrasado, setRetrasado] = useState(valor)
  useEffect(() => {
    const temporizador = setTimeout(() => setRetrasado(valor), milisegundos)
    return () => clearTimeout(temporizador)
  }, [valor, milisegundos])
  return retrasado
}
