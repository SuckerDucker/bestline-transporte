import { zodResolver } from '@hookform/resolvers/zod'
import { Clock, Hourglass, Loader2, Timer, Undo2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { type FieldError, useForm } from 'react-hook-form'
import { ErrorApi } from '@/api/cliente'
import { Campo } from '@/components/comunes/Campo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  aLista,
  aValores,
  type ClaveParametro,
  CLAVES,
  esquemaParametros,
  type Parametro,
  type ValoresParametros,
} from './esquema'

interface Props {
  parametros: Parametro[]
  /** COORDINADOR y SUPERVISOR: ven los valores sin poder cambiarlos. */
  soloLectura: boolean
  /** Envía los cambios; si la API responde 400 con errores por clave, se muestran en su campo. */
  alGuardar: (cambios: { clave: string; valor: string }[]) => Promise<unknown>
}

const ETIQUETAS: Record<ClaveParametro, string> = {
  'hora_cita.turno_1': 'Turno 1',
  'hora_cita.turno_2': 'Turno 2',
  jornada_maxima_horas: 'Jornada máxima',
  'anticipacion.PRIVADO': 'Privado',
  'anticipacion.COMPARTIDO': 'Compartido',
  'anticipacion.GRUPO': 'Grupo',
}

/** Formulario de los parámetros de operación (CU-08), validado con Zod. */
export function FormularioParametros({ parametros, soloLectura, alGuardar }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ValoresParametros>({
    resolver: zodResolver(esquemaParametros),
    defaultValues: aValores(parametros),
  })

  const enviar = async (valores: ValoresParametros) => {
    try {
      await alGuardar(aLista(valores, parametros))
      reset(valores)
    } catch (error) {
      // 400 de la API: { errores: [{ clave, mensaje }] } → error en cada campo.
      const errores = (error instanceof ErrorApi ? (error.datos as { errores?: unknown })?.errores : null) ?? []
      for (const e of errores as { clave: string; mensaje: string }[]) {
        if ((CLAVES as readonly string[]).includes(e.clave)) {
          setError(e.clave as ClaveParametro, { message: `El valor ${e.mensaje}` })
        }
      }
    }
  }

  /** Error de un campo a partir de su clave ("hora_cita.turno_1"). */
  const errorDe = (clave: ClaveParametro) =>
    (clave.split('.').reduce<unknown>((nodo, parte) => (nodo as Record<string, unknown> | undefined)?.[parte], errors) as
      | FieldError
      | undefined)?.message
  const descripcion = (clave: ClaveParametro) => parametros.find((p) => p.clave === clave)?.descripcion

  const campo = (clave: ClaveParametro, unidad: string, placeholder: string, inputMode: 'numeric' | 'decimal') => (
    <Campo etiqueta={ETIQUETAS[clave]} htmlFor={clave} error={errorDe(clave)} ayuda={descripcion(clave)}>
      <div className="relative">
        <Input
          id={clave}
          inputMode={inputMode}
          placeholder={placeholder}
          readOnly={soloLectura}
          aria-invalid={!!errorDe(clave) || undefined}
          className="pr-16 tabular-nums read-only:bg-muted/50"
          {...register(clave)}
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
          {unidad}
        </span>
      </div>
    </Campo>
  )

  return (
    <form onSubmit={handleSubmit(enviar)} noValidate className="grid gap-5">
      <div className="grid gap-5 xl:grid-cols-3">
        <Seccion icono={Clock} titulo="Horas de cita" descripcion="Hora en que el operador se presenta, por turno.">
          {campo('hora_cita.turno_1', 'HH:mm', '04:00', 'numeric')}
          {campo('hora_cita.turno_2', 'HH:mm', '05:00', 'numeric')}
        </Seccion>
        <Seccion icono={Hourglass} titulo="Jornada" descripcion="Tiempo máximo de trabajo desde la hora de cita.">
          {campo('jornada_maxima_horas', 'horas', '9.5', 'decimal')}
        </Seccion>
        <Seccion icono={Timer} titulo="Anticipación por modalidad" descripcion="Minutos antes de la hora del servicio.">
          {campo('anticipacion.PRIVADO', 'min', '10', 'numeric')}
          {campo('anticipacion.COMPARTIDO', 'min', '20', 'numeric')}
          {campo('anticipacion.GRUPO', 'min', '30', 'numeric')}
        </Seccion>
      </div>

      {!soloLectura && (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={!isDirty || isSubmitting} onClick={() => reset()}>
            <Undo2 />
            Descartar cambios
          </Button>
          <Button type="submit" disabled={!isDirty || isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      )}
    </form>
  )
}

function Seccion({
  icono: Icono,
  titulo,
  descripcion,
  children,
}: {
  icono: LucideIcon
  titulo: string
  descripcion: string
  children: ReactNode
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icono className="size-4" />
          </span>
          {titulo}
        </CardTitle>
        <CardDescription>{descripcion}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">{children}</CardContent>
    </Card>
  )
}
