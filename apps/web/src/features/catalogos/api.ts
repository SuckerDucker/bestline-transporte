import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { pedir, type Paginado } from '@/api/cliente'
import { TODOS } from '@/lib/opciones'

export type Recurso = 'vehiculos' | 'operadores' | 'zonas' | 'hoteles'
export type Filtros = Record<string, string | number | boolean | undefined>

/** Quita los filtros en "todos" para no enviarlos a la API. */
const sinTodos = (filtros: Filtros): Filtros =>
  Object.fromEntries(Object.entries(filtros).filter(([, valor]) => valor !== TODOS))

/** Listado paginado de un catálogo. Mantiene la página anterior mientras carga. */
export function useListado<T>(recurso: Recurso, filtros: Filtros) {
  const consulta = sinTodos(filtros)
  return useQuery({
    queryKey: [recurso, consulta],
    queryFn: () => pedir<Paginado<T>>(`/${recurso}`, { query: consulta }),
    placeholderData: keepPreviousData,
  })
}

/** Después de un cambio se recargan el listado y el resumen de la pantalla de inicio. */
function useInvalidar(recurso: Recurso) {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [recurso] }),
      queryClient.invalidateQueries({ queryKey: ['resumen'] }),
    ])
}

/** Alta (POST) o edición (PATCH) según si se recibe un id. */
export function useGuardar<T>(recurso: Recurso) {
  const invalidar = useInvalidar(recurso)
  return useMutation({
    mutationFn: ({ id, datos }: { id?: number; datos: object }) =>
      id
        ? pedir<T>(`/${recurso}/${id}`, { metodo: 'PATCH', cuerpo: datos })
        : pedir<T>(`/${recurso}`, { metodo: 'POST', cuerpo: datos }),
    onSuccess: invalidar,
  })
}

/**
 * Desactivación lógica (vehículos y operadores: PATCH /:id/desactivar) o
 * eliminación (zonas y hoteles: DELETE /:id, que responde 409 si está en uso).
 */
export function useQuitar(recurso: Recurso, modo: 'desactivar' | 'eliminar') {
  const invalidar = useInvalidar(recurso)
  return useMutation({
    mutationFn: (id: number) =>
      modo === 'desactivar'
        ? pedir(`/${recurso}/${id}/desactivar`, { metodo: 'PATCH' })
        : pedir(`/${recurso}/${id}`, { metodo: 'DELETE' }),
    onSuccess: invalidar,
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
