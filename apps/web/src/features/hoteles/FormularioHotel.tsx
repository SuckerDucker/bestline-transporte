import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Aviso } from '../../components/Aviso'
import { Campo } from '../../components/Campo'
import { claseEntrada } from '../../components/estilos'
import type { Hotel, Zona } from '../catalogos/tipos'
import { esquemaHotel, type ValoresHotel } from './esquema'

interface Props {
  inicial: Hotel | null
  zonas: Zona[]
  guardando: boolean
  error: string | null
  alGuardar: (valores: ValoresHotel) => void
  alCancelar: () => void
}

export function FormularioHotel({ inicial, zonas, guardando, error, alGuardar, alCancelar }: Props) {
  const {
    register,
    handleSubmit,
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

  return (
    <form onSubmit={handleSubmit(alGuardar)} noValidate className="space-y-4">
      <Aviso tipo="error" mensaje={error} />

      <Campo etiqueta="Nombre" htmlFor="nombre" error={errors.nombre?.message}>
        <input id="nombre" className={claseEntrada(!!errors.nombre)} {...register('nombre')} />
      </Campo>

      <Campo etiqueta="Zona" htmlFor="zonaId" error={errors.zonaId?.message}>
        <select id="zonaId" className={claseEntrada(!!errors.zonaId)} {...register('zonaId', { valueAsNumber: true })}>
          <option value="">Elige…</option>
          {zonas.map((z) => (
            <option key={z.id} value={z.id}>
              {z.nombre}
            </option>
          ))}
        </select>
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
