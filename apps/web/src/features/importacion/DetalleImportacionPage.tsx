import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { pedir } from '@/api/cliente'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { diaYHoraCancun } from '@/lib/fechas'
import { TablaServicios } from '../servicios/TablaServicios'
import type { Servicio } from '../servicios/tipos'
import type { Importacion } from './api'

/** Una importación con sus datos y los servicios que se guardaron. */
export function DetalleImportacionPage() {
  const { id } = useParams()
  const consulta = useQuery({
    queryKey: ['importaciones', 'detalle', id],
    queryFn: () => pedir<Importacion & { servicios: Servicio[] }>(`/importaciones/${id}`),
  })
  const importacion = consulta.data

  return (
    <section className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/importaciones">
          <ArrowLeft />
          Volver al historial
        </Link>
      </Button>

      {consulta.error && <p className="text-sm text-destructive">{consulta.error.message}</p>}
      {consulta.isLoading && <Skeleton className="h-24 w-full rounded-xl" />}
      {importacion && (
        <Card className="py-0 shadow-sm">
          <CardContent className="grid gap-4 px-5 py-5 sm:grid-cols-2 lg:grid-cols-5">
            <Dato etiqueta="Archivo">
              <span className="break-all">{importacion.archivo}</span>
            </Dato>
            <Dato etiqueta="Mayorista">{importacion.mayorista.nombre}</Dato>
            <Dato etiqueta="Fecha">{diaYHoraCancun(importacion.fecha)}</Dato>
            <Dato etiqueta="Importó">{importacion.usuario.nombre}</Dato>
            <Dato etiqueta="Filas">
              <span className="font-semibold text-emerald-700">{importacion.filasValidas} guardadas</span>
              <span className="text-muted-foreground"> · {importacion.filasRechazadas} rechazadas</span>
            </Dato>
          </CardContent>
        </Card>
      )}

      <TablaServicios
        servicios={importacion?.servicios}
        cargando={consulta.isLoading}
        mensajeVacio="Esta importación no tiene servicios."
        conMayorista={false}
      />
    </section>
  )
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{etiqueta}</p>
      <p className="text-sm">{children}</p>
    </div>
  )
}
