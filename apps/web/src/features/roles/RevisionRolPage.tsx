import { CalendarCog, CircleAlert, Eye, Loader2, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ErrorApi } from '@/api/cliente'
import { useAuth } from '@/auth/contexto'
import { Campo } from '@/components/comunes/Campo'
import { Confirmacion } from '@/components/comunes/Confirmacion'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { diaYHoraCancun, mananaCancun } from '@/lib/fechas'
import { cn } from '@/lib/utils'
import { useEsMovil } from '@/lib/useEsMovil'
import { ROLES_IMPORTAR } from '@/layout/menu'
import { EstadoBadge } from '../catalogos/EstadoBadge'
import { useAutorizarRol, useRol } from './api'
import { LeyendaLineaTiempo, LineaTiempo } from './LineaTiempo'
import { ListaUnidades } from './ListaUnidades'
import { PanelNoCubiertos } from './PanelNoCubiertos'
import { type Objetivo, SelectorUnidad } from './SelectorUnidad'

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/

/** /roles sin fecha: el rol de mañana (se revisa el día anterior). */
export function RedirigirRolDeManana() {
  return <Navigate to={`/roles/${mananaCancun()}`} replace />
}

/**
 * Revisión del rol (CU-15): línea de tiempo por unidad (lista en celular),
 * no cubiertos por motivo, mover un servicio o asignar un no cubierto a una
 * unidad (la API revalida) y autorizar. SUPERVISOR solo consulta y un rol
 * AUTORIZADO ya no se modifica.
 */
