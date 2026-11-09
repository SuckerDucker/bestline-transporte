import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, Eye, Loader2, TriangleAlert, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ErrorApi, pedir } from '@/api/cliente'
import { usePuedeEscribir } from '@/auth/contexto'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { type CeldaGuardar, claveCelda, type Matriz, revisarEdiciones } from './celdas'

/**
 * Matriz de tiempos de traslado (CU-09): filas = origen, columnas = destino.
 * Las celdas vacías (combinaciones que faltan) se resaltan. "Guardar cambios"
 * envía todas las celdas modificadas juntas; la API las guarda en una sola
 * transacción y, si alguna es inválida, responde con el error de cada celda.
 */
export function MatrizPage() {
  const puedeEscribir = usePuedeEscribir()
  const queryClient = useQueryClient()
  const consulta = useQuery({
    queryKey: ['matriz-tiempos'],
    queryFn: () => pedir<Matriz>('/tiempos-traslado/matriz'),
  })
  // Texto escrito en cada celda editada ("origen-destino" → "25").
  const [ediciones, setEdiciones] = useState<Record<string, string>>({})
  // Errores que devolvió la API en el último intento de guardado.
  const [erroresApi, setErroresApi] = useState<Record<string, string>>({})
  // Los errores locales se muestran después del primer intento de guardar.
  const [intentoGuardar, setIntentoGuardar] = useState(false)

  const guardar = useMutation({
    mutationFn: (tiempos: CeldaGuardar[]) =>
      pedir<Matriz>('/tiempos-traslado/matriz', { metodo: 'PUT', cuerpo: { tiempos } }),
    onSuccess: (matriz, tiempos) => {
      queryClient.setQueryData(['matriz-tiempos'], matriz)
      setEdiciones({})
      setErroresApi({})
      setIntentoGuardar(false)
      toast.success(`${tiempos.length} ${tiempos.length === 1 ? 'tiempo guardado' : 'tiempos guardados'}`)
    },
    onError: (error) => {
      const errores = error instanceof ErrorApi ? (error.datos as { errores?: unknown } | null)?.errores : null
      if (Array.isArray(errores)) {
        setErroresApi(
          Object.fromEntries(
            (errores as { zonaOrigenId: number; zonaDestinoId: number; mensaje: string }[]).map((e) => [
              claveCelda(e.zonaOrigenId, e.zonaDestinoId),
              e.mensaje,
            ]),
          ),
        )
      }
      toast.error('No se guardó la matriz', { description: 'Revisa las celdas marcadas en rojo.' })
    },
  })

  if (consulta.isLoading) return <Skeleton className="h-96 w-full rounded-xl" />
  if (consulta.error || !consulta.data) {
    return <p className="text-sm text-destructive">{consulta.error?.message}</p>
  }

  const matriz = consulta.data
  const { cambios, errores: erroresLocales } = revisarEdiciones(matriz, ediciones)
  const errores = { ...(intentoGuardar ? erroresLocales : {}), ...erroresApi }
  const nombre = (id: number) => matriz.zonas.find((z) => z.id === id)?.nombre ?? `Zona ${id}`
  const hayCambios = Object.keys(ediciones).length > 0

  const editar = (clave: string, texto: string) => {
    setEdiciones((e) => ({ ...e, [clave]: texto }))
    setErroresApi(({ [clave]: _quitado, ...resto }) => resto)
  }
  const alGuardar = () => {
    setIntentoGuardar(true)
    if (Object.keys(erroresLocales).length > 0) {
      toast.error('Hay celdas con valores inválidos', { description: 'Corrige las celdas marcadas en rojo.' })
      return
    }
    if (cambios.length === 0) {
      setEdiciones({})
      return
    }
    guardar.mutate(cambios)
  }
  const descartar = () => {
    setEdiciones({})
    setErroresApi({})
    setIntentoGuardar(false)
  }

  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-2">
          <p className="text-sm text-muted-foreground">
            Minutos de traslado de la zona de la fila (origen) a la zona de la columna (destino). Es por sentido: A → B
            puede ser distinto de B → A.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {matriz.completa ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                <CircleCheck className="size-3.5" /> Matriz completa
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
                <TriangleAlert className="size-3.5" /> {matriz.faltantes.length} combinaciones sin tiempo
              </span>
            )}
            <Leyenda className="border-amber-300 bg-amber-50" texto="Falta el tiempo" />
            {puedeEscribir && <Leyenda className="border-sky-400 bg-sky-50" texto="Modificada" />}
            {puedeEscribir && <Leyenda className="border-destructive bg-destructive/10" texto="Con error" />}
            {!puedeEscribir && (
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Eye className="size-3.5" /> Solo consulta: los cambios los hace el administrador.
              </span>
            )}
          </div>
        </div>

        {puedeEscribir && (
          <div className="flex shrink-0 flex-col-reverse gap-3 sm:flex-row">
            <Button variant="outline" disabled={!hayCambios || guardar.isPending} onClick={descartar}>
              <Undo2 />
              Descartar
            </Button>
            <Button disabled={!hayCambios || guardar.isPending} onClick={alGuardar}>
              {guardar.isPending && <Loader2 className="animate-spin" />}
              Guardar cambios{cambios.length > 0 && ` (${cambios.length})`}
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="bg-muted/60">
              <th className="sticky left-0 z-10 bg-muted px-3 py-3 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Origen \ Destino
              </th>
              {matriz.zonas.map((z) => (
                <th key={z.id} scope="col" className="px-2 py-3 text-center text-xs font-semibold text-muted-foreground">
                  {z.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matriz.zonas.map((origen, i) => (
              <tr key={origen.id} className="border-t even:bg-muted/30">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-card px-3 py-2 text-left text-sm font-semibold whitespace-nowrap"
                >
                  {origen.nombre}
                </th>
                {matriz.zonas.map((destino, j) => {
                  const clave = claveCelda(origen.id, destino.id)
                  const original = matriz.matriz[i][j]
                  const texto = ediciones[clave] ?? (original === null ? '' : String(original))
                  const error = errores[clave]
                  const modificada = ediciones[clave] !== undefined && ediciones[clave].trim() !== String(original ?? '')
                  const vacia = texto.trim() === ''
                  // Prioridad del resaltado: error > modificada > vacía > normal.
                  const estilo = cn(
                    'h-9 w-full min-w-16 rounded-md border text-center tabular-nums transition-colors',
                    i === j && 'font-medium',
                    error
                      ? 'border-destructive bg-destructive/10 font-semibold text-destructive ring-1 ring-destructive'
                      : modificada
                        ? 'border-sky-400 bg-sky-50 font-semibold text-sky-900'
                        : vacia
                          ? 'border-amber-300 bg-amber-50'
                          : puedeEscribir
                            ? 'border-border bg-background'
                            : 'border-transparent bg-transparent',
                  )
                  return (
                    <td key={destino.id} className="px-1.5 py-1.5">
                      {puedeEscribir ? (
                        <input
                          inputMode="numeric"
                          value={texto}
                          onChange={(e) => editar(clave, e.target.value)}
                          aria-label={`Minutos de ${origen.nombre} a ${destino.nombre}`}
                          aria-invalid={!!error || undefined}
                          title={error}
                          placeholder="—"
                          className={cn(estilo, 'outline-none hover:border-ring/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40')}
                        />
                      ) : (
                        <div className={cn(estilo, 'flex items-center justify-center')}>{vacia ? '—' : texto}</div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {Object.keys(errores).length > 0 && (
        <div role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <p className="mb-1 font-medium text-destructive">Celdas con error</p>
          <ul className="list-disc space-y-0.5 pl-5 text-destructive/90">
            {Object.entries(errores).map(([clave, mensaje]) => {
              const [o, d] = clave.split('-').map(Number)
              // Los mensajes de la API ya incluyen "Origen → Destino:".
              return <li key={clave}>{mensaje.includes('→') ? mensaje : `${nombre(o)} → ${nombre(d)}: ${mensaje}`}</li>
            })}
          </ul>
        </div>
      )}
    </section>
  )
}

function Leyenda({ className, texto }: { className: string; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('size-3 rounded-sm border', className)} aria-hidden />
      {texto}
    </span>
  )
}
