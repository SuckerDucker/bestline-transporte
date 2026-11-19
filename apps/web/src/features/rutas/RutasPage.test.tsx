import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { esperarPeticion, simularApi } from '@/pruebas/api-simulada'
import { renderizar, usuarioDePrueba } from '@/pruebas/renderizar'
import type { Ruta } from './api'
import { RutasPage } from './RutasPage'

// jsdom no dibuja mapas: Leaflet y react-leaflet se reemplazan por elementos
// simples para revisar qué se le pasa al mapa (trazado, marcadores y popups).
// project: 20 000 px por grado, así el hotel a ~450 m del encierro (80 px en x) no se junta.
const mapa = vi.hoisted(() => ({
  fitBounds: vi.fn(),
  setView: vi.fn(),
  getZoom: () => 10,
  getBoundsZoom: () => 10,
  project: ([lat, lon]: [number, number]) => ({
    x: lon * 20_000,
    y: lat * 20_000,
    distanceTo(o: { x: number; y: number }) {
      return Math.hypot(this.x - o.x, this.y - o.y)
    },
  }),
}))
// Popup abierto por cada marcador (el ref del Marker simulado expone openPopup).
const popups = vi.hoisted(() => [] as string[])
vi.mock('leaflet', () => ({
  default: { divIcon: (o: unknown) => o, latLngBounds: (puntos: unknown) => puntos, point: (x: number, y: number) => ({ x, y }) },
}))
vi.mock('react-leaflet', async () => {
  const { forwardRef, useImperativeHandle } = await import('react')
  return {
    MapContainer: ({ children }: { children: ReactNode }) => <div data-testid="mapa">{children}</div>,
    TileLayer: ({ attribution }: { attribution: string }) => <p data-testid="atribucion">{attribution}</p>,
    Polyline: ({ pathOptions }: { pathOptions: { color: string; dashArray?: string } }) => (
      <div data-testid="trazado" data-color={pathOptions.color} data-punteado={pathOptions.dashArray ? 'si' : 'no'} />
    ),
    Marker: forwardRef<{ openPopup: () => void }, { title: string; children: ReactNode; icon: { html: string } }>(
      function Marcador({ title, children, icon }, ref) {
        useImperativeHandle(ref, () => ({ openPopup: () => popups.push(title) }))
        return (
          <div data-testid="marcador" title={title} data-icono={icon.html}>
            {children}
          </div>
        )
      },
    ),
    Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    useMap: () => mapa,
  }
})

const FECHA = '2026-11-10'
// Horas en UTC: 10:20Z = 05:20 en Cancún.
const h = (hora: string) => `${FECHA}T${hora}:00.000Z`
const CENTRO = { latitud: 21.1619, longitud: -86.8515 }
const CUN = { latitud: 21.0365, longitud: -86.8771 }
const HOTEL = { latitud: 21.1335, longitud: -86.7465 }

const servicio = (folio: string, origen: string, destino: string) => ({
  id: Number(folio.slice(2)),
  folio,
  tipo: 'SALIDA',
  modalidad: 'PRIVADO',
  pasajeros: 4,
  origen,
  destino,
})
const S1 = servicio('S-1', 'Hotel Ejemplo ZH 1', 'Aeropuerto CUN')
const S2 = servicio('S-2', 'Aeropuerto CUN', 'Centro Cancún')