export function RevisionRolPage() {
  const { fecha = '' } = useParams()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const esMovil = useEsMovil()
  const valida = FORMATO_FECHA.test(fecha)
  const rol = useRol(valida ? fecha : '')
  const autorizar = useAutorizarRol(fecha)
  const [objetivo, setObjetivo] = useState<Objetivo | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  const datos = rol.data
  const puedeModificar = !!usuario && ROLES_IMPORTAR.includes(usuario.rol)
  const autorizado = datos?.estado === 'AUTORIZADO'
  const editable = puedeModificar && datos?.estado === 'PROPUESTO'

  const ejecutarAutorizacion = () =>
    autorizar.mutate(undefined, {
      onSuccess: (r) =>
        toast.success('Rol autorizado', {
          description: `${r.programados} servicios quedaron PROGRAMADO; ${r.noCubiertos} siguen sin cubrir.`,
        }),
      onError: (error) => {
        const violaciones =
          error instanceof ErrorApi ? ((error.datos as { violaciones?: string[] } | null)?.violaciones ?? []) : []
        toast.error('No se autorizó el rol', {
          description: violaciones.length ? `${error.message}: ${violaciones.join('; ')}` : error.message,
        })
      },
      onSettled: () => setConfirmando(false),
    })

  return (
    <section className="space-y-6">
      <Card className="py-0 shadow-sm">
        <CardContent className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:flex-wrap sm:items-end">
          <Campo etiqueta="Día de operación" htmlFor="fecha-rol">
            <Input
              id="fecha-rol"
              type="date"
              value={fecha}
              onChange={(e) => e.target.value && navigate(`/roles/${e.target.value}`)}
              className="sm:w-48"
            />
          </Campo>
          {datos && (
            <div className="flex flex-col gap-1 sm:pb-1.5">
              <EstadoBadge texto={autorizado ? 'Autorizado' : 'Propuesto'} tono={autorizado ? 'exito' : 'aviso'} />
              {autorizado && datos.autorizadoEn && (
                <span className="text-xs text-muted-foreground">
                  Por {datos.autorizador?.nombre ?? '—'} el {diaYHoraCancun(datos.autorizadoEn)}
                </span>
              )}
            </div>
          )}
          {editable && (
            <Button className="sm:ml-auto" onClick={() => setConfirmando(true)} disabled={autorizar.isPending}>
              {autorizar.isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
              Autorizar rol
            </Button>
          )}
        </CardContent>
      </Card>

      {!valida ? (
        <Aviso tono="error">La fecha debe tener el formato AAAA-MM-DD.</Aviso>
      ) : rol.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : rol.error ? (
        <Aviso tono="error">{rol.error.message}</Aviso>
      ) : !datos ? (
        <div className="space-y-3">
          <Aviso tono="aviso">Todavía no se ha generado el rol de este día.</Aviso>
          {puedeModificar && (
            <Button asChild variant="outline">
              <Link to="/generar-rol">
                <CalendarCog />
                Ir a Generar rol
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          {!editable && (
            <Aviso tono="info">
              {autorizado
                ? 'El rol ya está AUTORIZADO: solo se puede consultar.'
                : 'Solo consulta: ADMINISTRADOR y COORDINADOR son quienes mueven servicios y autorizan el rol.'}
            </Aviso>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Totales del rol">
            <Tarjeta etiqueta="Servicios del día" valor={datos.resumen.servicios} />
            <Tarjeta etiqueta="Asignados" valor={datos.resumen.asignados} tono="text-emerald-700" />
            <Tarjeta
              etiqueta="No cubiertos"
              valor={datos.resumen.noCubiertos}
              tono={datos.resumen.noCubiertos ? 'text-red-700' : undefined}
            />
            <Tarjeta etiqueta="Unidades usadas" valor={`${datos.resumen.unidadesUsadas} de ${datos.unidades.length}`} />
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="text-base font-semibold">Servicios por unidad</h2>
              {!esMovil && <LeyendaLineaTiempo />}
            </div>
            {esMovil ? (
              <ListaUnidades unidades={datos.unidades} editable={editable} alElegir={elegirAsignacion} />
            ) : (
              <LineaTiempo fecha={fecha} unidades={datos.unidades} editable={editable} alElegir={elegirAsignacion} />
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold">Servicios no cubiertos</h2>
            <PanelNoCubiertos
              noCubiertos={datos.noCubiertos}
              editable={editable}
              alAsignar={(n) => setObjetivo({ servicio: n.servicio, asignacionId: null })}
            />
          </div>
        </>
      )}

      <SelectorUnidad fecha={fecha} objetivo={objetivo} alCerrar={() => setObjetivo(null)} />
      <Confirmacion
        titulo="¿Autorizar el rol?"
        mensaje={`Antes de autorizar se vuelve a verificar todo el rol. Los servicios asignados pasarán a PROGRAMADO y el rol ya no se podrá modificar ni volver a generar.${datos?.resumen.noCubiertos ? ` Quedan ${datos.resumen.noCubiertos} servicios sin cubrir.` : ''}`}
        textoConfirmar="Autorizar"
        destructiva={false}
        abierto={confirmando}
        procesando={autorizar.isPending}
        alConfirmar={ejecutarAutorizacion}
        alCancelar={() => setConfirmando(false)}
      />
    </section>
  )

  function elegirAsignacion(a: { id: number; servicio: Objetivo['servicio'] }) {
    setObjetivo({ servicio: a.servicio, asignacionId: a.id })
  }
}

function Tarjeta({ etiqueta, valor, tono }: { etiqueta: string; valor: number | string; tono?: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{etiqueta}</p>
      <p className={cn('text-2xl font-semibold tabular-nums', tono)}>{valor}</p>
    </div>
  )
}

const TONO_AVISO = {
  aviso: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-destructive/30 bg-destructive/5 text-destructive',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
}

function Aviso({ tono, children }: { tono: keyof typeof TONO_AVISO; children: string }) {
  const Icono = tono === 'info' ? Eye : CircleAlert
  return (
    <p role="status" className={cn('flex items-start gap-2 rounded-lg border px-4 py-3 text-sm', TONO_AVISO[tono])}>
      <Icono className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  )
}
