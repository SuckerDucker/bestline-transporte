import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { RutaProtegida } from '@/auth/RutaProtegida'
import type { Rol } from '@/auth/tipos'
import { ROLES_ADMINISTRACION } from '@/layout/menu'
import { esperarPeticion, pagina, simularApi } from '@/pruebas/api-simulada'
import { renderizar, usuarioDePrueba } from '@/pruebas/renderizar'
import type { UsuarioAdmin } from './api'
import { UsuariosPage } from './UsuariosPage'

const USUARIOS: UsuarioAdmin[] = [
  // id 1 = el usuario de la sesión de prueba (usuarioDePrueba)
  { id: 1, nombre: 'Administrador', email: 'admin@bestline.local', rol: 'ADMINISTRADOR', activo: true },
  { id: 5, nombre: 'Supervisor Ejemplo', email: 'supervisor@bestline.local', rol: 'SUPERVISOR', activo: false },
]

/** La pantalla dentro de la misma ruta protegida que usa App.tsx. */
function renderizarRuta(rol: Rol) {
  return renderizar(
    <Routes>
      <Route element={<RutaProtegida roles={ROLES_ADMINISTRACION} />}>
        <Route path="/usuarios" element={<UsuariosPage />} />
      </Route>
    </Routes>,
    { usuario: usuarioDePrueba(rol), ruta: '/usuarios' },
  )
}

describe('Pantalla de usuarios', () => {
  it('muestra el esqueleto mientras carga y después los usuarios con su rol y estado', async () => {
    let responder: (valor: { cuerpo: unknown }) => void = () => {}
    simularApi(() => new Promise((resolver) => (responder = resolver)))
    const { container } = renderizarRuta('ADMINISTRADOR')

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
    responder({ cuerpo: pagina(USUARIOS) })

    expect(await screen.findByText('supervisor@bestline.local')).toBeInTheDocument()
    expect(screen.getByText('(tú)')).toBeInTheDocument()
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
    // Nunca se muestra nada de la contraseña.
    expect(container.textContent).not.toMatch(/password/i)
  })

  it('muestra el estado vacío', async () => {
    simularApi(() => ({ cuerpo: pagina([]) }))
    renderizarRuta('ADMINISTRADOR')

    expect(await screen.findByText('No hay usuarios con esos filtros.')).toBeInTheDocument()
  })

  it('envía los filtros de rol y estado a la API', async () => {
    const { peticiones } = simularApi(() => ({ cuerpo: pagina(USUARIOS) }))
    renderizarRuta('ADMINISTRADOR')
    await screen.findByText('supervisor@bestline.local')

    await userEvent.click(screen.getByRole('combobox', { name: 'Filtrar por rol' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Supervisor' }))
    await userEvent.click(screen.getByRole('combobox', { name: 'Filtrar por estado' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Inactivos' }))

    await esperarPeticion(
      peticiones,
      (p) => p.ruta === '/usuarios' && p.query.get('rol') === 'SUPERVISOR' && p.query.get('activo') === 'false',
    )
  })

  it('el ADMINISTRADOR ve "Nuevo usuario" y las acciones; no puede desactivarse a sí mismo', async () => {
    simularApi(() => ({ cuerpo: pagina(USUARIOS) }))
    renderizarRuta('ADMINISTRADOR')
    await screen.findByText('supervisor@bestline.local')

    expect(screen.getByRole('button', { name: 'Nuevo usuario' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Acciones de Administrador' }))
    let menu = await screen.findByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: 'Editar' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Cambiar contraseña' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Desactivar' })).toHaveAttribute('data-disabled')
    await userEvent.keyboard('{Escape}')

    // Un usuario inactivo ofrece "Reactivar".
    await userEvent.click(screen.getByRole('button', { name: 'Acciones de Supervisor Ejemplo' }))
    menu = await screen.findByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: 'Reactivar' })).not.toHaveAttribute('data-disabled')
  })

  it.each(['COORDINADOR', 'SUPERVISOR', 'OPERADOR'] as const)(
    'el %s no ve la pantalla ni sus botones (acceso denegado)',
    async (rol) => {
      const { peticiones } = simularApi(() => ({ cuerpo: pagina(USUARIOS) }))
      renderizarRuta(rol)

      expect(await screen.findByText('Acceso denegado')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Nuevo usuario' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Acciones de/ })).not.toBeInTheDocument()
      expect(peticiones).toHaveLength(0)
    },
  )
})
