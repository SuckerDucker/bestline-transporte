import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { describe, expect, it, vi } from 'vitest'
import type { Rol } from '@/auth/tipos'
import { mananaCancun } from '@/lib/fechas'
import { esperarPeticion, type Peticion, simularApi } from '@/pruebas/api-simulada'
import { renderizar, usuarioDePrueba } from '@/pruebas/renderizar'
import { RedirigirRolDeManana, RevisionRolPage } from './RevisionRolPage'

const FECHA = '2026-11-10'
// Horas en UTC: 09:00Z = 04:00 en Cancún.
const servicio = (id: number, hora: string, pasajeros = 4, modalidad = 'PRIVADO') => ({
  id,
  folio: `S-${id}`,
  localizador: 'L',
  tipo: 'LLEGADA',
  modalidad,
  fechaHora: `${FECHA}T${hora}:00.000Z`,
  pasajeros,
  vuelo: null,
  estado: 'PENDIENTE',
  zonaOrigen: { id: 1, nombre: 'Aeropuerto CUN' },
  zonaDestino: { id: 2, nombre: 'Zona Hotelera' },
  hotel: null,
})
const asignacion = (id: number, vehiculoId: number, s: ReturnType<typeof servicio>, inicio: string, libera: string) => ({
  id,
  servicioId: s.id,
  vehiculoId,
  orden: 1,
  inicioEfectivo: `${FECHA}T${inicio}:00.000Z`,
  liberacion: `${FECHA}T${libera}:00.000Z`,
  servicio: s,
  vacio: { minutos: 30, desde: `${FECHA}T09:00:00.000Z`, hasta: `${FECHA}T09:30:00.000Z` },
})
const unidad = (id: number, asignaciones: ReturnType<typeof asignacion>[]) => ({
  vehiculo: { id, numeroEconomico: `BL-0${id}`, tipo: 'Van', capacidad: 14 },
  operador: { id: 100 + id, nombre: `Operador ${id}`, horaCita: '04:00' },
  disponible: true,
  encierro: { id: 3, nombre: 'Centro Cancún' },
  cita: `${FECHA}T09:00:00.000Z`,
  finJornada: `${FECHA}T18:30:00.000Z`,
  asignaciones,
})
const ROL = {
  id: 7,
  fecha: FECHA,
  estado: 'PROPUESTO',
  generadoEn: '2026-11-09T22:00:00.000Z',
  autorizadoEn: null,
  autorizador: null,
  resumen: { servicios: 5, asignados: 3, noCubiertos: 2, unidadesUsadas: 2 },
  unidades: [
    unidad(1, [asignacion(11, 1, servicio(1, '10:00'), '09:50', '10:30'), asignacion(12, 1, servicio(2, '12:00', 6, 'GRUPO'), '11:30', '12:30')]),
    unidad(2, [asignacion(21, 2, servicio(3, '10:10'), '10:00', '10:40')]),
    unidad(3, []),
  ],
  noCubiertos: [
    { id: 41, servicioId: 4, motivo: 'CAPACIDAD', servicio: servicio(4, '18:00', 32, 'GRUPO') },
    { id: 51, servicioId: 5, motivo: 'JORNADA', servicio: servicio(5, '23:30') },
  ],
}
const OPCIONES = [
  { vehiculoId: 2, numeroEconomico: 'BL-02', capacidad: 14, actual: false, valido: true, posicion: 2 },
  { vehiculoId: 1, numeroEconomico: 'BL-01', capacidad: 14, actual: true, valido: false, detalle: 'Es la unidad actual del servicio' },
  {
    vehiculoId: 3,
    numeroEconomico: 'BL-03',
    capacidad: 14,
    actual: false,
    valido: false,
    motivo: 'JORNADA',
    detalle: 'S-2 libera a las 07:30, después del fin de la jornada de BL-03 (13:30)',
  },
]

type Responder = (p: Peticion) => { status?: number; cuerpo: unknown } | undefined

