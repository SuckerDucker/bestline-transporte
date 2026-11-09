import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Rol } from '@/auth/tipos'
import { renderizar } from '@/pruebas/renderizar'
import { menuAgrupado, opcionesPara, tituloDe } from './menu'
import { Navegacion } from './Navegacion'

const etiquetas = (rol: Rol) => opcionesPara(rol).map((o) => o.etiqueta)

describe('Menú según el rol', () => {
  it('el ADMINISTRADOR ve todo: catálogos, configuración y administración', () => {
    expect(etiquetas('ADMINISTRADOR')).toEqual([
      'Inicio',
      'Vehículos',
      'Operadores',
      'Zonas',
      'Hoteles',
      'Parámetros',
      'Zonas de término',
      'Matriz de tiempos',
      'Usuarios',
      'Bitácora',
    ])
    expect(menuAgrupado('ADMINISTRADOR').map((g) => g.grupo)).toEqual([
      null,
      'Catálogos',
      'Configuración',
      'Administración',
    ])
  })

  it.each(['COORDINADOR', 'SUPERVISOR'] as const)('%s ve catálogos y configuración, pero no administración', (rol) => {
    expect(etiquetas(rol)).not.toContain('Usuarios')
    expect(etiquetas(rol)).not.toContain('Bitácora')
    expect(etiquetas(rol)).toContain('Parámetros')
    expect(menuAgrupado(rol).map((g) => g.grupo)).toEqual([null, 'Catálogos', 'Configuración'])
  })

  it('el OPERADOR solo ve Inicio', () => {
    expect(etiquetas('OPERADOR')).toEqual(['Inicio'])
  })

  it('el título de la pantalla sale de la ruta', () => {
    expect(tituloDe('/matriz-tiempos')).toBe('Matriz de tiempos de traslado')
    expect(tituloDe('/no-existe')).toBe('Best Line · Operaciones')
  })
})

describe('Navegacion (menú lateral)', () => {
  it('muestra los grupos y enlaces del ADMINISTRADOR', () => {
    renderizar(<Navegacion rol="ADMINISTRADOR" />)

    const administracion = screen.getByRole('group', { name: 'Administración' })
    expect(within(administracion).getByRole('link', { name: 'Usuarios' })).toHaveAttribute('href', '/usuarios')
    expect(within(administracion).getByRole('link', { name: 'Bitácora' })).toHaveAttribute('href', '/bitacora')
    expect(screen.getByRole('group', { name: 'Configuración' })).toBeInTheDocument()
  })

  it('al COORDINADOR no le muestra el grupo Administración', () => {
    renderizar(<Navegacion rol="COORDINADOR" />)

    expect(screen.queryByRole('group', { name: 'Administración' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Matriz de tiempos' })).toBeInTheDocument()
  })

  it('al OPERADOR solo le muestra Inicio, sin grupos', () => {
    renderizar(<Navegacion rol="OPERADOR" />)

    expect(screen.getAllByRole('link').map((l) => l.textContent)).toEqual(['Inicio'])
    expect(screen.queryByText('Catálogos')).not.toBeInTheDocument()
  })

  it('marca como activa la opción de la ruta actual', () => {
    renderizar(<Navegacion rol="ADMINISTRADOR" />, { ruta: '/parametros' })

    expect(screen.getByRole('link', { name: 'Parámetros' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current')
  })
})
