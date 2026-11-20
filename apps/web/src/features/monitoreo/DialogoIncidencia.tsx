import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { BotonesFormulario } from '@/components/comunes/BotonesFormulario'
import { Campo } from '@/components/comunes/Campo'
import { DialogoFormulario } from '@/components/comunes/DialogoFormulario'
import { SelectSimple } from '@/components/comunes/SelectSimple'
import { cn } from '@/lib/utils'
import { NOMBRE_INCIDENCIA, TIPOS_INCIDENCIA } from './api'
import { esquemaIncidencia, type ValoresIncidencia } from './esquema'

interface Props {
  /** Servicio al que se le registra la incidencia (null = cerrado). */
  folio: string | null
  guardando: boolean
  alGuardar: (valores: ValoresIncidencia) => void
  alCerrar: () => void
}

const OPCIONES = TIPOS_INCIDENCIA.map((t) => ({ valor: t, etiqueta: NOMBRE_INCIDENCIA[t] }))

export function DialogoIncidencia({ folio, guardando, alGuardar, alCerrar }: Props) {
  return (
    <DialogoFormulario
      titulo="Registrar incidencia"
      descripcion={`Servicio ${folio ?? ''}. El servicio conserva su estado; la incidencia queda en el historial del día.`}
      abierto={folio !== null}
      alCerrar={alCerrar}
    >
      {/* key: el formulario empieza vacío con cada servicio. */}
      {folio && <Formulario key={folio} guardando={guardando} alGuardar={alGuardar} alCancelar={alCerrar} />}
    </DialogoFormulario>
  )
}

function Formulario({
  guardando,
  alGuardar,
  alCancelar,
}: {
  guardando: boolean
  alGuardar: (valores: ValoresIncidencia) => void
  alCancelar: () => void
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ValoresIncidencia>({
    resolver: zodResolver(esquemaIncidencia),
    defaultValues: { descripcion: '' },
  })

  return (
    <form onSubmit={handleSubmit(alGuardar)} noValidate className="grid gap-5">
      <Campo etiqueta="Tipo" htmlFor="tipo-incidencia" error={errors.tipo?.message}>
        <Controller
          control={control}
          name="tipo"
          render={({ field }) => (
            <SelectSimple
              id="tipo-incidencia"
              ariaLabel="Tipo"
              valor={field.value ?? ''}
              alCambiar={field.onChange}
              opciones={OPCIONES}
              placeholder="Elige el tipo"
              invalido={!!errors.tipo}
            />
          )}
        />
      </Campo>
      <Campo etiqueta="Descripción" htmlFor="descripcion-incidencia" error={errors.descripcion?.message}>
        <textarea
          id="descripcion-incidencia"
          rows={4}
          aria-invalid={!!errors.descripcion || undefined}
          className={cn(
            'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none',
            'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
            'aria-invalid:border-destructive',
          )}
          placeholder="Ej. Vuelo demorado 40 minutos; la unidad espera en CUN"
          {...register('descripcion')}
        />
      </Campo>
      <BotonesFormulario guardando={guardando} alCancelar={alCancelar} />
    </form>
  )
}
