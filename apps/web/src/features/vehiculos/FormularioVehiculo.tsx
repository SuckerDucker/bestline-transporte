import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { BotonesFormulario } from '@/components/comunes/BotonesFormulario'
import { Campo } from '@/components/comunes/Campo'
import { SelectSimple } from '@/components/comunes/SelectSimple'
import { Input } from '@/components/ui/input'
import {
  CAPACIDAD_MAXIMA,
  ESTADOS_VEHICULO,
  NOMBRE_ESTADO_VEHICULO,
  TIPOS_VEHICULO,
  type TipoVehiculo,
  type Vehiculo,
} from '../catalogos/tipos'
import { esquemaVehiculo, type ValoresVehiculo } from './esquema'

interface Props {
  inicial: Vehiculo | null
  /** Nombres de las zonas del catálogo: el encierro base debe ser una de ellas. */
  zonas: string[]
  guardando: boolean
  alGuardar: (valores: ValoresVehiculo) => void
  alCancelar: () => void
}

const OPCIONES_TIPO = TIPOS_VEHICULO.map((t) => ({ valor: t, etiqueta: `${t} (máx. ${CAPACIDAD_MAXIMA[t]})` }))
const OPCIONES_ESTADO = ESTADOS_VEHICULO.map((e) => ({ valor: e, etiqueta: NOMBRE_ESTADO_VEHICULO[e] }))

export function FormularioVehiculo({ inicial, zonas, guardando, alGuardar, alCancelar }: Props) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ValoresVehiculo>({
    resolver: zodResolver(esquemaVehiculo),
    defaultValues: inicial
      ? {
          numeroEconomico: inicial.numeroEconomico,
          tipo: inicial.tipo as TipoVehiculo,
          capacidad: inicial.capacidad,
          encierroBase: inicial.encierroBase,
          estado: inicial.estado,
        }
      : { estado: 'DISPONIBLE', encierroBase: '' },
  })
  const tipo = useWatch({ control, name: 'tipo' })

  return (
    <form onSubmit={handleSubmit(alGuardar)} noValidate className="grid gap-5">
      <Campo etiqueta="Número económico" htmlFor="numeroEconomico" error={errors.numeroEconomico?.message}>
        <Input
          id="numeroEconomico"
          placeholder="BL-11"
          aria-invalid={!!errors.numeroEconomico || undefined}
          {...register('numeroEconomico')}
        />
      </Campo>

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo etiqueta="Tipo" htmlFor="tipo" error={errors.tipo?.message}>
          <Controller
            control={control}
            name="tipo"
            render={({ field }) => (
              <SelectSimple
                id="tipo"
                valor={field.value ?? ''}
                alCambiar={field.onChange}
                opciones={OPCIONES_TIPO}
                placeholder="Elige el tipo"
                invalido={!!errors.tipo}
              />
            )}
          />
        </Campo>

        <Campo
          etiqueta="Capacidad (pasajeros)"
          htmlFor="capacidad"
          error={errors.capacidad?.message}
          ayuda={tipo ? `Máximo ${CAPACIDAD_MAXIMA[tipo]} para ${tipo}` : undefined}
        >
          <Input
            id="capacidad"
            type="number"
            min={1}
            aria-invalid={!!errors.capacidad || undefined}
            {...register('capacidad', { valueAsNumber: true })}
          />
        </Campo>
      </div>

      <Campo
        etiqueta="Encierro base"
        htmlFor="encierroBase"
        error={errors.encierroBase?.message}
        ayuda="Zona de donde sale la unidad al inicio del día."
      >
        <Controller
          control={control}
          name="encierroBase"
          render={({ field }) => (
            <SelectSimple
              id="encierroBase"
              valor={field.value ?? ''}
              alCambiar={field.onChange}
              opciones={zonas.map((z) => ({ valor: z, etiqueta: z }))}
              placeholder="Elige la zona"
              invalido={!!errors.encierroBase}
            />
          )}
        />
      </Campo>

      <Campo etiqueta="Estado" htmlFor="estado" error={errors.estado?.message}>
        <Controller
          control={control}
          name="estado"
          render={({ field }) => (
            <SelectSimple id="estado" valor={field.value} alCambiar={field.onChange} opciones={OPCIONES_ESTADO} />
          )}
        />
      </Campo>

      <BotonesFormulario guardando={guardando} alCancelar={alCancelar} />
    </form>
  )
}
