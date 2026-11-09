import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Operador } from '../catalogos/tipos'
import { aDatosOperador, SIN_VEHICULO } from './esquema'
import { FormularioOperador } from './FormularioOperador'

const VEHICULOS = [
  { id: 3, numeroEconomico: 'BL-03', tipo: 'Van' },
  { id: 9, numeroEconomico: 'BL-09', tipo: 'Autobús' },
]
const OPERADOR: Operador = {
  id: 1,
  nombre: 'Operador Ejemplo 01',
  licencia: 'LIC-01',
  telefono: '998-000-0001',
  disponible: true,
  vehiculoId: 3,
  horaCita: '04:15',
  vehiculo: { id: 3, numeroEconomico: 'BL-03', tipo: 'Van', capacidad: 14, estado: 'DISPONIBLE' },
}
const renderizarFormulario = (inicial: Operador | null, alGuardar = vi.fn()) => {
  render(
    <FormularioOperador
      inicial={inicial}
      vehiculos={VEHICULOS}
      guardando={false}
      alGuardar={alGuardar}
      alCancelar={vi.fn()}
    />,
  )
  return alGuardar
}

describe('aDatosOperador', () => {
  it('convierte la unidad y la hora de cita al cuerpo de la API', () => {
    const base = { nombre: 'A', licencia: 'L', telefono: '998-000-0000', disponible: true }
    expect(aDatosOperador({ ...base, vehiculo: '9', horaCita: '04:30' })).toEqual({
      ...base,
      vehiculoId: 9,
      horaCita: '04:30',
    })
    // Sin unidad y sin hora: null (la API usa hora_cita.turno_1).
    expect(aDatosOperador({ ...base, vehiculo: SIN_VEHICULO, horaCita: '' })).toEqual({
      ...base,
      vehiculoId: null,
      horaCita: null,
    })
  })
})

describe('Formulario de operador', () => {
  it('muestra la unidad y la hora de cita del operador al editar', () => {
    renderizarFormulario(OPERADOR)
    expect(screen.getByRole('combobox', { name: 'Unidad' })).toHaveTextContent('BL-03 · Van')
    expect(screen.getByLabelText('Hora de cita')).toHaveValue('04:15')
  })

  it('cambia la unidad y deja la hora vacía (turno 1)', async () => {
    const alGuardar = renderizarFormulario(OPERADOR)

    await userEvent.click(screen.getByRole('combobox', { name: 'Unidad' }))
    await userEvent.click(await screen.findByRole('option', { name: 'BL-09 · Autobús' }))
    await userEvent.clear(screen.getByLabelText('Hora de cita'))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await vi.waitFor(() => expect(alGuardar).toHaveBeenCalled())
    expect(alGuardar.mock.calls[0][0]).toMatchObject({ vehiculo: '9', horaCita: '' })
  })

  it('rechaza una hora de cita mal escrita', async () => {
    const alGuardar = renderizarFormulario(OPERADOR)

    await userEvent.clear(screen.getByLabelText('Hora de cita'))
    await userEvent.type(screen.getByLabelText('Hora de cita'), '4:15')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Usa el formato HH:mm de 24 horas o déjala vacía')).toBeInTheDocument()
    expect(alGuardar).not.toHaveBeenCalled()
  })

  it('un alta empieza sin unidad', () => {
    renderizarFormulario(null)
    expect(screen.getByRole('combobox', { name: 'Unidad' })).toHaveTextContent('Sin unidad (no participa en el rol)')
  })
})
