import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { Aviso } from '../../components/Aviso'
import { Campo } from '../../components/Campo'
import { claseEntrada } from '../../components/estilos'
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
  guardando: boolean
  error: string | null
  alGuardar: (valores: ValoresVehiculo) => void
  alCancelar: () => void
}

export function FormularioVehiculo({ inicial, guardando, error, alGuardar, alCancelar }: Props) {
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
      : { estado: 'DISPONIBLE' },
  })
  const tipo = useWatch({ control, name: 'tipo' })

  return (
    <form onSubmit={handleSubmit(alGuardar)} noValidate className="space-y-4">
      <Aviso tipo="error" mensaje={error} />

      <Campo etiqueta="Número económico" htmlFor="numeroEconomico" error={errors.numeroEconomico?.message}>
        <input id="numeroEconomico" className={claseEntrada(!!errors.numeroEconomico)} {...register('numeroEconomico')} />
      </Campo>

      <div className="grid grid-cols-2 gap-4">
        <Campo etiqueta="Tipo" htmlFor="tipo" error={errors.tipo?.message}>
          <select id="tipo" className={claseEntrada(!!errors.tipo)} {...register('tipo')}>
            <option value="">Elige…</option>
            {TIPOS_VEHICULO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Campo>

        <Campo
          etiqueta="Capacidad (pasajeros)"
          htmlFor="capacidad"
          error={errors.capacidad?.message}
          ayuda={tipo && CAPACIDAD_MAXIMA[tipo] ? `Máximo ${CAPACIDAD_MAXIMA[tipo]} para ${tipo}` : undefined}
        >
          <input
            id="capacidad"
            type="number"
            min={1}
            className={claseEntrada(!!errors.capacidad)}
            {...register('capacidad', { valueAsNumber: true })}
          />
        </Campo>
      </div>

      <Campo etiqueta="Encierro base" htmlFor="encierroBase" error={errors.encierroBase?.message}>
        <input id="encierroBase" className={claseEntrada(!!errors.encierroBase)} {...register('encierroBase')} />
      </Campo>

      <Campo etiqueta="Estado" htmlFor="estado" error={errors.estado?.message}>
        <select id="estado" className={claseEntrada(!!errors.estado)} {...register('estado')}>
          {ESTADOS_VEHICULO.map((e) => (
            <option key={e} value={e}>
              {NOMBRE_ESTADO_VEHICULO[e]}
            </option>
          ))}
        </select>
      </Campo>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={alCancelar} className="boton-secundario">
          Cancelar
        </button>
        <button type="submit" disabled={guardando} className="boton-primario">
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
