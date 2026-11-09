import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { esperarPeticion, pagina, simularApi } from '@/pruebas/api-simulada'
import { renderizar, usuarioDePrueba } from '@/pruebas/renderizar'
import type { Vehiculo } from '../catalogos/tipos'
import { VehiculosPage } from './VehiculosPage'

const VEHICULOS: Vehiculo[] = [
  { id: 1, numeroEconomico: 'BL-01', tipo: 'Sprinter', capacidad: 20, estado: 'DISPONIBLE', encierroBase: 'Encierro Cancún' },
  { id: 2, numeroEconomico: 'BL-02', tipo: 'Van', capacidad: 14, estado: 'MANTENIMIENTO', encierroBase: 'Encierro Playa' },
]
const admin = { usuario: usuarioDePrueba('ADMINISTRADOR') }

describe('Pantalla de vehículos', () => {
  it('muestra el esqueleto mientras carga y después las filas', async () => {
    let responder: (valor: { cuerpo: unknown }) => void = () => {}
    simularApi(() => new Promise((resolver) => (responder = resolver)))
    const { container } = renderizar(<VehiculosPage />, admin)

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
    responder({ cuerpo: pagina(VEHICULOS) })

    expect(await screen.findByText('BL-01')).toBeInTheDocument()
    expect(screen.getByText('Mantenimiento')).toBeInTheDocument()
    expect(screen.getByText((_, el) => el?.tagName === 'P' && /Mostrando 1.2 de 2/.test(el.textContent ?? ''))).toBeInTheDocument()
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull()
  })

  it('muestra el estado vacío', async () => {
    simularApi(() => ({ cuerpo: pagina([]) }))
    renderizar(<VehiculosPage />, admin)

    expect(await screen.findByText('No hay vehículos con esos filtros.')).toBeInTheDocument()
  })

  it('muestra el error de la API en la tabla', async () => {
    simularApi(() => ({ status: 500, cuerpo: { message: 'Error interno', statusCode: 500 } }))
    renderizar(<VehiculosPage />, admin)

    expect(await screen.findByText('Error interno')).toBeInTheDocument()
  })

  it('envía la búsqueda y el filtro por tipo a la API (sin mandar "todos")', async () => {
    const { peticiones } = simularApi(() => ({ cuerpo: pagina(VEHICULOS) }))
    renderizar(<VehiculosPage />, admin)
    await screen.findByText('BL-01')
    expect(peticiones[0].query.has('tipo')).toBe(false)
    expect(peticiones[0].query.get('pagina')).toBe('1')

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar vehículos' }), 'BL-0')
    await esperarPeticion(peticiones, (p) => p.query.get('buscar') === 'BL-0')

    await userEvent.click(screen.getByRole('combobox', { name: 'Filtrar por tipo' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Sprinter' }))
    await esperarPeticion(peticiones, (p) => p.query.get('tipo') === 'Sprinter' && p.query.get('buscar') === 'BL-0')
  })

  it('el ADMINISTRADOR ve "Nuevo vehículo" y las acciones de cada fila', async () => {
    simularApi(() => ({ cuerpo: pagina(VEHICULOS) }))
    renderizar(<VehiculosPage />, admin)

    await screen.findByText('BL-01')
    expect(screen.getByRole('button', { name: 'Nuevo vehículo' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Acciones' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Acciones de BL-01' }))
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: 'Editar' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Desactivar' })).toBeInTheDocument()
  })

  it.each(['COORDINADOR', 'SUPERVISOR'] as const)('el %s solo consulta: sin alta ni acciones', async (rol) => {
    simularApi(() => ({ cuerpo: pagina(VEHICULOS) }))
    renderizar(<VehiculosPage />, { usuario: usuarioDePrueba(rol) })

    await screen.findByText('BL-01')
    expect(screen.getByText(/Solo consulta/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuevo vehículo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Acciones' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Acciones de/ })).not.toBeInTheDocument()
  })
})