function ruta(vehiculoId: number, trazado: 'carretera' | 'aproximado' = 'carretera'): Ruta {
  return {
    fecha: FECHA,
    estadoRol: 'PROPUESTO',
    vehiculo: { id: vehiculoId, numeroEconomico: `BL-0${vehiculoId}`, tipo: 'Van', capacidad: 14 },
    operador: { id: vehiculoId, nombre: `Operador 0${vehiculoId}`, horaCita: '04:00' },
    servicios: 2,
    paradas: [
      { orden: 1, tipo: 'ENCIERRO_SALIDA', nombre: 'Centro Cancún', zona: 'Centro Cancún', ...CENTRO, llegada: null, salida: h('10:20'), horaCita: h('09:00') },
      { orden: 2, tipo: 'ORIGEN', nombre: 'Hotel Ejemplo ZH 1', zona: 'Zona Hotelera', ...HOTEL, llegada: h('10:50'), salida: h('11:00'), servicio: S1 },
      { orden: 3, tipo: 'DESTINO', nombre: 'Aeropuerto CUN', zona: 'Aeropuerto CUN', ...CUN, llegada: h('11:30'), salida: h('11:30'), servicio: S1 },
      // Recoge en el mismo punto donde dejó: un solo marcador "2·3".
      { orden: 4, tipo: 'ORIGEN', nombre: 'Aeropuerto CUN', zona: 'Aeropuerto CUN', ...CUN, llegada: h('12:50'), salida: h('13:00'), servicio: S2 },
      { orden: 5, tipo: 'DESTINO', nombre: 'Hotel Ejemplo Centro 1', zona: 'Centro Cancún', latitud: 21.1605, longitud: -86.8475, llegada: h('13:30'), salida: h('13:30'), servicio: S2 },
      { orden: 6, tipo: 'ENCIERRO_REGRESO', nombre: 'Centro Cancún', zona: 'Centro Cancún', ...CENTRO, llegada: h('13:40'), salida: null },
    ],
    geometria: { type: 'LineString', coordinates: [[CENTRO.longitud, CENTRO.latitud], [CUN.longitud, CUN.latitud]] },
    distanciaKm: trazado === 'carretera' ? 52.5 : 38.1,
    duracionMin: trazado === 'carretera' ? 74 : null,
    trazado,
  }
}

// Rol con BL-01 y BL-02 con servicios y BL-03 sin servicios (no aparece en el selector).
const unidad = (id: number, servicios: number) => ({
  vehiculo: { id, numeroEconomico: `BL-0${id}`, tipo: 'Van', capacidad: 14 },
  asignaciones: Array.from({ length: servicios }, (_, i) => ({ id: id * 10 + i })),
})
const ROL = {
  id: 7,
  fecha: FECHA,
  estado: 'PROPUESTO',
  resumen: { servicios: 4, asignados: 4, noCubiertos: 0, unidadesUsadas: 2 },
  unidades: [unidad(1, 2), unidad(2, 2), unidad(3, 0)],
  noCubiertos: [],
}

function abrir({ ruta: url = `/rutas/${FECHA}`, rol = ROL as unknown, trazado = 'carretera' as Ruta['trazado'] } = {}) {
  const api = simularApi(({ ruta: r }) => {
    if (r === `/roles/${FECHA}`) return rol ? { cuerpo: rol } : { status: 404, cuerpo: { message: 'No hay rol' } }
    const m = /\/rutas\/(\d+)$/.exec(r)
    if (m) return { cuerpo: ruta(Number(m[1]), Number(m[1]) === 1 ? trazado : 'carretera') }
    return { status: 404, cuerpo: { message: 'No encontrado' } }
  })
  renderizar(
    <Routes>
      <Route path="/rutas/:fecha" element={<RutasPage />} />
    </Routes>,
    { usuario: usuarioDePrueba('SUPERVISOR'), ruta: url },
  )
  return api
}

