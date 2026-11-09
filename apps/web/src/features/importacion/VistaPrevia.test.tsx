import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { EstadoFila, FilaVistaPrevia, VistaPrevia as Vista } from './api'
import { VistaPrevia } from './VistaPrevia'

const fila = (numero: number, estado: EstadoFila, mensajes: string[] = []): FilaVistaPrevia => ({
  fila: numero,
  estado,
  mensajes,
  valores: {
    Folio: `NX-${numero}`,
    Localizador: `LOC-${numero}`,
    Fecha: '05/11/2026',
    Hora: '06:15',
    'Tipo de Servicio': 'SALIDA',
    Pasajeros: '2',
    Hotel: 'TRS Coral Hotel',
    Zona: estado === 'ERROR' ? '—' : 'Costa Mujeres',
  },
  servicio:
    estado === 'VALIDA' || estado === 'ADVERTENCIA'
      ? {
          tipo: 'SALIDA',
          modalidad: 'COMPARTIDO',
          fechaHora: '2026-11-05T11:15:00.000Z',
          zonaOrigen: 'Costa Mujeres',
          zonaDestino: 'Aeropuerto CUN',
        }
      : null,
})

const VISTA: Vista = {
  archivo: 'Layout_Servicios_Nexus.xlsx',
  mayorista: { id: 2, nombre: 'Nexus Tours' },
  totales: { total: 6, validas: 2, advertencias: 1, duplicadas: 1, errores: 2, importables: 3, rechazadas: 3 },
  avisos: ['1 fila(s) traen la agencia "TUI", distinta del mayorista elegido (Nexus Tours)'],
  filas: [
    fila(5, 'VALIDA'),
    fila(6, 'ADVERTENCIA', ['Modalidad no indicada; se asumió COMPARTIDO']),
    fila(7, 'VALIDA'),
    fila(8, 'ERROR', ['Zona no indicada']),
    fila(9, 'DUPLICADA', ['Folio y localizador repetidos en el archivo (fila 5)']),
    fila(10, 'ERROR', ['Pasajeros debe ser un número entero mayor que 0']),
  ],
}

/** Filas de datos visibles en la tabla (sin el encabezado). */
const filasVisibles = () => screen.getAllByRole('row').slice(1)
const contador = (nombre: RegExp) => within(screen.getByRole('group', { name: 'Contadores por estado' })).getByRole('button', { name: nombre })

describe('Vista previa de la importación', () => {
  it('muestra los contadores de cada estado y el aviso del archivo', () => {
    render(<VistaPrevia vista={VISTA} />)

    expect(contador(/Total/)).toHaveTextContent('6')
    expect(contador(/Válidas/)).toHaveTextContent('2')
    expect(contador(/Advertencias/)).toHaveTextContent('1')
    expect(contador(/Duplicadas/)).toHaveTextContent('1')
    expect(contador(/Errores/)).toHaveTextContent('2')
    expect(screen.getByText(/traen la agencia "TUI"/)).toBeInTheDocument()
    expect(filasVisibles()).toHaveLength(6)
    expect(screen.getByText('6 filas en el archivo')).toBeInTheDocument()
  })

  it('muestra el estado y los mensajes de cada fila, y la ruta de las importables', () => {
    render(<VistaPrevia vista={VISTA} />)

    const conError = filasVisibles().find((r) => r.textContent?.includes('NX-8'))
    expect(conError).toHaveTextContent('Error')
    expect(conError).toHaveTextContent('Zona no indicada')
    const valida = filasVisibles().find((r) => r.textContent?.includes('NX-5'))
    expect(valida).toHaveTextContent('Costa Mujeres → Aeropuerto CUN')
  })

  it('al pulsar un contador filtra por ese estado; al pulsarlo otra vez quita el filtro', async () => {
    render(<VistaPrevia vista={VISTA} />)

    await userEvent.click(contador(/Errores/))
    expect(contador(/Errores/)).toHaveAttribute('aria-pressed', 'true')
    expect(filasVisibles().map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual(['8', '10'])
    expect(screen.getByText('Mostrando 2 de 6 filas')).toBeInTheDocument()

    await userEvent.click(contador(/Errores/))
    expect(filasVisibles()).toHaveLength(6)
    expect(contador(/Total/)).toHaveAttribute('aria-pressed', 'true')
  })

  it('el selector de estado filtra igual que los contadores', async () => {
    render(<VistaPrevia vista={VISTA} />)

    await userEvent.click(screen.getByRole('combobox', { name: 'Filtrar por estado' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Duplicadas' }))

    expect(filasVisibles()).toHaveLength(1)
    expect(filasVisibles()[0]).toHaveTextContent('Folio y localizador repetidos en el archivo (fila 5)')
    expect(contador(/Duplicadas/)).toHaveAttribute('aria-pressed', 'true')
  })

  it('si un filtro no tiene filas, muestra el estado vacío', async () => {
    render(<VistaPrevia vista={{ ...VISTA, filas: VISTA.filas.filter((f) => f.estado !== 'DUPLICADA') }} />)

    await userEvent.click(contador(/Duplicadas/))
    expect(screen.getByText('No hay filas con ese estado.')).toBeInTheDocument()
  })
})
