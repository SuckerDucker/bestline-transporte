import { CircleAlert, FileCheck2, Loader2, ScanSearch } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ErrorApi } from '@/api/cliente'
import { Campo } from '@/components/comunes/Campo'
import { Confirmacion } from '@/components/comunes/Confirmacion'
import { SelectSimple } from '@/components/comunes/SelectSimple'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useConfirmar, useMayoristas, useVistaPrevia } from './api'
import { revisarArchivo } from './archivo'
import { SelectorArchivo } from './SelectorArchivo'
import { VistaPrevia } from './VistaPrevia'

/** Encabezados que faltan, si el 400 de la API los trae. */
const faltantesDe = (error: unknown) =>
  error instanceof ErrorApi ? ((error.datos as { faltantes?: string[] } | null)?.faltantes ?? []) : []

/**
 * Importar servicios (CU-10): elegir mayorista y archivo, revisar la vista
 * previa con el estado de cada fila y confirmar. Al confirmar se envía el mismo
 * archivo: la API lo vuelve a validar antes de guardar.
 */
export function ImportarPage() {
  const navegar = useNavigate()
  const mayoristas = useMayoristas()
  const vistaPrevia = useVistaPrevia()
  const confirmar = useConfirmar()
  const [mayoristaId, setMayoristaId] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  // Cambiar el archivo o el mayorista invalida la vista previa anterior.
  const elegirArchivo = (elegido: File | null) => {
    setArchivo(elegido)
    setErrorArchivo(elegido ? revisarArchivo(elegido) : null)
    vistaPrevia.reset()
  }
  const elegirMayorista = (id: string) => {
    setMayoristaId(id)
    vistaPrevia.reset()
  }
  const datos = archivo && mayoristaId ? { archivo, mayoristaId: Number(mayoristaId) } : null

  const generar = () => {
    if (!datos || errorArchivo) return
    vistaPrevia.mutate(datos, {
      onError: (error) => toast.error('No se pudo leer el archivo', { description: error.message }),
    })
  }
  const alConfirmar = () => {
    if (!datos) return
    confirmar.mutate(datos, {
      onSuccess: ({ importacion, totales }) => {
        toast.success(`Importación guardada: ${totales.importables} servicios`, {
          description: `${totales.rechazadas} filas rechazadas. Quedaron en estado PENDIENTE.`,
        })
        navegar(`/importaciones/${importacion.id}`)
      },
      onError: (error) => toast.error('No se guardó la importación', { description: error.message }),
      onSettled: () => setConfirmando(false),
    })
  }

  const vista = vistaPrevia.data
  const faltantes = faltantesDe(vistaPrevia.error)
  const opcionesMayorista = (mayoristas.data ?? []).map((m) => ({ valor: String(m.id), etiqueta: m.nombre }))

  return (
    <section className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Sube el layout diario del mayorista, revisa cada fila y confirma: se guardan las filas válidas y con advertencia
        como servicios PENDIENTE.
      </p>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">1. Archivo del mayorista</CardTitle>
          <CardDescription>La importación queda registrada con el mayorista que elijas.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
          <Campo etiqueta="Mayorista" htmlFor="mayorista">
            <SelectSimple
              id="mayorista"
              valor={mayoristaId}
              alCambiar={elegirMayorista}
              opciones={opcionesMayorista}
              placeholder="Elige el mayorista"
            />
          </Campo>
          <div className="space-y-2">
            <SelectorArchivo archivo={archivo} alElegir={elegirArchivo} deshabilitado={vistaPrevia.isPending} />
            {errorArchivo && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {errorArchivo}
              </p>
            )}
          </div>
          <div className="lg:col-span-2 lg:flex lg:justify-end">
            <Button
              onClick={generar}
              disabled={!datos || !!errorArchivo || vistaPrevia.isPending}
              className="w-full lg:w-auto"
            >
              {vistaPrevia.isPending ? <Loader2 className="animate-spin" /> : <ScanSearch />}
              Generar vista previa
            </Button>
          </div>
        </CardContent>
      </Card>

      {faltantes.length > 0 && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Al archivo le faltan encabezados</p>
            <p className="text-destructive/90">
              Faltan: {faltantes.join(', ')}. Revisa que la fila de encabezados tenga Folio, Localizador, Agencia, Fecha,
              Tipo de Servicio, Pasajeros, Hotel, Zona, Vuelo y Hora (la columna Aeropuerto o Terminal es opcional).
            </p>
          </div>
        </div>
      )}

      {vista && (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="text-base">2. Vista previa</CardTitle>
              <CardDescription>
                {vista.archivo} · {vista.mayorista.nombre}. Nada se ha guardado todavía.
              </CardDescription>
            </div>
            <Button
              onClick={() => setConfirmando(true)}
              disabled={vista.totales.importables === 0 || confirmar.isPending}
              className="shrink-0"
            >
              <FileCheck2 />
              Confirmar importación
            </Button>
          </CardHeader>
          <CardContent>
            {vista.totales.importables === 0 && (
              <p className="mb-4 text-sm text-destructive">No hay filas que se puedan importar en este archivo.</p>
            )}
            <VistaPrevia vista={vista} />
          </CardContent>
        </Card>
      )}

      <Confirmacion
        titulo="¿Confirmar la importación?"
        mensaje={
          vista
            ? `Se guardarán ${vista.totales.importables} servicios en estado PENDIENTE (${vista.totales.advertencias} con advertencia) y se rechazarán ${vista.totales.rechazadas} filas.`
            : ''
        }
        textoConfirmar="Confirmar importación"
        destructiva={false}
        abierto={confirmando}
        procesando={confirmar.isPending}
        alConfirmar={alConfirmar}
        alCancelar={() => setConfirmando(false)}
      />
    </section>
  )
}
