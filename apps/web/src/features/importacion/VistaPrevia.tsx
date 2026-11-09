import { FileSpreadsheet, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { SelectSimple } from '@/components/comunes/SelectSimple'
import { TablaDatos, type Columna } from '@/components/comunes/TablaDatos'
import { TODOS } from '@/lib/opciones'
import { cn } from '@/lib/utils'
import { EstadoBadge } from '../catalogos/EstadoBadge'
import { ESTADOS_FILA, type EstadoFila, type FilaVistaPrevia, type VistaPrevia as Vista } from './api'
import { ESTADO_FILA } from './estados'

const OPCIONES_ESTADO = [
  { valor: TODOS, etiqueta: 'Todos los estados' },
  ...ESTADOS_FILA.map((e) => ({ valor: e, etiqueta: ESTADO_FILA[e].plural })),
]

/** Clave de cada contador en los totales de la API. */
const TOTAL_DE: Record<EstadoFila, 'validas' | 'advertencias' | 'duplicadas' | 'errores'> = {
  VALIDA: 'validas',
  ADVERTENCIA: 'advertencias',
  DUPLICADA: 'duplicadas',
  ERROR: 'errores',
}

const COLUMNAS: Columna<FilaVistaPrevia>[] = [
  { encabezado: 'Fila', celda: (f) => <span className="text-muted-foreground tabular-nums">{f.fila}</span> },
  {
    encabezado: 'Estado',
    celda: (f) => <EstadoBadge texto={ESTADO_FILA[f.estado].etiqueta} tono={ESTADO_FILA[f.estado].tono} />,
  },
  {
    encabezado: 'Folio',
    celda: (f) => (
      <div className="flex flex-col">
        <span className="font-semibold text-foreground">{f.valores.Folio || '—'}</span>
        <span className="text-xs text-muted-foreground">{f.valores.Localizador}</span>
      </div>
    ),
  },
  {
    encabezado: 'Fecha y hora',
    celda: (f) => (
      <span className="whitespace-nowrap tabular-nums">
        {f.valores.Fecha} {f.valores.Hora}
      </span>
    ),
  },
  {
    encabezado: 'Servicio',
    celda: (f) =>
      f.servicio ? (
        <div className="flex flex-col">
          <span className="font-medium">{f.servicio.tipo}</span>
          <span className="text-xs text-muted-foreground">{f.servicio.modalidad}</span>
        </div>
      ) : (
        <span className="text-muted-foreground">{f.valores['Tipo de Servicio']}</span>
      ),
  },
  { encabezado: 'Pax', celda: (f) => f.valores.Pasajeros, alineacion: 'derecha' },
  { encabezado: 'Hotel', celda: (f) => f.valores.Hotel },
  {
    encabezado: 'Ruta',
    celda: (f) =>
      f.servicio ? (
        <span className="whitespace-nowrap">
          {f.servicio.zonaOrigen} → {f.servicio.zonaDestino}
        </span>
      ) : (
        <span className="text-muted-foreground">{f.valores.Zona}</span>
      ),
  },
  {
    encabezado: 'Mensajes',
    className: 'min-w-64',
    celda: (f) =>
      f.mensajes.length ? (
        <ul className="space-y-0.5 text-xs">
          {f.mensajes.map((m) => (
            <li key={m} className={f.estado === 'ERROR' || f.estado === 'DUPLICADA' ? 'text-destructive' : 'text-amber-700'}>
              {m}
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
]

/**
 * Resultado de la vista previa: contadores por estado (que también sirven de
 * filtro), avisos del archivo y la tabla de filas con su estado y mensajes.
 */
export function VistaPrevia({ vista }: { vista: Vista }) {
  const [estado, setEstado] = useState<string>(TODOS)
  const filas = estado === TODOS ? vista.filas : vista.filas.filter((f) => f.estado === estado)
  const alternar = (valor: string) => setEstado((actual) => (actual === valor ? TODOS : valor))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" role="group" aria-label="Contadores por estado">
        <Contador etiqueta="Total" valor={vista.totales.total} activo={estado === TODOS} alPulsar={() => setEstado(TODOS)} />
        {ESTADOS_FILA.map((e) => (
          <Contador
            key={e}
            etiqueta={ESTADO_FILA[e].plural}
            valor={vista.totales[TOTAL_DE[e]]}
            tono={ESTADO_FILA[e].tono}
            activo={estado === e}
            alPulsar={() => alternar(e)}
          />
        ))}
      </div>

      {vista.avisos.map((aviso) => (
        <p
          key={aviso}
          className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {aviso}
        </p>
      ))}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {filas.length === vista.filas.length
            ? `${vista.filas.length} filas en el archivo`
            : `Mostrando ${filas.length} de ${vista.filas.length} filas`}
        </p>
        <SelectSimple
          ariaLabel="Filtrar por estado"
          valor={estado}
          alCambiar={setEstado}
          opciones={OPCIONES_ESTADO}
          className="h-9 bg-card sm:w-52"
        />
      </div>

      <TablaDatos
        columnas={COLUMNAS}
        filas={filas}
        clave={(f) => f.fila}
        cargando={false}
        mensajeVacio="No hay filas con ese estado."
        iconoVacio={FileSpreadsheet}
      />
    </div>
  )
}

const COLOR_TONO = {
  exito: 'text-emerald-700',
  aviso: 'text-amber-700',
  info: 'text-sky-700',
  error: 'text-red-700',
  neutro: 'text-foreground',
} as const

function Contador({
  etiqueta,
  valor,
  tono = 'neutro',
  activo,
  alPulsar,
}: {
  etiqueta: string
  valor: number
  tono?: keyof typeof COLOR_TONO
  activo: boolean
  alPulsar: () => void
}) {
  return (
    <button
      type="button"
      onClick={alPulsar}
      aria-pressed={activo}
      className={cn(
        'rounded-xl border bg-card px-4 py-3 text-left shadow-sm transition-colors hover:border-ring/60',
        activo && 'border-primary ring-1 ring-primary',
      )}
    >
      <span className="block text-xs font-medium text-muted-foreground">{etiqueta}</span>
      <span className={cn('block text-2xl font-semibold tabular-nums', COLOR_TONO[tono])}>{valor}</span>
    </button>
  )
}
