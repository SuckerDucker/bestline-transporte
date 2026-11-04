import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { loginSchema, type LoginFormValues } from './loginSchema'

/**
 * Pantalla de inicio de sesión.
 * Por ahora solo valida el formulario; la conexión con la API (JWT) se hará después.
 */
export function LoginPage() {
  const [enviado, setEnviado] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) })

  const onSubmit = () => {
    // Sin conexión a la API todavía: solo confirmamos que la validación pasó.
    setEnviado(true)
  }

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

        <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
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
              {...register('email', { onChange: () => setEnviado(false) })}
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
              {...register('password', { onChange: () => setEnviado(false) })}
            />
            {errors.password && (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-60"
          >
            Iniciar sesión
          </button>

          {enviado && (
            <p className="rounded-md bg-slate-50 px-3 py-2 text-center text-xs text-slate-600">
              Datos válidos. La conexión con la API se agregará en el siguiente paso.
            </p>
          )}
        </form>
      </div>
    </main>
  )
}
