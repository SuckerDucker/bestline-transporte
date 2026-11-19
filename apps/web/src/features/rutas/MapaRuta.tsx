import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { horaCancun } from '@/lib/fechas'
import type { Ruta } from './api'
import { agruparParadas, COLOR_RUTA, DESCRIPCION_PARADA, type GrupoParadas, numerarParadas } from './formato'

/** Centro de Cancún: vista inicial mientras carga la ruta. */
const CENTRO_INICIAL: [number, number] = [21.1619, -86.8515]
const ATRIBUCION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const CASA =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>'
/** Margen alrededor de la ruta al encuadrarla. */
const MARGEN_PX = 32
/**
 * Dos marcadores se encimarían si en pantalla están a menos de esto: las
 * etiquetas ("2·3·5") son más anchas que altas.
 */
const SEPARACION_MIN_PX = { x: 56, y: 30 }

/** Parada que se pidió centrar desde la lista (cambia "vez" para repetir el clic). */
export interface Enfoque {
  vehiculoId: number
  latitud: number
  longitud: number
  vez: number
}

interface Props {
  ruta: Ruta | undefined
  comparada?: Ruta
  enfoque: Enfoque | null
}

type Marcadores = Map<string, L.Marker>
const llave = (vehiculoId: number, p: { latitud: number; longitud: number }) =>
  `${vehiculoId}|${p.latitud},${p.longitud}`

/** Puntos de las paradas y del trazado, [latitud, longitud]. */
const puntosDe = (rutas: Ruta[]) =>
  rutas.flatMap((r) => [
    ...r.paradas.map((p) => [p.latitud, p.longitud] as [number, number]),
    ...r.geometria.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]),
  ])

/** Desplazamiento hacia abajo de los marcadores de la unidad comparada. */
const DESPLAZAMIENTO_COMPARADA_PX = 30

const ALTO_ICONO = 26
const anchoIcono = (g: GrupoParadas) => Math.max(26, 12 + g.etiqueta.length * 7 + (g.encierro ? 16 : 0))

/**
 * Marcador como divIcon de Leaflet: círculo con el número (o "2·3" si varias
 * paradas quedan juntas) y, en el encierro, un cuadro oscuro con una casa y el
 * borde del color de su unidad. El ancho crece con la etiqueta para que el
 * texto no se corte. "desplazamiento" baja el marcador (unidad comparada) para
 * no tapar los de la principal.
 */
function icono(grupo: GrupoParadas, color: string, desplazamiento: number) {
  const ancho = anchoIcono(grupo)
  const fondo = grupo.encierro ? '#0f172a' : color
  const forma = grupo.encierro ? 'border-radius:6px' : 'border-radius:9999px'
  const borde = grupo.encierro ? color : '#fff'
  const html = `<div style="display:flex;align-items:center;justify-content:center;gap:2px;width:${ancho}px;height:26px;${forma};background:${fondo};color:#fff;font:600 12px/1 system-ui,sans-serif;border:2px solid ${borde};box-shadow:0 1px 3px rgba(0,0,0,.45)">${grupo.encierro ? CASA : ''}${grupo.etiqueta}</div>`
  return L.divIcon({
    html,
    className: '',
    iconSize: [ancho, 26],
    iconAnchor: [ancho / 2, 13 - desplazamiento],
    popupAnchor: [0, -14 + desplazamiento],
  })
}

export function MapaRuta({ ruta, comparada, enfoque }: Props) {
  // Marcadores por unidad y punto de cada parada, para abrir el popup de la
  // parada elegida en la lista.
  const [marcadores] = useState<Marcadores>(() => new Map())
  const rutas = [ruta, comparada].filter((r) => r !== undefined)

  return (
    <MapContainer
      center={CENTRO_INICIAL}
      zoom={10}
      scrollWheelZoom
      className="h-[360px] w-full rounded-xl border shadow-sm md:h-[620px]"
    >
      <TileLayer attribution={ATRIBUCION} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Capas rutas={rutas} marcadores={marcadores} />
      <Encuadre rutas={rutas} />
      <Centrar enfoque={enfoque} marcadores={marcadores} />
    </MapContainer>
  )
}

/**
 * Trazado y marcadores de cada ruta. Las paradas que en pantalla quedarían a
 * menos de 56 × 30 px (con el zoom al que se encuadran las rutas) van en un solo
 * marcador, para que los números no se encimen. Se calcula una vez por ruta y
 * no en cada zoom, así el popup abierto desde la lista no se cierra solo.
 */
