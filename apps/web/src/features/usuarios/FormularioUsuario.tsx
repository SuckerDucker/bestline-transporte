import { zodResolver } from '@hookform/resolvers/zod'
import { type Control, Controller, type FieldValues, type Path, useForm } from 'react-hook-form'
import { BotonesFormulario } from '@/components/comunes/BotonesFormulario'
import { Campo } from '@/components/comunes/Campo'
import { SelectSimple } from '@/components/comunes/SelectSimple'
import { Input } from '@/components/ui/input'
import { NOMBRE_ROL, ROLES } from '@/auth/tipos'
import type { UsuarioAdmin } from './api'
import {
  esquemaAltaUsuario,
  esquemaEdicionUsuario,
  type ValoresAltaUsuario,
  type ValoresEdicionUsuario,
} from './esquema'

const OPCIONES_ROL = ROLES.map((r) => ({ valor: r, etiqueta: NOMBRE_ROL[r] }))

interface PropsComunes<T> {
  guardando: boolean
  alGuardar: (valores: T) => void
  alCancelar: () => void
}

/** Alta: nombre, correo, rol y contraseña con confirmación. */
export function FormularioAltaUsuario({ guardando, alGuardar, alCancelar }: PropsComunes<ValoresAltaUsuario>) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ValoresAltaUsuario>({
    resolver: zodResolver(esquemaAltaUsuario),
    defaultValues: { nombre: '', email: '', password: '', confirmacion: '' },
  })

  return (
    <form onSubmit={handleSubmit(alGuardar)} noValidate className="grid gap-5">
      <Campo etiqueta="Nombre" htmlFor="nombre" error={errors.nombre?.message}>
        <Input id="nombre" aria-invalid={!!errors.nombre || undefined} {...register('nombre')} />
      </Campo>
      <Campo etiqueta="Correo" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="off"
          placeholder="nombre@bestline.local"
          aria-invalid={!!errors.email || undefined}
          {...register('email')}
        />
      </Campo>
      <CampoRol control={control} nombre="rol" error={errors.rol?.message} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo etiqueta="Contraseña" htmlFor="password" error={errors.password?.message} ayuda="Mínimo 8 caracteres.">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password || undefined}
            {...register('password')}
          />
        </Campo>
        <Campo etiqueta="Confirmar contraseña" htmlFor="confirmacion" error={errors.confirmacion?.message}>
          <Input
            id="confirmacion"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmacion || undefined}
            {...register('confirmacion')}
          />
        </Campo>
      </div>
      <BotonesFormulario guardando={guardando} alCancelar={alCancelar} />
    </form>
  )
}

interface PropsEdicion extends PropsComunes<ValoresEdicionUsuario> {
  inicial: UsuarioAdmin
  /** Es el propio administrador: no puede cambiarse el rol (igual que en la API). */
  esUnoMismo: boolean
}

/** Edición: solo nombre y rol. El correo identifica al usuario y no se cambia. */
export function FormularioEdicionUsuario({ inicial, esUnoMismo, guardando, alGuardar, alCancelar }: PropsEdicion) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ValoresEdicionUsuario>({
    resolver: zodResolver(esquemaEdicionUsuario),
    defaultValues: { nombre: inicial.nombre, rol: inicial.rol },
  })

  return (
    <form onSubmit={handleSubmit(alGuardar)} noValidate className="grid gap-5">
      <Campo etiqueta="Nombre" htmlFor="nombre" error={errors.nombre?.message}>
        <Input id="nombre" aria-invalid={!!errors.nombre || undefined} {...register('nombre')} />
      </Campo>
      <Campo etiqueta="Correo" htmlFor="email" ayuda="El correo no se puede cambiar.">
        <Input id="email" value={inicial.email} disabled readOnly />
      </Campo>
      <CampoRol
        control={control}
        nombre="rol"
        error={errors.rol?.message}
        deshabilitado={esUnoMismo}
        ayuda={esUnoMismo ? 'No puedes cambiar tu propio rol.' : undefined}
      />
      <BotonesFormulario guardando={guardando} alCancelar={alCancelar} />
    </form>
  )
}

/** Lista de roles conectada al formulario. */
function CampoRol<T extends FieldValues>({
  control,
  nombre,
  error,
  deshabilitado,
  ayuda,
}: {
  control: Control<T>
  nombre: Path<T>
  error?: string
  deshabilitado?: boolean
  ayuda?: string
}) {
  return (
    <Campo etiqueta="Rol" htmlFor="rol" error={error} ayuda={ayuda}>
      <Controller
        control={control}
        name={nombre}
        render={({ field }) => (
          <SelectSimple
            id="rol"
            valor={(field.value as string | undefined) ?? ''}
            alCambiar={field.onChange}
            opciones={OPCIONES_ROL}
            placeholder="Elige el rol"
            invalido={!!error}
            deshabilitado={deshabilitado}
          />
        )}
      />
    </Campo>
  )
}
