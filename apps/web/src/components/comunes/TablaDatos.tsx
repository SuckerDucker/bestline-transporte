import type { LucideIcon } from 'lucide-react'
import { Inbox, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface Columna<T> {
  encabezado: string
  celda: (fila: T) => ReactNode
  alineacion?: 'izquierda' | 'derecha'
  /** Ancho mínimo para que la tabla se desplace en móvil en lugar de apretarse. */
  className?: string
}

interface Props<T> {
  columnas: Columna<T>[]
  filas: T[] | undefined
  clave: (fila: T) => string | number
  cargando: boolean
  error?: string | null
  mensajeVacio: string
  iconoVacio?: LucideIcon
}

const FILAS_ESQUELETO = 5

/**
 * Tabla de los catálogos con shadcn/ui: encabezado, filas alternadas,
 * Skeleton mientras carga y estado vacío o de error con mensaje.
 * En pantallas angostas se desplaza horizontalmente (el contenedor de <Table>
 * tiene overflow-x-auto) sin romper el ancho de la página.
 */
export function TablaDatos<T>({
  columnas,
  filas,
  clave,
  cargando,
  error,
  mensajeVacio,
  iconoVacio: IconoVacio = Inbox,
}: Props<T>) {
  const alinear = (c: Columna<T>) => (c.alineacion === 'derecha' ? 'text-right' : 'text-left')

  let cuerpo: ReactNode
  if (error) {
    cuerpo = (
      <EstadoTabla columnas={columnas.length} icono={TriangleAlert} tono="error" mensaje={error} />
    )
  } else if (cargando && !filas) {
    cuerpo = Array.from({ length: FILAS_ESQUELETO }, (_, i) => (
      <TableRow key={i}>
        {columnas.map((c) => (
          <TableCell key={c.encabezado} className="px-4 py-3.5">
            <Skeleton className="h-4 w-full max-w-36" />
          </TableCell>
        ))}
      </TableRow>
    ))
  } else if (!filas?.length) {
    cuerpo = <EstadoTabla columnas={columnas.length} icono={IconoVacio} mensaje={mensajeVacio} />
  } else {
    cuerpo = filas.map((fila) => (
      <TableRow key={clave(fila)} className="even:bg-muted/40">
        {columnas.map((c) => (
          <TableCell key={c.encabezado} className={cn('px-4 py-3', alinear(c), c.className)}>
            {c.celda(fila)}
          </TableCell>
        ))}
      </TableRow>
    ))
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <Table className="min-w-[640px]">
        <TableHeader className="bg-muted/60">
          <TableRow className="hover:bg-transparent">
            {columnas.map((c) => (
              <TableHead
                key={c.encabezado}
                className={cn(
                  'h-11 px-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase',
                  alinear(c),
                )}
              >
                {c.encabezado}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{cuerpo}</TableBody>
      </Table>
    </div>
  )
}

function EstadoTabla({
  columnas,
  icono: Icono,
  mensaje,
  tono = 'neutro',
}: {
  columnas: number
  icono: LucideIcon
  mensaje: string
  tono?: 'neutro' | 'error'
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={columnas} className="px-4 py-14">
        <div className="flex flex-col items-center gap-3 text-center">
          <span
            className={cn(
              'flex size-11 items-center justify-center rounded-full',
              tono === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground',
            )}
          >
            <Icono className="size-5" />
          </span>
          <p className={cn('text-sm', tono === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
            {mensaje}
          </p>
        </div>
      </TableCell>
    </TableRow>
  )
}
