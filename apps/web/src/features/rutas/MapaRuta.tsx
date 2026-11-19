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

/**
 * Marcador como divIcon de Leaflet: círculo con el número (o "2·3" si varias
 * paradas caen en el mismo punto) y, en el encierro, un cuadro oscuro con una
 * casa. El ancho crece con la etiqueta para que el texto no se corte.
 */
function icono(grupo: GrupoParadas, color: string) {
  const ancho = Math.max(26, 12 + grupo.etiqueta.length * 7 + (grupo.encierro ? 16 : 0))
  const fondo = grupo.encierro ? '#0f172a' : color
  const forma = grupo.encierro ? 'border-radius:6px' : 'border-radius:9999px'
  const html = `<div style="display:flex;align-items:center;justify-content:center;gap:2px;width:${ancho}px;height:26px;${forma};background:${fondo};color:#fff;font:600 12px/1 system-ui,sans-serif;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.45)">${grupo.encierro ? CASA : ''}${grupo.etiqueta}</div>`
  return L.divIcon({ html, className: '', iconSize: [ancho, 26], iconAnchor: [ancho / 2, 13], popupAnchor: [0, -14] })
}

export function MapaRuta({ ruta, comparada, enfoque }: Props) {
  const capas = [
    ruta && { ruta, color: COLOR_RUTA.principal },
    comparada && { ruta: comparada, color: COLOR_RUTA.comparada },
  ].filter((c) => !!c)
  // Marcadores por unidad y punto, para abrir el popup de la parada elegida en la lista.
  const [marcadores] = useState(() => new Map<string, L.Marker>())

  return (
    <MapContainer
      center={CENTRO_INICIAL}
      zoom={10}
      scrollWheelZoom
      className="h-[360px] w-full rounded-xl border shadow-sm md:h-[620px]"
    >
      <TileLayer attribution={ATRIBUCION} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {capas.map(({ ruta: r, color }) => (
        <CapaRuta key={r.vehiculo.id} ruta={r} color={color} marcadores={marcadores} />
      ))}
      <Encuadre rutas={capas.map((c) => c.ruta)} />
      <Centrar enfoque={enfoque} marcadores={marcadores} />
    </MapContainer>
  )
}

function CapaRuta({ ruta, color, marcadores }: { ruta: Ruta; color: string; marcadores: Map<string, L.Marker> }) {
  const grupos = useMemo(() => agruparParadas(numerarParadas(ruta.paradas)), [ruta])
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
          icon={icono(g, color)}
          title={`${ruta.vehiculo.numeroEconomico}: ${g.paradas[0].nombre}`}
          ref={(m) => {
            if (m) marcadores.set(`${ruta.vehiculo.id}|${g.clave}`, m)
          }}
        >
          <Popup>
            <ContenidoPopup grupo={g} unidad={ruta.vehiculo.numeroEconomico} />
          </Popup>
        </Marker>
      ))}
    </>
  )
}

function ContenidoPopup({ grupo, unidad }: { grupo: GrupoParadas; unidad: string }) {
  return (
    <div className="space-y-2 text-xs">
      <p className="text-sm font-semibold">
        {unidad} · {grupo.paradas[0].nombre}
      </p>
      {grupo.paradas.map((p) => (
        <div key={p.orden} className="border-t pt-1.5">
          <p className="font-medium">
            {p.numero !== null && `${p.numero}. `}
            {DESCRIPCION_PARADA[p.tipo]}
            {p.servicio && ` · ${p.servicio.folio}`}
          </p>
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
    const puntos = rutas.flatMap((r) => [
      ...r.paradas.map((p) => [p.latitud, p.longitud] as [number, number]),
      ...r.geometria.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]),
    ])
    if (puntos.length) map.fitBounds(L.latLngBounds(puntos), { padding: [32, 32] })
    // Solo al cambiar de unidad o de fecha, no en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, clave])
  return null
}

/** Centra la parada elegida en la lista y abre su popup. */
function Centrar({ enfoque, marcadores }: { enfoque: Enfoque | null; marcadores: Map<string, L.Marker> }) {
  const map = useMap()
  useEffect(() => {
    if (!enfoque) return
    map.setView([enfoque.latitud, enfoque.longitud], Math.max(map.getZoom(), 14))
    marcadores.get(`${enfoque.vehiculoId}|${enfoque.latitud},${enfoque.longitud}`)?.openPopup()
  }, [map, enfoque, marcadores])
  return null
}
