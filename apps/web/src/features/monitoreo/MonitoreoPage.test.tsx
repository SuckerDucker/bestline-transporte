import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { describe, expect, it } from 'vitest'
import type { Rol } from '@/auth/tipos'
import { esperarPeticion, type Peticion, simularApi } from '@/pruebas/api-simulada'
import { renderizar, usuarioDePrueba } from '@/pruebas/renderizar'
import type { EstadoServicio } from '../servicios/tipos'
import type { FilaMonitoreo, Incidencia, Tablero } from './api'
import { MiRolPage } from './MiRolPage'
import { MonitoreoPage } from './MonitoreoPage'
import { siguientes } from './transiciones'

const FECHA = '2026-11-10'

function fila(id: number, hora: string, estado: EstadoServicio, unidad: number, retrasado = false): FilaMonitoreo {
  return {
    asignacionId: 100 + id,
    orden: 1,
    inicioEfectivo: `${FECHA}T${hora}:00.000Z`,
    liberacion: `${FECHA}T${hora}:00.000Z`,
    vehiculo: { id: unidad, numeroEconomico: `BL-0${unidad}`, tipo: 'Van' },
    operador: { id: unidad, nombre: `Operador ${unidad}` },
    servicio: {
      id,
      folio: `NEX-${id}`,
      localizador: `LOC-${id}`,
      tipo: 'LLEGADA',
      modalidad: 'PRIVADO',
      fechaHora: `${FECHA}T${hora}:00.000Z`,
      pasajeros: 4,
      vuelo: 'EJ100',
      estado,
      zonaOrigen: { id: 1, nombre: 'Aeropuerto CUN' },
      zonaDestino: { id: 2, nombre: 'Zona Hotelera' },
      hotel: { id: 1, nombre: 'Hyatt Ziva Cancun' },
      inicioReal: null,
      terminoReal: null,
    },
    incidencias: id === 2 ? 1 : 0,
    retrasado,
  }
}

const SERVICIOS = [
  fila(1, '15:00', 'PROGRAMADO', 1, true),
  fila(2, '16:00', 'EN_RUTA', 1),
  fila(3, '17:00', 'COMPLETADO', 2),
]
const TABLERO: Tablero = {
  fecha: FECHA,
  rol: { id: 16, estado: 'AUTORIZADO', autorizadoEn: '2026-11-09T22:00:00.000Z' },
  totales: {
    total: 3,
    retrasados: 1,
    porEstado: { PROGRAMADO: 1, EN_RUTA: 1, EN_SERVICIO: 0, COMPLETADO: 1, CANCELADO: 0, NO_SHOW: 0 },
  },
  servicios: SERVICIOS,
}
const INCIDENCIAS: Incidencia[] = [
  {
    id: 7,
    tipo: 'RETRASO',
    descripcion: 'Vuelo demorado',
    fecha: `${FECHA}T21:00:00.000Z`,
    usuario: { id: 5, nombre: 'Jorge Ramírez' },
    servicio: { id: 2, folio: 'NEX-2' },
    vehiculo: { id: 1, numeroEconomico: 'BL-01' },
  },
]

/** API simulada: tablero, incidencias y respuestas a los cambios. */
function api(sobre: (p: Peticion) => { status?: number; cuerpo: unknown } | undefined = () => undefined) {
  return simularApi((p) => {
    const propia = sobre(p)
    if (propia) return propia
    if (p.ruta === `/monitoreo/${FECHA}/incidencias`) return { cuerpo: INCIDENCIAS }
    if (p.ruta === `/monitoreo/${FECHA}`) return { cuerpo: TABLERO }
    return { cuerpo: {} }
  })
}

function renderizarMonitoreo(rol: Rol = 'SUPERVISOR') {
  return renderizar(
    <>
      <Routes>
        <Route path="/monitoreo/:fecha" element={<MonitoreoPage />} />
      </Routes>
      <Toaster />
    </>,
    { usuario: usuarioDePrueba(rol), ruta: `/monitoreo/${FECHA}` },
  )
}

