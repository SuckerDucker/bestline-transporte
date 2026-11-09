import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { CircleAlert, ClipboardList, Loader2, Route, Upload } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ErrorApi, pedir } from '@/api/cliente'
import { useAuth } from '@/auth/contexto'
import type { RespuestaLogin } from '@/auth/tipos'
import { Campo } from '@/components/comunes/Campo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Marca } from '@/layout/Marca'
import { loginSchema, type LoginFormValues } from './loginSchema'

// Lo que hace el sistema (según el alcance del proyecto), para el panel lateral.
const FUNCIONES = [
  { icono: Upload, texto: 'Importación de los servicios de los mayoristas (CSV o Excel).' },
  { icono: Route, texto: 'Propuesta de unidad y operador para cada servicio, sin empalmes.' },
  { icono: ClipboardList, texto: 'Seguimiento de cada servicio por estados e incidencias.' },
]

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

  return (
    <main className="grid min-h-svh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Panel con el nombre del sistema (en móvil se oculta) */}
      <section className="relative hidden overflow-hidden bg-sidebar text-sidebar-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Decoración sutil con el color de acento */}
        <div className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-sidebar-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 size-96 rounded-full bg-sky-400/10 blur-3xl" />

        <Marca className="relative" />

        <div className="relative max-w-md space-y-8">
          <div className="space-y-4">
            <h2 className="text-3xl leading-tight font-semibold tracking-tight">
              Asignación asistida y monitoreo de servicios de transporte turístico
            </h2>
            <p className="text-sm leading-relaxed text-sidebar-foreground/70">
              Sistema interno del área de Operaciones para planear el rol diario de unidades y operadores y dar
              seguimiento a cada servicio.
            </p>
          </div>
          <ul className="space-y-4">
            {FUNCIONES.map(({ icono: Icono, texto }) => (
              <li key={texto} className="flex items-start gap-3 text-sm text-sidebar-foreground/85">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-primary">
                  <Icono className="size-4" />
                </span>
                <span className="pt-1.5">{texto}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-sidebar-foreground/40">Best Line Travel Agency · Cancún, Quintana Roo</p>
      </section>

      {/* Formulario */}
      <section className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <Marca className="mb-10 text-foreground lg:hidden" />

          <div className="mb-8 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Inicia sesión</h1>
            <p className="text-sm text-muted-foreground">Ingresa con tu correo y contraseña de Best Line.</p>
          </div>

          <form className="grid gap-5" onSubmit={handleSubmit((valores) => login.mutate(valores))} noValidate>
            {mensajeError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-sm text-destructive"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                {mensajeError}
              </div>
            )}

            <Campo etiqueta="Correo" htmlFor="email" error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="nombre@bestline.local"
                className="h-10"
                aria-invalid={!!errors.email || undefined}
                {...register('email', { onChange: () => login.reset() })}
              />
            </Campo>

            <Campo etiqueta="Contraseña" htmlFor="password" error={errors.password?.message}>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                className="h-10"
                aria-invalid={!!errors.password || undefined}
                {...register('password', { onChange: () => login.reset() })}
              />
            </Campo>

            <Button type="submit" size="lg" className="mt-2 h-10 w-full" disabled={login.isPending}>
              {login.isPending && <Loader2 className="animate-spin" />}
              {login.isPending ? 'Iniciando sesión…' : 'Iniciar sesión'}
            </Button>
          </form>
        </div>
      </section>
    </main>
  )
}
