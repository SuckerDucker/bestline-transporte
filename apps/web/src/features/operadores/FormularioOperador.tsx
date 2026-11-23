import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { BotonesFormulario } from '@/components/comunes/BotonesFormulario'
import { Campo } from '@/components/comunes/Campo'
import { SelectSimple } from '@/components/comunes/SelectSimple'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Operador, Vehiculo } from '../catalogos/tipos'
import type { UsuarioAdmin } from '../usuarios/api'
import { esquemaOperador, SIN_USUARIO, SIN_VEHICULO, type ValoresOperador } from './esquema'

interface Props {
  inicial: Operador | null
  /** Vehículos que se pueden asignar (la página los carga). */
  vehiculos: Pick<Vehiculo, 'id' | 'numeroEconomico' | 'tipo'>[]
  /** Cuentas con rol OPERADOR que se pueden vincular (la página las carga). */
  usuarios: Pick<UsuarioAdmin, 'id' | 'nombre' | 'email' | 'activo'>[]
  guardando: boolean
  alGuardar: (valores: ValoresOperador) => void
  alCancelar: () => void
}

export function FormularioOperador({ inicial, vehiculos, usuarios, guardando, alGuardar, alCancelar }: Props) {
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
          vehiculo: inicial.vehiculoId ? String(inicial.vehiculoId) : SIN_VEHICULO,
          usuario: inicial.usuarioId ? String(inicial.usuarioId) : SIN_USUARIO,
          horaCita: inicial.horaCita ?? '',
        }
      : { disponible: true, vehiculo: SIN_VEHICULO, usuario: SIN_USUARIO, horaCita: '' },
  })
  const opcionesVehiculo = [
    { valor: SIN_VEHICULO, etiqueta: 'Sin unidad (no participa en el rol)' },
    ...vehiculos.map((v) => ({ valor: String(v.id), etiqueta: `${v.numeroEconomico} · ${v.tipo}` })),
  ]
  const opcionesUsuario = [
    { valor: SIN_USUARIO, etiqueta: 'Sin cuenta vinculada' },
    ...usuarios.map((u) => ({
      valor: String(u.id),
      etiqueta: `${u.nombre} · ${u.email}${u.activo ? '' : ' (inactivo)'}`,
    })),
  ]

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

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo etiqueta="Unidad" htmlFor="vehiculo" ayuda="Un vehículo solo puede tener un operador.">
          <Controller
            control={control}
            name="vehiculo"
            render={({ field }) => (
              <SelectSimple id="vehiculo" valor={field.value} alCambiar={field.onChange} opciones={opcionesVehiculo} />
            )}
          />
        </Campo>
        <Campo
          etiqueta="Hora de cita"
          htmlFor="horaCita"
          error={errors.horaCita?.message}
          ayuda="HH:mm dentro del bloque matutino o vespertino (Parámetros). Vacía = no participa en el rol."
        >
          <Input
            id="horaCita"
            inputMode="numeric"
            placeholder="04:00"
            aria-invalid={!!errors.horaCita || undefined}
            {...register('horaCita')}
          />
        </Campo>
      </div>

      <Campo
        etiqueta="Usuario vinculado"
        htmlFor="usuario"
        ayuda='Cuenta con rol Operador con la que entra a "Mi rol". Se crea en Usuarios.'
      >
        <Controller
          control={control}
          name="usuario"
          render={({ field }) => (
            <SelectSimple id="usuario" valor={field.value} alCambiar={field.onChange} opciones={opcionesUsuario} />
          )}
        />
      </Campo>

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
