import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { BotonesFormulario } from '@/components/comunes/BotonesFormulario'
import { Campo } from '@/components/comunes/Campo'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Operador } from '../catalogos/tipos'
import { esquemaOperador, type ValoresOperador } from './esquema'

interface Props {
  inicial: Operador | null
  guardando: boolean
  alGuardar: (valores: ValoresOperador) => void
  alCancelar: () => void
}

export function FormularioOperador({ inicial, guardando, alGuardar, alCancelar }: Props) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ValoresOperador>({
    resolver: zodResolver(esquemaOperador),
    defaultValues: inicial
      ? {
          nombre: inicial.nombre,
          licencia: inicial.licencia,
          telefono: inicial.telefono,
          disponible: inicial.disponible,
        }
      : { disponible: true },
  })

  return (
    <form onSubmit={handleSubmit(alGuardar)} noValidate className="grid gap-5">
      <Campo etiqueta="Nombre" htmlFor="nombre" error={errors.nombre?.message}>
        <Input id="nombre" aria-invalid={!!errors.nombre || undefined} {...register('nombre')} />
      </Campo>

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo etiqueta="Licencia" htmlFor="licencia" error={errors.licencia?.message}>
          <Input id="licencia" aria-invalid={!!errors.licencia || undefined} {...register('licencia')} />
        </Campo>
        <Campo etiqueta="Teléfono" htmlFor="telefono" error={errors.telefono?.message}>
          <Input
            id="telefono"
            type="tel"
            placeholder="998-000-0000"
            aria-invalid={!!errors.telefono || undefined}
            {...register('telefono')}
          />
        </Campo>
      </div>

      <Controller
        control={control}
        name="disponible"
        render={({ field }) => (
          <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
            <Checkbox
              id="disponible"
              checked={field.value}
              onCheckedChange={(v) => field.onChange(v === true)}
              className="mt-0.5"
            />
            <div className="grid gap-1">
              <Label htmlFor="disponible">Disponible para asignación</Label>
              <p className="text-xs text-muted-foreground">Si se desmarca, el motor no le asignará servicios.</p>
            </div>
          </div>
        )}
      />

      <BotonesFormulario guardando={guardando} alCancelar={alCancelar} />
    </form>
  )
}
