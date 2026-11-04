import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Aviso } from '../../components/Aviso'
import { Campo } from '../../components/Campo'
import { claseEntrada } from '../../components/estilos'
import type { Operador } from '../catalogos/tipos'
import { esquemaOperador, type ValoresOperador } from './esquema'

interface Props {
  inicial: Operador | null
  guardando: boolean
  error: string | null
  alGuardar: (valores: ValoresOperador) => void
  alCancelar: () => void
}

export function FormularioOperador({ inicial, guardando, error, alGuardar, alCancelar }: Props) {
  const {
    register,
    handleSubmit,
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
    <form onSubmit={handleSubmit(alGuardar)} noValidate className="space-y-4">
      <Aviso tipo="error" mensaje={error} />

      <Campo etiqueta="Nombre" htmlFor="nombre" error={errors.nombre?.message}>
        <input id="nombre" className={claseEntrada(!!errors.nombre)} {...register('nombre')} />
      </Campo>

      <div className="grid grid-cols-2 gap-4">
        <Campo etiqueta="Licencia" htmlFor="licencia" error={errors.licencia?.message}>
          <input id="licencia" className={claseEntrada(!!errors.licencia)} {...register('licencia')} />
        </Campo>
        <Campo etiqueta="Teléfono" htmlFor="telefono" error={errors.telefono?.message}>
          <input
            id="telefono"
            type="tel"
            className={claseEntrada(!!errors.telefono)}
            {...register('telefono')}
          />
        </Campo>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register('disponible')} />
        Disponible para asignación
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
