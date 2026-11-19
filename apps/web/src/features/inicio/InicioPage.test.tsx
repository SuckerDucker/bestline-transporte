import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { simularApi } from '@/pruebas/api-simulada'
import { renderizar, usuarioDePrueba } from '@/pruebas/renderizar'
import { InicioPage } from './InicioPage'

const RESUMEN = {
  vehiculos: { activos: 10, disponibles: 10, enMantenimiento: 0 },
  operadores: { disponibles: 10, total: 10 },
  zonas: { total: 8, deTermino: 2 },
  hoteles: { total: 16 },
  servicios: { fecha: '2026-11-10', pendientes: 60, total: 60 },
}

describe('Pantalla de inicio', () => {
  it('la tarjeta de servicios pendientes enlaza a la pantalla de servicios', async () => {
    simularApi(() => ({ cuerpo: RESUMEN }))
    renderizar(<InicioPage />, { usuario: usuarioDePrueba('COORDINADOR') })

    const enlace = await screen.findByRole('link', { name: 'Ver servicios' })
    expect(enlace).toHaveAttribute('href', '/servicios')
    expect(screen.queryByText(/próxima fase/)).not.toBeInTheDocument()
  })

  it('al OPERADOR no le muestra enlaces a pantallas que no puede abrir', async () => {
    simularApi(() => ({ cuerpo: RESUMEN }))
    renderizar(<InicioPage />, { usuario: usuarioDePrueba('OPERADOR') })

    expect(await screen.findByText('Servicios pendientes')).toBeInTheDocument()
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.queryByText(/próxima fase/)).not.toBeInTheDocument()
  })
})
