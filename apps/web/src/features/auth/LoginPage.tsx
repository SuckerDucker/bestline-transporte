import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ErrorApi, pedir } from '../../api/cliente'
import { useAuth } from '../../auth/contexto'
import type { RespuestaLogin } from '../../auth/tipos'
import { loginSchema, type LoginFormValues } from './loginSchema'

/** Pantalla de inicio de sesión conectada a POST /api/auth/login. */
export function LoginPage() {
  const { usuario, iniciarSesion } = useAuth()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  // Si se llegó aquí desde una ruta protegida, se regresa a ella al entrar.
  const destino = (ubicacion.state as { desde?: string } | null)?.desde ?? '/'

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) })

  const login = useMutation({
    mutationFn: (valores: LoginFormValues) =>
      pedir<RespuestaLogin>('/auth/login', { metodo: 'POST', cuerpo: valores }),
    onSuccess: (respuesta) => {
      iniciarSesion(respuesta)
      navegar(destino, { replace: true })
    },
  })

  if (usuario) return <Navigate to={destino} replace />

  // 401 = credenciales incorrectas (mensaje de la API); otro error = problema técnico.
  const mensajeError =
    login.error instanceof ErrorApi
      ? login.error.status === 401
        ? 'Correo o contraseña incorrectos'
        : login.error.message
      : null

  const claseCampo = (conError: boolean) =>
    `mt-1 block w-full rounded-md border px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 ${
      conError
        ? 'border-red-500 focus:ring-red-200'
        : 'border-slate-300 focus:border-slate-500 focus:ring-slate-200'
    }`

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-center text-2xl font-semibold text-slate-800">
          Best Line · Operaciones
        </h1>
        <p className="mt-1 text-center text-sm text-slate-500">Inicia sesión para continuar</p>

        <form
          className="mt-8 space-y-5"
          onSubmit={handleSubmit((valores) => login.mutate(valores))}
          noValidate
        >
          {mensajeError && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {mensajeError}
            </p>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Correo
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={errors.email ? 'true' : 'false'}
              className={claseCampo(Boolean(errors.email))}
              {...register('email', { onChange: () => login.reset() })}
            />
            {errors.email && (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={errors.password ? 'true' : 'false'}
              className={claseCampo(Boolean(errors.password))}
              {...register('password', { onChange: () => login.reset() })}
            />
            {errors.password && (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={login.isPending}
            className="w-full rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-60"
          >
            {login.isPending ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </main>
  )
}
