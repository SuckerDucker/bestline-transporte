import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { BotonesFormulario } from '@/components/comunes/BotonesFormulario'
import { Campo } from '@/components/comunes/Campo'
import { Input } from '@/components/ui/input'
import { esquemaPassword, type ValoresPassword } from './esquema'

interface Props {
  guardando: boolean
  alGuardar: (valores: ValoresPassword) => void
  alCancelar: () => void
}

/** Nueva contraseña con confirmación (el administrador no necesita la anterior). */
export function FormularioPassword({ guardando, alGuardar, alCancelar }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ValoresPassword>({
    resolver: zodResolver(esquemaPassword),
    defaultValues: { password: '', confirmacion: '' },
  })

  return (
    <form onSubmit={handleSubmit(alGuardar)} noValidate className="grid gap-5">
      <Campo etiqueta="Nueva contraseña" htmlFor="password" error={errors.password?.message} ayuda="Mínimo 8 caracteres.">
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
      <BotonesFormulario guardando={guardando} alCancelar={alCancelar} />
    </form>
  )
}
