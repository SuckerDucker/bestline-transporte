import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Aviso } from '../../components/Aviso'
import { Campo } from '../../components/Campo'
import { claseEntrada } from '../../components/estilos'
import type { Zona } from '../catalogos/tipos'
import { esquemaZona, type ValoresZona } from './esquema'

interface Props {
  inicial: Zona | null
  guardando: boolean
  error: string | null
  alGuardar: (valores: ValoresZona) => void
  alCancelar: () => void
}

export function FormularioZona({ inicial, guardando, error, alGuardar, alCancelar }: Props) {
  const {
    register,
    handleSubmit,
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
    <form onSubmit={handleSubmit(alGuardar)} noValidate className="space-y-4">
      <Aviso tipo="error" mensaje={error} />

      <Campo etiqueta="Nombre" htmlFor="nombre" error={errors.nombre?.message}>
        <input id="nombre" className={claseEntrada(!!errors.nombre)} {...register('nombre')} />
      </Campo>

      <div className="grid grid-cols-2 gap-4">
        <Campo etiqueta="Latitud" htmlFor="latitud" error={errors.latitud?.message}>
          <input
            id="latitud"
            type="number"
            step="any"
            className={claseEntrada(!!errors.latitud)}
            {...register('latitud', { valueAsNumber: true })}
          />
        </Campo>
        <Campo etiqueta="Longitud" htmlFor="longitud" error={errors.longitud?.message}>
          <input
            id="longitud"
            type="number"
            step="any"
            className={claseEntrada(!!errors.longitud)}
            {...register('longitud', { valueAsNumber: true })}
          />
        </Campo>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register('esZonaTermino')} />
        Zona de término (una unidad puede terminar aquí su jornada)
      </label>

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
