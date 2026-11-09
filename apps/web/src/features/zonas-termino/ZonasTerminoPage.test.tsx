import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toaster } from 'sonner'
import { describe, expect, it } from 'vitest'
import { pagina, simularApi } from '@/pruebas/api-simulada'
import { renderizar, usuarioDePrueba } from '@/pruebas/renderizar'
import { ZonasTerminoPage } from './ZonasTerminoPage'

const ZONAS = [
  { id: 1, nombre: 'Aeropuerto CUN', latitud: 21.04, longitud: -86.87, esZonaTermino: true },
  { id: 7, nombre: 'Tulum', latitud: 20.21, longitud: -87.46, esZonaTermino: false },
]

describe('Zonas de término', () => {
  it('muestra el 400 de la API al quitar la última zona de término', async () => {
    const { peticiones } = simularApi(({ metodo }) =>
      metodo === 'PATCH'
        ? { status: 400, cuerpo: { message: 'Debe existir al menos una zona de término', statusCode: 400 } }
        : { cuerpo: pagina(ZONAS) },
    )
    renderizar(
      <>
        <ZonasTerminoPage />
        <Toaster />
      </>,
      { usuario: usuarioDePrueba('ADMINISTRADOR') },
    )

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Aeropuerto CUN' }))

    expect(await screen.findByText('Debe existir al menos una zona de término')).toBeInTheDocument()
    expect(screen.getByText('No se pudo cambiar la zona')).toBeInTheDocument()
    expect(peticiones.find((p) => p.metodo === 'PATCH')).toMatchObject({
      ruta: '/zonas/1/zona-termino',
      cuerpo: { esZonaTermino: false },
    })
    // La casilla sigue marcada: la zona no cambió.
    expect(screen.getByRole('checkbox', { name: 'Aeropuerto CUN' })).toBeChecked()
  })

  it('el COORDINADOR ve las casillas deshabilitadas', async () => {
    simularApi(() => ({ cuerpo: pagina(ZONAS) }))
    renderizar(<ZonasTerminoPage />, { usuario: usuarioDePrueba('COORDINADOR') })

    expect(await screen.findByRole('checkbox', { name: 'Tulum' })).toBeDisabled()
    expect(screen.getByText(/Solo consulta/)).toBeInTheDocument()
  })
})