function Capas({ rutas, marcadores }: { rutas: Ruta[]; marcadores: Marcadores }) {
  const map = useMap()
  const clave = rutas.map((r) => `${r.fecha}-${r.vehiculo.id}-${r.trazado}`).join('|')
  const capas = useMemo(() => {
    const puntos = puntosDe(rutas)
    const zoom = puntos.length
      ? map.getBoundsZoom(L.latLngBounds(puntos), false, L.point(2 * MARGEN_PX, 2 * MARGEN_PX))
      : map.getZoom()
    const px = (p: { latitud: number; longitud: number }) => map.project([p.latitud, p.longitud], zoom)
    const cerca = (a: { latitud: number; longitud: number }, b: { latitud: number; longitud: number }) => {
      const [pa, pb] = [px(a), px(b)]
      return Math.abs(pa.x - pb.x) < SEPARACION_MIN_PX.x && Math.abs(pa.y - pb.y) < SEPARACION_MIN_PX.y
    }
    const [principal, otra] = rutas.map((r) => agruparParadas(numerarParadas(r.paradas), cerca))
    // Unidad comparada: cada marcador baja de 30 en 30 px (hasta 120) mientras
    // su caja choque con la de un marcador de la unidad principal.
    const choca = (g: GrupoParadas, abajo: number) =>
      principal.some((h) => {
        const [a, b] = [px(g), px(h)]
        return (
          Math.abs(a.x - b.x) < (anchoIcono(g) + anchoIcono(h)) / 2 &&
          Math.abs(a.y + abajo - b.y) < ALTO_ICONO + 2
        )
      })
    const desplazar = (g: GrupoParadas) => {
      let abajo = DESPLAZAMIENTO_COMPARADA_PX
      while (abajo < 4 * DESPLAZAMIENTO_COMPARADA_PX && choca(g, abajo)) abajo += DESPLAZAMIENTO_COMPARADA_PX
      return abajo
    }
    return [
      { ruta: rutas[0], color: COLOR_RUTA.principal, grupos: principal?.map((g) => ({ ...g, desplazamiento: 0 })) },
      { ruta: rutas[1], color: COLOR_RUTA.comparada, grupos: otra?.map((g) => ({ ...g, desplazamiento: desplazar(g) })) },
    ].filter((c) => c.ruta !== undefined)
    // Solo cambia con las rutas mostradas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, clave])

  return capas.map((c) => <CapaRuta key={c.ruta.vehiculo.id} {...c} marcadores={marcadores} />)
}

interface PropsCapa {
  ruta: Ruta
  color: string
  /** Grupos de paradas con lo que se baja cada marcador (solo en la unidad comparada). */
  grupos: (GrupoParadas & { desplazamiento: number })[]
  marcadores: Marcadores
}

function CapaRuta({ ruta, color, grupos, marcadores }: PropsCapa) {
  const linea = ruta.geometria.coordinates.map(([lon, lat]) => [lat, lon] as [number, number])
  return (
    <>
      <Polyline
        positions={linea}
        pathOptions={{ color, weight: 5, opacity: 0.85, dashArray: ruta.trazado === 'aproximado' ? '8 8' : undefined }}
      />
      {grupos.map((g) => (
        <Marker
          key={g.clave}
          position={[g.latitud, g.longitud]}
          icon={icono(g, color, g.desplazamiento)}
          zIndexOffset={g.desplazamiento ? 0 : 1000}
          title={`${ruta.vehiculo.numeroEconomico}: ${g.paradas[0].nombre}`}
          ref={(m) => {
            if (m) for (const p of g.paradas) marcadores.set(llave(ruta.vehiculo.id, p), m)
          }}
        >
          <Popup maxWidth={280} maxHeight={280}>
            <ContenidoPopup grupo={g} unidad={ruta.vehiculo.numeroEconomico} />
          </Popup>
        </Marker>
      ))}
    </>
  )
}

function ContenidoPopup({ grupo, unidad }: { grupo: GrupoParadas; unidad: string }) {
  return (
    // Leaflet le pone 17 px de margen a cada <p> del popup: se quita.
    <div className="space-y-1.5 text-xs [&_p]:m-0!">
      <p className="text-sm font-semibold">{unidad}</p>
      {grupo.paradas.map((p) => (
        <div key={p.orden} className="space-y-0.5 border-t pt-1.5">
          <p className="font-medium">
            {p.numero !== null && `${p.numero}. `}
            {DESCRIPCION_PARADA[p.tipo]}
            {p.servicio && ` · ${p.servicio.folio}`}
          </p>
          <p className="text-muted-foreground">{p.nombre}</p>
          <p className="tabular-nums">
            {p.llegada && `Llega ${horaCancun(p.llegada)}`}
            {p.llegada && p.salida && p.salida !== p.llegada && ' · '}
            {p.salida && p.salida !== p.llegada && `Sale ${horaCancun(p.salida)}`}
            {!p.llegada && !p.salida && 'Hora no disponible'}
          </p>
          {p.horaCita && <p className="tabular-nums">Hora de cita {horaCancun(p.horaCita)}</p>}
          {p.servicio && (
            <p>
              {p.servicio.origen} → {p.servicio.destino} · {p.servicio.pasajeros} pax
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

/** Ajusta el mapa para que se vean completas las rutas (al cambiar de unidad). */
function Encuadre({ rutas }: { rutas: Ruta[] }) {
  const map = useMap()
  const clave = rutas.map((r) => `${r.fecha}-${r.vehiculo.id}`).join('|')
  useEffect(() => {
    const puntos = puntosDe(rutas)
    if (puntos.length) map.fitBounds(L.latLngBounds(puntos), { padding: [MARGEN_PX, MARGEN_PX] })
    // Solo al cambiar de unidad o de fecha, no en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, clave])
  return null
}

/** Centra la parada elegida en la lista y abre su popup. */
function Centrar({ enfoque, marcadores }: { enfoque: Enfoque | null; marcadores: Marcadores }) {
  const map = useMap()
  useEffect(() => {
    if (!enfoque) return
    map.setView([enfoque.latitud, enfoque.longitud], Math.max(map.getZoom(), 14))
    marcadores.get(llave(enfoque.vehiculoId, enfoque))?.openPopup()
  }, [map, enfoque, marcadores])
  return null
}
