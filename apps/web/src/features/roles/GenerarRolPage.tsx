import { CalendarCheck, CalendarRange, CircleAlert, Info, Loader2, Play } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ErrorApi } from '@/api/cliente'
import { Campo } from '@/components/comunes/Campo'
import { Confirmacion } from '@/components/comunes/Confirmacion'
import { TablaDatos, type Columna } from '@/components/comunes/TablaDatos'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { diaCancun, diaYHoraCancun, horaCancun, mananaCancun } from '@/lib/fechas'
import { cn } from '@/lib/utils'
import { EstadoBadge } from '../catalogos/EstadoBadge'
import { NOMBRE_MODALIDAD, NOMBRE_TIPO } from '../servicios/tipos'
import {
  MOTIVO,
  MOTIVOS,
  type NoCubierto,
  type RolGenerado,
  useGenerarRol,
  useNoCubiertos,
  useRol,
} from './api'

const COLUMNAS: Columna<NoCubierto>[] = [
  {
    encabezado: 'Hora',
    celda: (n) => (
      <div className="flex flex-col">
        <span className="font-semibold text-foreground tabular-nums">{horaCancun(n.servicio.fechaHora)}</span>
        <span className="text-xs whitespace-nowrap text-muted-foreground">{diaCancun(n.servicio.fechaHora)}</span>
      </div>
    ),
  },
  {
    encabezado: 'Folio',
    celda: (n) => (
      <div className="flex flex-col">
        <span className="font-medium">{n.servicio.folio}</span>
        <span className="text-xs text-muted-foreground">
          {NOMBRE_TIPO[n.servicio.tipo] ?? n.servicio.tipo} · {NOMBRE_MODALIDAD[n.servicio.modalidad] ?? n.servicio.modalidad}
        </span>
      </div>
    ),
  },
  {
    encabezado: 'Ruta',
    celda: (n) => (
      <span className="whitespace-nowrap">
        {n.servicio.zonaOrigen.nombre} → {n.servicio.zonaDestino.nombre}
      </span>
    ),
  },
  { encabezado: 'Pax', alineacion: 'derecha', celda: (n) => n.servicio.pasajeros },
  {
    encabezado: 'Motivo',
    celda: (n) => (
      <div className="flex flex-col items-start gap-1">
        <EstadoBadge texto={MOTIVO[n.motivo].etiqueta} tono={MOTIVO[n.motivo].tono} />
        {MOTIVO[n.motivo].nota && (
          <span className="text-xs font-medium text-amber-800">{MOTIVO[n.motivo].nota}</span>
        )}
      </div>
    ),
  },
]

/**
 * Generar rol (CU-13): ejecuta el motor de asignación para un día y muestra
 * el resumen y los servicios no cubiertos con su motivo (CU-14). La línea de
 * tiempo, los movimientos y la autorización están en Revisar rol (CU-15 y CU-16).
 */
