import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { BotonesFormulario } from '@/components/comunes/BotonesFormulario'
import { Campo } from '@/components/comunes/Campo'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Zona } from '../catalogos/tipos'
import { esquemaZona, type ValoresZona } from './esquema'

interface Props {
  inicial: Zona | null
  guardando: boolean
  alGuardar: (valores: ValoresZona) => void
  alCancelar: () => void
}

export function FormularioZona({ inicial, guardando, alGuardar, alCancelar }: Props) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ValoresZona>({
    resolver: zodResolver(esquemaZona),
    defaultValues: inicial
      ? {
          nombre: inicial.nombre,
          latitud: inicial.latitud,
          longitud: inicial.longitud,
          esZonaTermino: inicial.esZonaTermino,
        }
      : { esZonaTermino: false },
  })

  return (
    <form onSubmit={handleSubmit(alGuardar)} noValidate className="grid gap-5">
      <Campo etiqueta="Nombre" htmlFor="nombre" error={errors.nombre?.message}>
        <Input id="nombre" aria-invalid={!!errors.nombre || undefined} {...register('nombre')} />
      </Campo>

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo etiqueta="Latitud" htmlFor="latitud" error={errors.latitud?.message}>
          <Input
            id="latitud"
            type="number"
            step="any"
            placeholder="21.1619"
            aria-invalid={!!errors.latitud || undefined}
            {...register('latitud', { valueAsNumber: true })}
          />
        </Campo>
        <Campo etiqueta="Longitud" htmlFor="longitud" error={errors.longitud?.message}>
          <Input
            id="longitud"
            type="number"
            step="any"
            placeholder="-86.8515"
            aria-invalid={!!errors.longitud || undefined}
            {...register('longitud', { valueAsNumber: true })}
          />
        </Campo>
      </div>

      <Controller
        control={control}
        name="esZonaTermino"
        render={({ field }) => (
          <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
            <Checkbox
              id="esZonaTermino"
              checked={field.value}
              onCheckedChange={(v) => field.onChange(v === true)}
              className="mt-0.5"
            />
            <div className="grid gap-1">
              <Label htmlFor="esZonaTermino">Zona de término</Label>
              <p className="text-xs text-muted-foreground">Una unidad puede terminar aquí su último servicio del día.</p>
            </div>
          </div>
        )}
      />

      <BotonesFormulario guardando={guardando} alCancelar={alCancelar} />
    </form>
  )
}
