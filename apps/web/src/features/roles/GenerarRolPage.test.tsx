import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toaster } from 'sonner'
import { describe, expect, it } from 'vitest'
import { type Peticion, simularApi } from '@/pruebas/api-simulada'
import { renderizar, usuarioDePrueba } from '@/pruebas/renderizar'
import { GenerarRolPage } from './GenerarRolPage'

const servicio = (folio: string, hora: string, pasajeros: number) => ({
  id: Number(folio.slice(2)),
  folio,
  localizador: 'L',
  tipo: 'LLEGADA',
  modalidad: 'GRUPO',
  fechaHora: `2026-11-10T${hora}:00.000Z`,
  pasajeros,
  vuelo: null,
  estado: 'PENDIENTE',
  zonaOrigen: { id: 1, nombre: 'Aeropuerto CUN' },
  zonaDestino: { id: 2, nombre: 'Zona Hotelera' },
  hotel: null,
})
const NO_CUBIERTOS = [
  { id: 1, motivo: 'CAPACIDAD', servicio: servicio('S-40', '15:00', 32) },
  { id: 2, motivo: 'JORNADA', servicio: servicio('S-55', '23:30', 4) },
]
const GENERADO = {
  rol: { id: 7, fecha: '2026-11-10', estado: 'PROPUESTO', generadoEn: '2026-11-09T22:00:00.000Z' },
  reemplazado: false,
  resumen: {
    servicios: 60,
    asignados: 58,
    noCubiertos: 2,
    unidadesUsadas: 9,
    unidadesDisponibles: 9,
    tiempoMs: 35,
    porMotivo: { CAPACIDAD: 1, EMPALME: 0, JORNADA: 1, ZONA_TERMINO: 0, SIN_UNIDAD: 0 },
  },
}
const ROL = { ...GENERADO.rol, resumen: { servicios: 60, asignados: 58, noCubiertos: 2, unidadesUsadas: 9 } }

/** API simulada: `rol` es lo que responde GET /roles/:fecha (null = 404). */
function renderizarPagina(rol: object | null, responder?: (p: Peticion) => { status?: number; cuerpo: unknown }) {
  let generado = false
  const api = simularApi((p) => {
    if (p.metodo === 'POST') {
      generado = true
      return responder?.(p) ?? { status: 201, cuerpo: GENERADO }
    }
    if (p.ruta.endsWith('/no-cubiertos')) return { cuerpo: NO_CUBIERTOS }
    const actual = generado ? ROL : rol
    return actual ? { cuerpo: actual } : { status: 404, cuerpo: { message: 'No hay rol', statusCode: 404 } }
  })
  renderizar(
    <>
      <GenerarRolPage />
      <Toaster />
    </>,
    { usuario: usuarioDePrueba('COORDINADOR') },
  )
  return api
}
const elegirFecha = async (fecha = '2026-11-10') => {
  const campo = screen.getByLabelText('Día de operación')
  await userEvent.clear(campo)
  await userEvent.type(campo, fecha)
}
const tarjeta = (etiqueta: string) =>
  within(screen.getByLabelText('Resumen del rol')).getByText(etiqueta).parentElement as HTMLElement

describe('Pantalla Generar rol', () => {
  it('sin rol previo: genera, muestra el resumen y los no cubiertos con su motivo', async () => {
    const { peticiones } = renderizarPagina(null)
    await elegirFecha()
    await userEvent.click(await screen.findByRole('button', { name: 'Generar rol' }))

    expect(await screen.findByText('Rol generado')).toBeInTheDocument()
    expect(peticiones.find((p) => p.metodo === 'POST')).toMatchObject({
      ruta: '/roles/generar',
      cuerpo: { fecha: '2026-11-10' },
    })
    expect(tarjeta('Servicios del día')).toHaveTextContent('60')
    expect(tarjeta('Asignados')).toHaveTextContent('58')
    expect(tarjeta('No cubiertos')).toHaveTextContent('2')
    expect(tarjeta('Unidades usadas')).toHaveTextContent('9 de 9')
    expect(tarjeta('Tiempo de generación')).toHaveTextContent('35 ms')

    const fila = (await screen.findByText('S-40')).closest('tr') as HTMLElement
    expect(fila).toHaveTextContent('Aeropuerto CUN → Zona Hotelera')
    expect(fila).toHaveTextContent('32')
    expect(within(fila).getByText('Capacidad')).toBeInTheDocument()
    expect((screen.getByText('S-55').closest('tr') as HTMLElement)).toHaveTextContent('Jornada')
  })

  it('con un rol PROPUESTO avisa y pide confirmar antes de reemplazarlo', async () => {
    const { peticiones } = renderizarPagina(ROL, () => ({ status: 201, cuerpo: { ...GENERADO, reemplazado: true } }))
    await elegirFecha()

    expect(await screen.findByText(/Ya existe un rol PROPUESTO de este día/)).toBeInTheDocument()
    // Muestra los números del rol guardado (el tiempo solo se conoce al generar).
    expect(tarjeta('Asignados')).toHaveTextContent('58')
    expect(tarjeta('Tiempo de generación')).toHaveTextContent('—')

    await userEvent.click(screen.getByRole('button', { name: 'Generar rol' }))
    expect(await screen.findByText('¿Reemplazar el rol PROPUESTO?')).toBeInTheDocument()
    expect(peticiones.some((p) => p.metodo === 'POST')).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: 'Generar de nuevo' }))

    expect(await screen.findByText('Rol reemplazado')).toBeInTheDocument()
  })

  it('con un rol AUTORIZADO no deja generar', async () => {
    renderizarPagina({ ...ROL, estado: 'AUTORIZADO' })
    await elegirFecha()

    expect(await screen.findByText(/ya está AUTORIZADO/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Generar rol' })).toBeDisabled()
  })

  it('muestra el error de la API (por ejemplo, sin servicios)', async () => {
    renderizarPagina(null, () => ({
      status: 400,
      cuerpo: { message: 'No hay servicios PENDIENTE el 2026-12-25', statusCode: 400 },
    }))
    await elegirFecha('2026-12-25')
    await userEvent.click(await screen.findByRole('button', { name: 'Generar rol' }))

    expect(await screen.findByText('No hay servicios PENDIENTE el 2026-12-25')).toBeInTheDocument()
    expect(screen.queryByLabelText('Resumen del rol')).not.toBeInTheDocument()
  })
})
