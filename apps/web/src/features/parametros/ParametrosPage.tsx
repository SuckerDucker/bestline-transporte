import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye } from 'lucide-react'
import { toast } from 'sonner'
import { pedir } from '@/api/cliente'
import { usePuedeEscribir } from '@/auth/contexto'
import { Skeleton } from '@/components/ui/skeleton'
import type { Parametro } from './esquema'
import { FormularioParametros } from './FormularioParametros'

/** Parámetros de operación (CU-08): el ADMINISTRADOR edita; COORDINADOR y SUPERVISOR consultan. */
export function ParametrosPage() {
  const puedeEscribir = usePuedeEscribir()
  const queryClient = useQueryClient()
  const parametros = useQuery({ queryKey: ['parametros'], queryFn: () => pedir<Parametro[]>('/parametros') })
  const guardar = useMutation({
    mutationFn: (cambios: { clave: string; valor: string }[]) =>
      pedir<Parametro[]>('/parametros', { metodo: 'PUT', cuerpo: { parametros: cambios } }),
    onSuccess: (actualizados) => queryClient.setQueryData(['parametros'], actualizados),
  })

  const alGuardar = (cambios: { clave: string; valor: string }[]) =>
    guardar.mutateAsync(cambios, {
      onSuccess: () => toast.success('Parámetros guardados', { description: 'Los cambios quedaron en la bitácora.' }),
      onError: (error) => toast.error('No se guardaron los parámetros', { description: error.message }),
    })

  return (
    <section>
      <div className="mb-6 space-y-1">
        <p className="text-sm text-muted-foreground">
          Valores que usa el motor de asignación para calcular el inicio efectivo y la jornada de cada unidad.
        </p>
        {!puedeEscribir && (
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Eye className="size-3.5" />
            Solo consulta: los cambios los hace el administrador.
          </p>
        )}
      </div>

      {parametros.isLoading && (
        <div className="grid gap-5 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      )}
      {parametros.error && <p className="text-sm text-destructive">{parametros.error.message}</p>}
      {parametros.data && (
        <FormularioParametros parametros={parametros.data} soloLectura={!puedeEscribir} alGuardar={alGuardar} />
      )}
    </section>
  )
}
