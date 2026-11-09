import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { BotonesFormulario } from '@/components/comunes/BotonesFormulario'
import { Campo } from '@/components/comunes/Campo'
import { SelectSimple } from '@/components/comunes/SelectSimple'
import { Input } from '@/components/ui/input'
import type { Hotel, Zona } from '../catalogos/tipos'
import { esquemaHotel, type ValoresHotel } from './esquema'

interface Props {
  inicial: Hotel | null
  zonas: Zona[]
  guardando: boolean
  alGuardar: (valores: ValoresHotel) => void
  alCancelar: () => void
}

export function FormularioHotel({ inicial, zonas, guardando, alGuardar, alCancelar }: Props) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ValoresHotel>({
    resolver: zodResolver(esquemaHotel),
    defaultValues: inicial
      ? {
          nombre: inicial.nombre,
          zonaId: inicial.zonaId,
          latitud: inicial.latitud,
          longitud: inicial.longitud,
        }
      : undefined,
  })
  const opcionesZona = zonas.map((z) => ({ valor: String(z.id), etiqueta: z.nombre }))

  return (
    <form onSubmit={handleSubmit(alGuardar)} noValidate className="grid gap-5">
      <Campo etiqueta="Nombre" htmlFor="nombre" error={errors.nombre?.message}>
        <Input id="nombre" aria-invalid={!!errors.nombre || undefined} {...register('nombre')} />
      </Campo>

      <Campo etiqueta="Zona" htmlFor="zonaId" error={errors.zonaId?.message}>
        <Controller
          control={control}
          name="zonaId"
          render={({ field }) => (
            <SelectSimple
              id="zonaId"
              // El Select trabaja con texto; el formulario guarda el id como número.
              valor={field.value ? String(field.value) : ''}
              alCambiar={(v) => field.onChange(Number(v))}
              opciones={opcionesZona}
              placeholder="Elige la zona"
              invalido={!!errors.zonaId}
            />
          )}
        />
      </Campo>

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo etiqueta="Latitud" htmlFor="latitud" error={errors.latitud?.message}>
          <Input
            id="latitud"
            type="number"
            step="any"
            aria-invalid={!!errors.latitud || undefined}
            {...register('latitud', { valueAsNumber: true })}
          />
        </Campo>
        <Campo etiqueta="Longitud" htmlFor="longitud" error={errors.longitud?.message}>
          <Input
            id="longitud"
            type="number"
            step="any"
            aria-invalid={!!errors.longitud || undefined}
            {...register('longitud', { valueAsNumber: true })}
          />
        </Campo>
      </div>

      <BotonesFormulario guardando={guardando} alCancelar={alCancelar} />
    </form>
  )
}
