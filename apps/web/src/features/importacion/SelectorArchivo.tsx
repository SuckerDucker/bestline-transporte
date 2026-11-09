import { FileSpreadsheet, UploadCloud, X } from 'lucide-react'
import { type DragEvent, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const tamano = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`)

interface Props {
  archivo: File | null
  alElegir: (archivo: File | null) => void
  deshabilitado?: boolean
}

/** Zona para arrastrar el archivo o elegirlo con el explorador. */
export function SelectorArchivo({ archivo, alElegir, deshabilitado }: Props) {
  const entrada = useRef<HTMLInputElement>(null)
  const [encima, setEncima] = useState(false)

  const soltar = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setEncima(false)
    const elegido = e.dataTransfer.files[0]
    if (elegido && !deshabilitado) alElegir(elegido)
  }

  if (archivo) {
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-muted/40 px-4 py-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileSpreadsheet className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{archivo.name}</p>
          <p className="text-xs text-muted-foreground">{tamano(archivo.size)}</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Quitar archivo" disabled={deshabilitado} onClick={() => alElegir(null)}>
          <X />
        </Button>
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Elegir archivo de servicios"
      onClick={() => entrada.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && entrada.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setEncima(true)
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={soltar}
      className={cn(
        'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors outline-none hover:border-primary/50 hover:bg-primary/[0.03] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40',
        encima && 'border-primary bg-primary/[0.06]',
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <UploadCloud className="size-6" />
      </span>
      <p className="text-sm font-medium">Arrastra aquí el archivo o haz clic para elegirlo</p>
      <p className="text-xs text-muted-foreground">Layout del mayorista en .xlsx o .csv, máximo 5 MB</p>
      <input
        ref={entrada}
        type="file"
        accept=".xlsx,.csv"
        className="hidden"
        data-testid="entrada-archivo"
        onChange={(e) => {
          alElegir(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />
    </div>
  )
}