/** API simulada con el rol; `responder` puede contestar antes (cambios, errores). */
function renderizarPagina({
  rol = ROL as object | null,
  usuario = 'COORDINADOR' as Rol,
  ruta = `/roles/${FECHA}`,
  responder = (() => undefined) as Responder,
} = {}) {
  const api = simularApi((p) => {
    const propia = responder(p)
    if (propia) return propia
    if (p.ruta.endsWith('/opciones')) return { cuerpo: OPCIONES }
    if (p.metodo === 'PATCH') return { cuerpo: { de: 'BL-01', a: 'BL-02' } }
    if (p.ruta.endsWith('/asignar')) return { cuerpo: { a: 'BL-02' } }
    if (p.ruta.endsWith('/autorizar')) return { cuerpo: { programados: 3, noCubiertos: 2 } }
    return rol ? { cuerpo: rol } : { status: 404, cuerpo: { message: 'No hay rol', statusCode: 404 } }
  })
  renderizar(
    <>
      <Routes>
        <Route path="/roles" element={<RedirigirRolDeManana />} />
        <Route path="/roles/:fecha" element={<RevisionRolPage />} />
      </Routes>
      <Toaster />
    </>,
    { usuario: usuarioDePrueba(usuario), ruta },
  )
  return api
}

describe('Pantalla Revisar rol', () => {
  it('muestra estado, totales, la línea de tiempo por unidad (incluida la vacía) y los no cubiertos por motivo', async () => {
    renderizarPagina()

    const linea = await screen.findByRole('list', { name: 'Línea de tiempo por unidad' })
    expect(screen.getByText('Propuesto')).toBeInTheDocument()
    const totales = screen.getByLabelText('Totales del rol')
    expect(within(totales).getByText('Asignados').nextSibling).toHaveTextContent('3')
    expect(within(totales).getByText('Unidades usadas').nextSibling).toHaveTextContent('2 de 3')

    const filas = within(linea).getAllByRole('listitem')
    expect(filas.map((f) => f.getAttribute('aria-label'))).toEqual(['BL-01', 'BL-02', 'BL-03'])
    expect(within(filas[0]).getByText('Operador 1')).toBeInTheDocument()
    expect(within(filas[0]).getByText('04:00 – 13:30')).toBeInTheDocument()
    expect(
      within(filas[0]).getByRole('button', { name: 'Mover S-2 · 07:00 · Aeropuerto CUN → Zona Hotelera · 6 pax' }),
    ).toBeInTheDocument()
    expect(within(filas[2]).queryAllByRole('button')).toHaveLength(0)

    const capacidad = screen.getByRole('region', { name: 'No cubiertos por Capacidad' })
    expect(within(capacidad).getByText('S-4')).toBeInTheDocument()
    expect(within(capacidad).getByText('Requiere unidad externa (Monitoreo)')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'No cubiertos por Jornada' })).toBeInTheDocument()
  })

  it('mover: abre el selector, deshabilita las inválidas con su motivo y manda el PATCH a la válida', async () => {
    const { peticiones } = renderizarPagina()
    await userEvent.click(await screen.findByRole('button', { name: /^Mover S-2/ }))

    const dialogo = await screen.findByRole('dialog', { name: 'Mover a…' })
    await esperarPeticion(peticiones, (p) => p.ruta === `/roles/${FECHA}/servicios/2/opciones`)
    const bl03 = await within(dialogo).findByRole('button', { name: /BL-03/ })
    expect(bl03).toBeDisabled()
    expect(bl03).toHaveTextContent('Jornada')
    expect(bl03).toHaveTextContent('después del fin de la jornada de BL-03')
    expect(within(dialogo).getByRole('button', { name: /BL-01/ })).toBeDisabled()

    const bl02 = within(dialogo).getByRole('button', { name: /BL-02/ })
    expect(bl02).toHaveTextContent('Quedaría como el servicio 2 de la unidad')
    await userEvent.click(bl02)

    await esperarPeticion(peticiones, (p) => p.metodo === 'PATCH')
    expect(peticiones.find((p) => p.metodo === 'PATCH')).toMatchObject({
      ruta: `/roles/${FECHA}/asignaciones/12`,
      cuerpo: { vehiculoId: 2 },
    })
    expect(await screen.findByText('S-2 movido a BL-02')).toBeInTheDocument()
    // Se vuelve a pedir el rol (invalidación de ['roles', fecha]).
    await esperarPeticion(peticiones, (p) => p.metodo === 'GET' && p.ruta === `/roles/${FECHA}` && peticiones.indexOf(p) > 2)
  })

  it('si la API rechaza el movimiento muestra el detalle y deja el selector abierto', async () => {
    renderizarPagina({
      responder: (p) =>
        p.metodo === 'PATCH'
          ? {
              status: 400,
              cuerpo: { message: 'Empalma con el servicio S-3 de 05:10 en BL-02', motivo: 'EMPALME', statusCode: 400 },
            }
          : undefined,
    })
    await userEvent.click(await screen.findByRole('button', { name: /^Mover S-2/ }))
    const dialogo = await screen.findByRole('dialog', { name: 'Mover a…' })
    await userEvent.click(await within(dialogo).findByRole('button', { name: /BL-02/ }))

    expect(await screen.findByText('No se movió el servicio')).toBeInTheDocument()
    expect(screen.getByText('Empalma con el servicio S-3 de 05:10 en BL-02')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Mover a…' })).toBeInTheDocument()
  })

  it('asignar un no cubierto manda el POST con la unidad elegida', async () => {
    const { peticiones } = renderizarPagina()
    await userEvent.click(await screen.findByRole('button', { name: 'Asignar S-5 a una unidad' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Asignar a…' })
    await userEvent.click(await within(dialogo).findByRole('button', { name: /BL-02/ }))

    await esperarPeticion(peticiones, (p) => p.ruta.endsWith('/asignar'))
    expect(peticiones.find((p) => p.ruta.endsWith('/asignar'))).toMatchObject({
      metodo: 'POST',
      ruta: `/roles/${FECHA}/no-cubiertos/5/asignar`,
      cuerpo: { vehiculoId: 2 },
    })
    expect(await screen.findByText('S-5 asignado a BL-02')).toBeInTheDocument()
  })

  it('autorizar pide confirmación y manda el POST', async () => {
    const { peticiones } = renderizarPagina()
    await userEvent.click(await screen.findByRole('button', { name: 'Autorizar rol' }))
    const confirmacion = await screen.findByRole('alertdialog')
    expect(confirmacion).toHaveTextContent('Quedan 2 servicios sin cubrir')
    await userEvent.click(within(confirmacion).getByRole('button', { name: 'Autorizar' }))

    await esperarPeticion(peticiones, (p) => p.ruta === `/roles/${FECHA}/autorizar`)
    expect(await screen.findByText('Rol autorizado')).toBeInTheDocument()
  })

  it('SUPERVISOR solo consulta: sin autorizar, sin mover y sin asignar', async () => {
    renderizarPagina({ usuario: 'SUPERVISOR' })
    const linea = await screen.findByRole('list', { name: 'Línea de tiempo por unidad' })

    expect(screen.getByText(/Solo consulta/)).toBeInTheDocument()
    expect(within(linea).queryAllByRole('button')).toHaveLength(0)
    expect(within(linea).getByRole('img', { name: /^S-2 · 07:00/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Autorizar rol' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Asignar/ })).not.toBeInTheDocument()
  })

  it('rol AUTORIZADO: muestra quién lo autorizó y queda en solo lectura', async () => {
    renderizarPagina({
      rol: {
        ...ROL,
        estado: 'AUTORIZADO',
        autorizadoEn: '2026-11-09T23:30:00.000Z',
        autorizador: { id: 2, nombre: 'Coordinación Turno A' },
      },
    })
    expect(await screen.findByText('Autorizado')).toBeInTheDocument()
    expect(screen.getByText(/Por Coordinación Turno A el/)).toBeInTheDocument()
    expect(screen.getByText(/ya está AUTORIZADO/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Autorizar rol' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Mover/ })).not.toBeInTheDocument()
  })

  it('sin rol del día ofrece ir a Generar rol', async () => {
    renderizarPagina({ rol: null })
    expect(await screen.findByText('Todavía no se ha generado el rol de este día.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a Generar rol' })).toHaveAttribute('href', '/generar-rol')
  })

  it('/roles abre el rol de mañana', async () => {
    const { peticiones } = renderizarPagina({ ruta: '/roles' })
    await esperarPeticion(peticiones, (p) => p.ruta === `/roles/${mananaCancun()}`)
    expect(screen.getByLabelText('Día de operación')).toHaveValue(mananaCancun())
  })

  it('en celular muestra la lista de unidades con "Mover"', async () => {
    vi.stubGlobal('matchMedia', (consulta: string) => ({
      matches: consulta === '(max-width: 767px)',
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    renderizarPagina()

    const lista = await screen.findByRole('list', { name: 'Unidades del rol' })
    expect(screen.queryByRole('list', { name: 'Línea de tiempo por unidad' })).not.toBeInTheDocument()
    const bl01 = within(lista).getByRole('listitem', { name: 'BL-01' })
    // Un vacío antes de cada uno de sus dos servicios.
    expect(within(bl01).getAllByText('↳ 30 min en vacío', { exact: false })).toHaveLength(2)
    expect(within(bl01).getByRole('button', { name: 'Mover S-1' })).toBeInTheDocument()
    expect(within(lista).getByText('Sin servicios asignados.')).toBeInTheDocument()
  })
})
