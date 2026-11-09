import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Vehiculo } from '../catalogos/tipos'
import { esquemaVehiculo } from './esquema'
import { FormularioVehiculo } from './FormularioVehiculo'

const ZONAS = ['Centro Cancún', 'Zona Hotelera']
const base = { numeroEconomico: 'BL-11', encierroBase: 'Centro Cancún', estado: 'DISPONIBLE' as const }

describe('Regla de capacidad por tipo (esquemaVehiculo)', () => {
  it.each([
    ['Van', 14],
    ['Urvan', 14],
    ['Sprinter', 20],
    ['Autobús', 45],
  ] as const)('%s admite hasta %i pasajeros', (tipo, maxima) => {
    expect(esquemaVehiculo.safeParse({ ...base, tipo, capacidad: maxima }).success).toBe(true)
    const excedido = esquemaVehiculo.safeParse({ ...base, tipo, capacidad: maxima + 1 })
    expect(excedido.error?.issues[0]).toMatchObject({
      path: ['capacidad'],
      message: `Un vehículo ${tipo} admite máximo ${maxima} pasajeros`,
    })
  })

  it('la capacidad debe ser un entero mayor que 0', () => {
    expect(esquemaVehiculo.safeParse({ ...base, tipo: 'Van', capacidad: 0 }).success).toBe(false)
    expect(esquemaVehiculo.safeParse({ ...base, tipo: 'Van', capacidad: 2.5 }).success).toBe(false)
  })
})

describe('Formulario de vehículo', () => {
  const van: Vehiculo = {
    id: 3,
    numeroEconomico: 'BL-03',
    tipo: 'Van',
    capacidad: 14,
    estado: 'DISPONIBLE',
    encierroBase: 'Centro Cancún',
  }

  it('muestra el error de capacidad bajo el campo y no guarda', async () => {
    const alGuardar = vi.fn()
    render(<FormularioVehiculo inicial={van} zonas={ZONAS} guardando={false} alGuardar={alGuardar} alCancelar={vi.fn()} />)

    const capacidad = screen.getByLabelText(/Capacidad/)
    await userEvent.clear(capacidad)
    await userEvent.type(capacidad, '20')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Un vehículo Van admite máximo 14 pasajeros')).toBeInTheDocument()
    expect(capacidad).toHaveAttribute('aria-invalid', 'true')
    expect(alGuardar).not.toHaveBeenCalled()
  })

  it('al cambiar el tipo a Sprinter, 20 pasajeros sí es válido', async () => {
    const alGuardar = vi.fn()
    render(<FormularioVehiculo inicial={van} zonas={ZONAS} guardando={false} alGuardar={alGuardar} alCancelar={vi.fn()} />)

    await userEvent.click(screen.getByRole('combobox', { name: 'Tipo' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Sprinter (máx. 20)' }))
    const capacidad = screen.getByLabelText(/Capacidad/)
    await userEvent.clear(capacidad)
    await userEvent.type(capacidad, '20')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await vi.waitFor(() => expect(alGuardar).toHaveBeenCalled())
    expect(alGuardar.mock.calls[0][0]).toMatchObject({ tipo: 'Sprinter', capacidad: 20 })
  })
  it('en un alta pide elegir el encierro entre las zonas del catálogo', async () => {
    const alGuardar = vi.fn()
    render(<FormularioVehiculo inicial={null} zonas={ZONAS} guardando={false} alGuardar={alGuardar} alCancelar={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Número económico'), 'BL-20')
    await userEvent.click(screen.getByRole('combobox', { name: 'Tipo' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Van (máx. 14)' }))
    await userEvent.type(screen.getByLabelText(/Capacidad/), '10')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Elige el encierro base')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('combobox', { name: 'Encierro base' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Zona Hotelera' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await vi.waitFor(() => expect(alGuardar).toHaveBeenCalled())
    expect(alGuardar.mock.calls[0][0]).toMatchObject({ encierroBase: 'Zona Hotelera' })
  })
})
