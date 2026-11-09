import { ClipboardList } from 'lucide-react'
import { TablaDatos, type Columna } from '@/components/comunes/TablaDatos'
import { diaCancun, horaCancun } from '@/lib/fechas'
import { EstadoBadge } from '../catalogos/EstadoBadge'
import { ESTADO_SERVICIO, NOMBRE_MODALIDAD, NOMBRE_TIPO, type Servicio } from './tipos'

interface Props {
  servicios: Servicio[] | undefined
  cargando: boolean
  error?: string | null
  mensajeVacio: string
  /** En el detalle de una importación todos son del mismo mayorista. */
  conMayorista?: boolean
}

/** Tabla de servicios (pantalla Servicios y detalle de una importación). */
export function TablaServicios({ servicios, cargando, error, mensajeVacio, conMayorista = true }: Props) {
  const columnas: Columna<Servicio>[] = [
    {
      encabezado: 'Hora',
      celda: (s) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground tabular-nums">{horaCancun(s.fechaHora)}</span>
          <span className="text-xs whitespace-nowrap text-muted-foreground">{diaCancun(s.fechaHora)}</span>
        </div>
      ),
    },
    {
      encabezado: 'Folio',
      celda: (s) => (
        <div className="flex flex-col">
          <span className="font-medium">{s.folio}</span>
          <span className="text-xs text-muted-foreground">{s.localizador}</span>
        </div>
      ),
    },
    ...(conMayorista ? [{ encabezado: 'Mayorista', celda: (s: Servicio) => s.mayorista?.nombre ?? '—' }] : []),
    {
      encabezado: 'Servicio',
      celda: (s) => (
        <div className="flex flex-col">
          <span>{NOMBRE_TIPO[s.tipo] ?? s.tipo}</span>
          <span className="text-xs text-muted-foreground">{NOMBRE_MODALIDAD[s.modalidad] ?? s.modalidad}</span>
        </div>
      ),
    },
    { encabezado: 'Pax', celda: (s) => s.pasajeros, alineacion: 'derecha' },
    {
      encabezado: 'Ruta',
      celda: (s) => (
        <span className="whitespace-nowrap">
          {s.zonaOrigen.nombre} → {s.zonaDestino.nombre}
        </span>
      ),
    },
    { encabezado: 'Hotel', celda: (s) => s.hotel?.nombre ?? <span className="text-muted-foreground">Sin hotel</span> },
    { encabezado: 'Vuelo', celda: (s) => s.vuelo ?? <span className="text-muted-foreground">—</span> },
    {
      encabezado: 'Estado',
      celda: (s) => <EstadoBadge texto={ESTADO_SERVICIO[s.estado].etiqueta} tono={ESTADO_SERVICIO[s.estado].tono} />,
    },
  ]

  return (
    <TablaDatos
      columnas={columnas}
      filas={servicios}
      clave={(s) => s.id}
      cargando={cargando}
      error={error}
      mensajeVacio={mensajeVacio}
      iconoVacio={ClipboardList}
    />
  )
}
