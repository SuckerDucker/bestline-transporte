import { useMutation } from '@tanstack/react-query'
import { Eye, Flag, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { pedir } from '@/api/cliente'
import { usePuedeEscribir } from '@/auth/contexto'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useInvalidar, useListado } from '../catalogos/api'
import type { Zona } from '../catalogos/tipos'

/**
 * Zonas de término: dónde puede terminar su jornada una unidad (regla del
 * motor). Cada casilla guarda al momento con PATCH /zonas/:id/zona-termino.
 */
export function ZonasTerminoPage() {
  const puedeEscribir = usePuedeEscribir()
  // Todas las zonas en una sola página (son pocas: 8 en la operación actual).
  const zonas = useListado<Zona>('zonas', { limite: 100 })
  const invalidar = useInvalidar('zonas')
  const marcar = useMutation({
    mutationFn: ({ zona, valor }: { zona: Zona; valor: boolean }) =>
      pedir<Zona>(`/zonas/${zona.id}/zona-termino`, { metodo: 'PATCH', cuerpo: { esZonaTermino: valor } }),
    onSuccess: (zona) => {
      toast.success(`${zona.nombre} ${zona.esZonaTermino ? 'marcada' : 'desmarcada'} como zona de término`)
      return invalidar()
    },
    onError: (error) => toast.error('No se pudo cambiar la zona', { description: error.message }),
  })

  const lista = zonas.data?.datos ?? []
  const deTermino = lista.filter((z) => z.esZonaTermino).length

  return (
    <section>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Marca las zonas donde una unidad puede terminar su último servicio del día.
          </p>
          {!puedeEscribir && (
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Eye className="size-3.5" />
              Solo consulta: los cambios los hace el administrador.
            </p>
          )}
        </div>
        {zonas.data && (
          <p className="text-sm font-medium">
            {deTermino} de {lista.length} zonas son de término
          </p>
        )}
      </div>

      {zonas.data && deTermino === 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          No hay zonas de término: el motor no podrá cerrar la jornada de ninguna unidad.
        </div>
      )}
      {zonas.error && <p className="text-sm text-destructive">{zonas.error.message}</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {zonas.isLoading &&
          Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        {lista.map((zona) => {
          const guardando = marcar.isPending && marcar.variables?.zona.id === zona.id
          const id = `termino-${zona.id}`
          return (
            <Card
              key={zona.id}
              className={cn(
                'py-0 shadow-sm transition-colors',
                zona.esZonaTermino && 'border-primary/40 bg-primary/[0.04]',
              )}
            >
              <CardContent className="flex items-center gap-3 px-4 py-4">
                <Checkbox
                  id={id}
                  checked={zona.esZonaTermino}
                  disabled={!puedeEscribir || guardando}
                  onCheckedChange={(v) => marcar.mutate({ zona, valor: v === true })}
                />
                <Label htmlFor={id} className="flex-1 cursor-pointer font-medium peer-disabled:cursor-default">
                  {zona.nombre}
                </Label>
                <Flag
                  className={cn('size-4', zona.esZonaTermino ? 'text-primary' : 'text-muted-foreground/30')}
                  aria-hidden
                />
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