describe('Rutas sugeridas', () => {
  it('lista las paradas en orden con sus horas y el encierro sin número', async () => {
    abrir()
    const lista = await screen.findByRole('list', { name: 'Paradas de la ruta' })
    const paradas = within(lista).getAllByRole('listitem')

    expect(paradas).toHaveLength(6)
    expect(paradas[0]).toHaveTextContent('Sale del encierro')
    expect(paradas[0]).toHaveTextContent('Sale 05:20 · cita 04:00')
    expect(paradas[1]).toHaveTextContent('1Recoge · S-1')
    expect(paradas[1]).toHaveTextContent('Hotel Ejemplo ZH 1 (Zona Hotelera)')
    expect(paradas[1]).toHaveTextContent('Llega 05:50 · Sale 06:00 · 4 pax')
    expect(paradas[2]).toHaveTextContent('2Deja · S-1')
    expect(paradas[2]).toHaveTextContent('Llega 06:30')
    expect(paradas[5]).toHaveTextContent('Regresa al encierro')
    expect(paradas[5]).toHaveTextContent('Llega 08:40')
  })

  it('muestra distancia, duración y la atribución de OpenStreetMap', async () => {
    abrir()
    const totales = await screen.findByLabelText('Totales de la ruta')
    expect(totales).toHaveTextContent('52.5 km')
    expect(totales).toHaveTextContent('1 h 14 min')
    expect(totales).toHaveTextContent('2 · 05:20 a 08:40')
    expect(screen.getByTestId('atribucion')).toHaveTextContent('OpenStreetMap')
    expect(screen.queryByText(/Trazado aproximado/)).not.toBeInTheDocument()
    expect(screen.getByTestId('trazado')).toHaveAttribute('data-punteado', 'no')
  })

  it('junta en un marcador las paradas en el mismo punto y el encierro lleva icono propio', async () => {
    abrir()
    await screen.findByRole('list', { name: 'Paradas de la ruta' })
    const marcadores = screen.getAllByTestId('marcador')
    // Encierro (salida y regreso), hotel ZH, CUN (2·3) y hotel Centro.
    expect(marcadores).toHaveLength(4)
    const cun = marcadores.find((m) => m.title === 'BL-01: Aeropuerto CUN')!
    expect(cun.dataset.icono).toContain('>2·3</div>')
    expect(cun).toHaveTextContent('Deja · S-1')
    expect(cun).toHaveTextContent('Recoge · S-2')
    expect(cun).toHaveTextContent('Aeropuerto CUN → Centro Cancún · 4 pax')
    const encierro = marcadores.find((m) => m.title === 'BL-01: Centro Cancún')!
    expect(encierro.dataset.icono).toContain('<svg')
    expect(encierro).toHaveTextContent('Hora de cita 04:00')
  })

  it('al elegir una parada de la lista el mapa la centra', async () => {
    abrir()
    const lista = await screen.findByRole('list', { name: 'Paradas de la ruta' })
    await userEvent.click(within(lista).getByRole('button', { name: '1. Recoge S-1, Hotel Ejemplo ZH 1, Llega 05:50 · Sale 06:00' }))
    expect(mapa.setView).toHaveBeenLastCalledWith([HOTEL.latitud, HOTEL.longitud], 14)
    expect(popups.at(-1)).toBe('BL-01: Hotel Ejemplo ZH 1')
  })

  it('avisa cuando el trazado es aproximado y muestra la duración como "—"', async () => {
    abrir({ trazado: 'aproximado' })
    expect(await screen.findByText(/Trazado aproximado: no se pudo consultar el servidor de rutas/)).toBeInTheDocument()
    expect(screen.getByLabelText('Totales de la ruta')).toHaveTextContent('Duración de manejo—')
    expect(screen.getByTestId('trazado')).toHaveAttribute('data-punteado', 'si')
  })

  it('el selector solo ofrece unidades con servicios y cambia la ruta pedida', async () => {
    const { peticiones } = abrir()
    await esperarPeticion(peticiones, (p) => p.ruta === `/roles/${FECHA}/rutas/1`)

    await userEvent.click(screen.getByRole('combobox', { name: 'Unidad' }))
    const opciones = screen.getAllByRole('option').map((o) => o.textContent)
    expect(opciones).toEqual(['BL-01 · Van · 2 servicios', 'BL-02 · Van · 2 servicios'])
    await userEvent.click(screen.getByRole('option', { name: 'BL-02 · Van · 2 servicios' }))

    await esperarPeticion(peticiones, (p) => p.ruta === `/roles/${FECHA}/rutas/2`)
    expect(await screen.findByLabelText('Totales de la ruta')).toHaveTextContent('BL-02')
  })

  it('abre la unidad de la URL (enlace "Ver ruta") y compara con otra en otro color', async () => {
    const { peticiones } = abrir({ ruta: `/rutas/${FECHA}?unidad=2` })
    await esperarPeticion(peticiones, (p) => p.ruta === `/roles/${FECHA}/rutas/2`)
    expect(screen.getByRole('combobox', { name: 'Unidad' })).toHaveTextContent('BL-02')

    await userEvent.click(screen.getByRole('combobox', { name: 'Comparar con' }))
    await userEvent.click(screen.getByRole('option', { name: 'BL-01 · Van · 2 servicios' }))

    expect(await screen.findByText(/Comparando con/)).toHaveTextContent('Comparando con BL-01: 52.5 km · 1 h 14 min de manejo')
    const colores = screen.getAllByTestId('trazado').map((t) => t.dataset.color)
    expect(new Set(colores).size).toBe(2)
  })

  it('avisa si el rol del día no se ha generado', async () => {
    abrir({ rol: null })
    expect(await screen.findByText('Todavía no se ha generado el rol de este día.')).toBeInTheDocument()
    expect(screen.queryByTestId('mapa')).not.toBeInTheDocument()
  })
})