describe('Monitoreo', () => {
  it('muestra totales por estado, la tabla con badges, el retrasado resaltado y las incidencias', async () => {
    api()
    renderizarMonitoreo()

    const tabla = await screen.findByRole('table', { name: 'Servicios del día' })
    const totales = screen.getByLabelText('Totales por estado')
    expect(within(totales).getByRole('button', { name: /Retrasados\s*1/ })).toBeInTheDocument()
    expect(within(totales).getByRole('button', { name: /Programado\s*1/ })).toBeInTheDocument()

    const filas = within(tabla).getAllByRole('row').slice(1)
    expect(filas).toHaveLength(3)
    expect(filas[0]).toHaveAttribute('data-retrasado', 'true')
    expect(within(filas[0]).getByText('Retrasado')).toBeInTheDocument()
    expect(within(filas[1]).getByText('En ruta')).toBeInTheDocument()
    expect(within(filas[1]).getByText('1 incidencia')).toBeInTheDocument()
    expect(within(filas[2]).getByText('Completado')).toBeInTheDocument()

    const incidencias = await screen.findByRole('list', { name: 'Incidencias del día' })
    expect(incidencias).toHaveTextContent('Retraso · NEX-2')
    expect(incidencias).toHaveTextContent('Registró Jorge Ramírez')
  })

  it('filtra por estado (también desde la tarjeta) y por unidad', async () => {
    api()
    renderizarMonitoreo()
    const tabla = await screen.findByRole('table', { name: 'Servicios del día' })

    await userEvent.click(screen.getByRole('button', { name: /Retrasados\s*1/ }))
    expect(within(tabla).getAllByRole('row')).toHaveLength(2)
    expect(within(tabla).getByText('NEX-1')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('combobox', { name: 'Filtrar por estado' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Todos los estados' }))
    await userEvent.click(screen.getByRole('combobox', { name: 'Filtrar por unidad' }))
    await userEvent.click(await screen.findByRole('option', { name: 'BL-02 · Van' }))
    expect(within(tabla).getAllByRole('row')).toHaveLength(2)
    expect(within(tabla).getByText('NEX-3')).toBeInTheDocument()
  })

  it('el menú solo ofrece las transiciones válidas y "Iniciar" manda PATCH con EN_RUTA', async () => {
    const { peticiones } = api((p) => (p.metodo === 'PATCH' ? { cuerpo: { id: 1 } } : undefined))
    renderizarMonitoreo()

    await userEvent.click(await screen.findByRole('button', { name: 'Acciones de NEX-1' }))
    const opciones = (await screen.findAllByRole('menuitem')).map((o) => o.textContent)
    expect(opciones).toEqual(['Iniciar', 'Cancelar servicio', 'Marcar no show', 'Registrar incidencia'])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Iniciar' }))

    await esperarPeticion(
      peticiones,
      (p) => p.metodo === 'PATCH' && p.ruta === '/monitoreo/servicios/1/estado' && (p.cuerpo as { estado: string }).estado === 'EN_RUTA',
    )
  })

  it('CANCELADO pide confirmación antes de enviar; un servicio COMPLETADO solo permite incidencia', async () => {
    const { peticiones } = api((p) => (p.metodo === 'PATCH' ? { cuerpo: { id: 2 } } : undefined))
    renderizarMonitoreo()

    await userEvent.click(await screen.findByRole('button', { name: 'Acciones de NEX-3' }))
    expect((await screen.findAllByRole('menuitem')).map((o) => o.textContent)).toEqual(['Registrar incidencia'])
    await userEvent.keyboard('{Escape}')

    await userEvent.click(screen.getByRole('button', { name: 'Acciones de NEX-2' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Cancelar servicio' }))
    const dialogo = await screen.findByRole('alertdialog')
    expect(peticiones.some((p) => p.metodo === 'PATCH')).toBe(false)
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar servicio' }))
    await esperarPeticion(peticiones, (p) => p.metodo === 'PATCH' && (p.cuerpo as { estado: string }).estado === 'CANCELADO')
  })

  it('muestra el error de la API al cambiar el estado (400 transición inválida)', async () => {
    api((p) =>
      p.metodo === 'PATCH'
        ? { status: 400, cuerpo: { message: 'No se puede pasar de COMPLETADO a EN_RUTA', statusCode: 400 } }
        : undefined,
    )
    renderizarMonitoreo()
    await userEvent.click(await screen.findByRole('button', { name: 'Acciones de NEX-1' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Iniciar' }))
    expect(await screen.findByText('No se puede pasar de COMPLETADO a EN_RUTA')).toBeInTheDocument()
  })

  it('el diálogo de incidencia valida con Zod y envía tipo y descripción', async () => {
    const { peticiones } = api((p) => (p.metodo === 'POST' ? { status: 201, cuerpo: { id: 9 } } : undefined))
    renderizarMonitoreo()

    await userEvent.click(await screen.findByRole('button', { name: 'Acciones de NEX-2' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Registrar incidencia' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Registrar incidencia' })

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    expect(await within(dialogo).findByText('Elige el tipo de incidencia')).toBeInTheDocument()
    expect(within(dialogo).getByText('Describe lo que pasó')).toBeInTheDocument()

    await userEvent.click(within(dialogo).getByRole('combobox', { name: 'Tipo' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Falla mecánica' }))
    await userEvent.type(within(dialogo).getByLabelText('Descripción'), 'Se calentó el motor')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    await esperarPeticion(
      peticiones,
      (p) =>
        p.metodo === 'POST' &&
        p.ruta === '/monitoreo/servicios/2/incidencias' &&
        JSON.stringify(p.cuerpo) === JSON.stringify({ tipo: 'FALLA_MECANICA', descripcion: 'Se calentó el motor' }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('sin rol autorizado (404) muestra el aviso', async () => {
    simularApi(() => ({ status: 404, cuerpo: { message: 'No hay rol autorizado del 2026-11-10', statusCode: 404 } }))
    renderizarMonitoreo()
    expect(
      await screen.findByText('No hay rol autorizado de este día. El monitoreo empieza cuando se autoriza el rol.'),
    ).toBeInTheDocument()
  })
})

describe('Mi rol (OPERADOR)', () => {
  const MIS = {
    fecha: FECHA,
    operador: { id: 1, nombre: 'José Hernández', horaCita: '04:00' },
    vehiculo: { id: 1, numeroEconomico: 'BL-01', tipo: 'Van' },
    totales: { ...TABLERO.totales, total: 3 },
    servicios: [fila(1, '10:00', 'PROGRAMADO', 1), fila(2, '11:00', 'EN_RUTA', 1), fila(4, '12:00', 'EN_SERVICIO', 1)],
  }
  const renderizarMiRol = () =>
    renderizar(
      <Routes>
        <Route path="/mi-rol/:fecha" element={<MiRolPage />} />
      </Routes>,
      { usuario: usuarioDePrueba('OPERADOR'), ruta: `/mi-rol/${FECHA}` },
    )

  it('muestra sus servicios en orden con "Iniciar", "Pasajeros a bordo" y "Completar"', async () => {
    const { peticiones } = simularApi((p) => (p.metodo === 'PATCH' ? { cuerpo: { id: 1 } } : { cuerpo: MIS }))
    renderizarMiRol()

    const lista = await screen.findByRole('list', { name: 'Mis servicios' })
    const tarjetas = within(lista).getAllByRole('listitem')
    expect(tarjetas.map((t) => within(t).getByRole('button').textContent)).toEqual([
      'Iniciar',
      'Pasajeros a bordo',
      'Completar',
    ])
    expect(screen.getByText('José Hernández')).toBeInTheDocument()
    expect(screen.getByText('1 de 3 servicios terminados')).toBeInTheDocument()

    await userEvent.click(within(tarjetas[1]).getByRole('button', { name: 'Pasajeros a bordo' }))
    await esperarPeticion(
      peticiones,
      (p) => p.ruta === '/monitoreo/servicios/2/estado' && (p.cuerpo as { estado: string }).estado === 'EN_SERVICIO',
    )
  })

  it('muestra el aviso de la API si su usuario no está ligado a un operador', async () => {
    simularApi(() => ({ status: 404, cuerpo: { message: 'Tu usuario no está ligado a un operador', statusCode: 404 } }))
    renderizarMiRol()
    expect(await screen.findByText('Tu usuario no está ligado a un operador')).toBeInTheDocument()
  })
})

describe('siguientes', () => {
  it('al OPERADOR solo le da el siguiente paso del flujo normal', () => {
    expect(siguientes('PROGRAMADO', 'OPERADOR')).toEqual(['EN_RUTA'])
    expect(siguientes('PROGRAMADO', 'COORDINADOR')).toEqual(['EN_RUTA', 'CANCELADO', 'NO_SHOW'])
    expect(siguientes('COMPLETADO', 'ADMINISTRADOR')).toEqual([])
  })
})
