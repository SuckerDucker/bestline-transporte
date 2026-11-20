import { FileDown, FileSpreadsheet, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { descargar } from '@/api/cliente'
import { SelectSimple } from '@/components/comunes/SelectSimple'
import { Button } from '@/components/ui/button'

const TODOS = 'todos'

interface Props {
  fecha: string
  /** Operadores para elegir (Revisar rol). Sin lista, la API exporta el del usuario (Mi rol). */
  operadores?: { id: number; etiqueta: string }[]
}

/**
 * "Exportar CSV" y "Exportar PDF" del rol del día, de todos los operadores o
 * de uno. Descarga el archivo que arma la API.
 */
export function BotonesExportar({ fecha, operadores }: Props) {
  const [operador, setOperador] = useState(TODOS)
  const [enCurso, setEnCurso] = useState<'csv' | 'pdf' | null>(null)

  const exportar = async (formato: 'csv' | 'pdf') => {
    setEnCurso(formato)
    try {
      const nombre = await descargar(`/roles/${fecha}/exportar`, {
        formato,
        operadorId: operador === TODOS ? undefined : operador,
      })
      toast.success('Archivo descargado', { description: nombre })
    } catch (error) {
      toast.error('No se pudo exportar el rol', { description: (error as Error).message })
    } finally {
      setEnCurso(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {operadores && (
        <SelectSimple
          ariaLabel="Operador a exportar"
          valor={operador}
          alCambiar={setOperador}
          opciones={[
            { valor: TODOS, etiqueta: 'Todos los operadores' },
            ...operadores.map((o) => ({ valor: String(o.id), etiqueta: o.etiqueta })),
          ]}
          className="w-full sm:w-64"
        />
      )}
      <Button variant="outline" onClick={() => void exportar('csv')} disabled={enCurso !== null}>
        {enCurso === 'csv' ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
        Exportar CSV
      </Button>
      <Button variant="outline" onClick={() => void exportar('pdf')} disabled={enCurso !== null}>
        {enCurso === 'pdf' ? <Loader2 className="animate-spin" /> : <FileDown />}
        Exportar PDF
      </Button>
    </div>
  )
}