export function GenerarRolPage() {
  const [fecha, setFecha] = useState(mananaCancun)
  // Resultado de la última generación de esta fecha (trae el tiempo en ms).
  const [generado, setGenerado] = useState<RolGenerado | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const rol = useRol(fecha)
  const noCubiertos = useNoCubiertos(fecha, !!rol.data)
  const generar = useGenerarRol()

  const cambiarFecha = (valor: string) => {
    setFecha(valor)
    setGenerado(null)
    generar.reset()
  }
  const ejecutar = () => {
    generar.mutate(fecha, {
      onSuccess: (resultado) => {
        setGenerado(resultado)
        const { asignados, noCubiertos: sinCubrir } = resultado.resumen
        toast.success(resultado.reemplazado ? 'Rol reemplazado' : 'Rol generado', {
          description: `${asignados} servicios asignados y ${sinCubrir} no cubiertos.`,
        })
      },
      onError: (error) => toast.error('No se generó el rol', { description: error.message }),
      onSettled: () => setConfirmando(false),
    })
  }

  const existente = rol.data
  const autorizado = existente?.estado === 'AUTORIZADO'
  const resumen = generado?.resumen ?? existente?.resumen
  const faltantes =
    generar.error instanceof ErrorApi ? ((generar.error.datos as { faltantes?: string[] } | null)?.faltantes ?? []) : []
  const conteo = (motivo: (typeof MOTIVOS)[number]) =>
    (noCubiertos.data ?? []).filter((n) => n.motivo === motivo).length

  return (
    <section className="space-y-6">
      <p className="text-sm text-muted-foreground">
        El motor asigna a cada servicio PENDIENTE del día la unidad factible de menor costo, sin empalmes, respetando
        capacidad, jornada y zona de término. El rol queda PROPUESTO; los servicios siguen en PENDIENTE.
      </p>

      <Card className="py-0 shadow-sm">
        <CardContent className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-end">
          <Campo etiqueta="Día de operación" htmlFor="fecha">
            <Input
              id="fecha"
              type="date"
              value={fecha}
              onChange={(e) => cambiarFecha(e.target.value)}
              className="sm:w-48"
            />
          </Campo>
          <Button
            onClick={() => (existente ? setConfirmando(true) : ejecutar())}
            disabled={!fecha || autorizado || generar.isPending || rol.isLoading}
          >
            {generar.isPending ? <Loader2 className="animate-spin" /> : <Play />}
            Generar rol
          </Button>
          {existente && (
            <Button asChild variant="outline">
              <Link to={`/roles/${fecha}`}>
                <CalendarRange />
                Revisar rol
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {existente && !generado && (
        <Aviso icono={autorizado ? CircleAlert : Info} tono={autorizado ? 'error' : 'aviso'}>
          {autorizado
            ? 'El rol de este día ya está AUTORIZADO; no se puede volver a generar.'
            : `Ya existe un rol PROPUESTO de este día (generado el ${diaYHoraCancun(existente.generadoEn)}). Si lo generas de nuevo se reemplaza.`}
        </Aviso>
      )}
      {faltantes.length > 0 && (
        <Aviso icono={CircleAlert} tono="error">
          {`Faltan tiempos en la matriz: ${faltantes.join(', ')}.`}
        </Aviso>
      )}

      {resumen && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" aria-label="Resumen del rol">
          <Tarjeta etiqueta="Servicios del día" valor={resumen.servicios} />
          <Tarjeta etiqueta="Asignados" valor={resumen.asignados} tono="text-emerald-700" />
          <Tarjeta etiqueta="No cubiertos" valor={resumen.noCubiertos} tono={resumen.noCubiertos ? 'text-red-700' : undefined} />
          <Tarjeta
            etiqueta="Unidades usadas"
            valor={generado ? `${generado.resumen.unidadesUsadas} de ${generado.resumen.unidadesDisponibles}` : resumen.unidadesUsadas}
          />
          <Tarjeta etiqueta="Tiempo de generación" valor={generado ? `${generado.resumen.tiempoMs} ms` : '—'} />
        </div>
      )}

      {existente && (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <CalendarCheck className="size-4 text-primary" />
              Servicios no cubiertos
            </h2>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {MOTIVOS.map((m) => (
                <li key={m} title={MOTIVO[m].explicacion}>
                  <span className="font-medium text-foreground">{MOTIVO[m].etiqueta}</span>: {conteo(m)}
                </li>
              ))}
            </ul>
          </div>
          <TablaDatos
            columnas={COLUMNAS}
            filas={noCubiertos.data}
            clave={(n) => n.id}
            cargando={noCubiertos.isLoading}
            error={noCubiertos.error?.message}
            mensajeVacio="Todos los servicios del día quedaron asignados."
            iconoVacio={CalendarCheck}
          />
          <p className="text-xs text-muted-foreground">
            {MOTIVOS.map((m) => `${MOTIVO[m].etiqueta}: ${MOTIVO[m].explicacion}`).join(' · ')}
          </p>
        </div>
      )}

      <Confirmacion
        titulo="¿Reemplazar el rol PROPUESTO?"
        mensaje="Se volverá a ejecutar el motor con los servicios PENDIENTE del día y el rol anterior se reemplazará."
        textoConfirmar="Generar de nuevo"
        destructiva={false}
        abierto={confirmando}
        procesando={generar.isPending}
        alConfirmar={ejecutar}
        alCancelar={() => setConfirmando(false)}
      />
    </section>
  )
}

function Tarjeta({ etiqueta, valor, tono }: { etiqueta: string; valor: number | string; tono?: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{etiqueta}</p>
      <p className={cn('text-2xl font-semibold tabular-nums', tono)}>{valor}</p>
    </div>
  )
}

function Aviso({ icono: Icono, tono, children }: { icono: LucideIcon; tono: 'aviso' | 'error'; children: string }) {
  return (
    <p
      role="status"
      className={cn(
        'flex items-start gap-2 rounded-lg border px-4 py-3 text-sm',
        tono === 'error'
          ? 'border-destructive/30 bg-destructive/5 text-destructive'
          : 'border-amber-200 bg-amber-50 text-amber-800',
      )}
    >
      <Icono className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  )
}
