import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderizar } from '@/pruebas/renderizar'
import { LoginPage } from './LoginPage'
import { loginSchema } from './loginSchema'

describe('loginSchema', () => {
  it('pide correo y contraseña', () => {
    const resultado = loginSchema.safeParse({ email: '', password: '' })
    expect(resultado.success).toBe(false)
    // El formulario muestra el primer mensaje de cada campo.
    const primero = (campo: string) => resultado.error?.issues.find((i) => i.path[0] === campo)?.message
    expect(primero('email')).toBe('Ingresa tu correo')
    expect(primero('password')).toBe('Ingresa tu contraseña')
  })

  it('quita espacios del correo y acepta datos válidos', () => {
    const resultado = loginSchema.safeParse({ email: '  admin@bestline.local ', password: 'x' })
    expect(resultado.data?.email).toBe('admin@bestline.local')
  })
})

describe('Formulario de inicio de sesión', () => {
  const fetchSimulado = vi.fn<typeof fetch>()
  afterEach(() => {
    vi.unstubAllGlobals()
    fetchSimulado.mockReset()
  })

  it('muestra los errores de validación y no llama a la API', async () => {
    vi.stubGlobal('fetch', fetchSimulado)
    renderizar(<LoginPage />, { ruta: '/login' })

    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect(await screen.findByText('Ingresa tu correo')).toBeInTheDocument()
    expect(screen.getByText('Ingresa tu contraseña')).toBeInTheDocument()
    expect(screen.getByLabelText('Correo')).toHaveAttribute('aria-invalid', 'true')
    expect(fetchSimulado).not.toHaveBeenCalled()
  })

  it('rechaza un correo mal escrito', async () => {
    vi.stubGlobal('fetch', fetchSimulado)
    renderizar(<LoginPage />, { ruta: '/login' })

    await userEvent.type(screen.getByLabelText('Correo'), 'admin@')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'secreta')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect(await screen.findByText('Ingresa un correo válido')).toBeInTheDocument()
    expect(fetchSimulado).not.toHaveBeenCalled()
  })

  it('con datos válidos llama a POST /auth/login y muestra el 401', async () => {
    fetchSimulado.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Correo o contraseña incorrectos', statusCode: 401 }), { status: 401 }),
    )
    vi.stubGlobal('fetch', fetchSimulado)
    const { sesion } = renderizar(<LoginPage />, { ruta: '/login' })

    await userEvent.type(screen.getByLabelText('Correo'), 'admin@bestline.local')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'incorrecta')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect(await screen.findByText('Correo o contraseña incorrectos')).toBeInTheDocument()
    const [url, opciones] = fetchSimulado.mock.calls[0]
    expect(String(url)).toMatch(/\/auth\/login$/)
    expect(opciones?.method).toBe('POST')
    expect(JSON.parse(String(opciones?.body))).toEqual({ email: 'admin@bestline.local', password: 'incorrecta' })
    expect(sesion.iniciarSesion).not.toHaveBeenCalled()
  })
})
