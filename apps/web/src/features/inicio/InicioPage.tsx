import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowRight, Bus, CalendarClock, Hotel, IdCard, MapPinned, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { pedir } from '@/api/cliente'
import { useAuth } from '@/auth/contexto'
import { NOMBRE_ROL } from '@/auth/tipos'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ROLES_CATALOGOS } from '@/layout/menu'
import { cn } from '@/lib/utils'

/** Respuesta de GET /api/resumen. */
interface Resumen {
  vehiculos: { activos: number; disponibles: number; enMantenimiento: number }
  operadores: { disponibles: number; total: number }
  zonas: { total: number; deTermino: number }
  hoteles: { total: number }
  servicios: { fecha: string; pendientes: number; total: number }
}

interface Tarjeta {
  titulo: string
  valor: number
  descripcion: string
  icono: LucideIcon
  color: string
  enlace?: { ruta: string; texto: string }
}

const ZONA = 'America/Cancun'
const fechaLarga = (d: Date) =>
  new Intl.DateTimeFormat('es-MX', { timeZone: ZONA, dateStyle: 'full' }).format(d)
// La fecha del resumen ya viene en hora de Cancún (AAAA-MM-DD); se fija a mediodía
// para que el formato no cambie de día por la zona horaria del navegador.
const fechaCorta = (aaaammdd: string) =>
  new Intl.DateTimeFormat('es-MX', { timeZone: ZONA, day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(`${aaaammdd}T12:00:00-05:00`),
  )

function tarjetas(r: Resumen, conEnlaces: boolean): Tarjeta[] {
  const enlace = (ruta: string, texto: string) => (conEnlaces ? { ruta, texto } : undefined)
  return [
    {
      titulo: 'Vehículos activos',
      valor: r.vehiculos.activos,
      descripcion: `${r.vehiculos.disponibles} disponibles · ${r.vehiculos.enMantenimiento} en mantenimiento`,
      icono: Bus,
      color: 'bg-sky-50 text-sky-700',
      enlace: enlace('/vehiculos', 'Ver vehículos'),
    },
    {
      titulo: 'Operadores disponibles',
      valor: r.operadores.disponibles,
      descripcion: `de ${r.operadores.total} operadores registrados`,
      icono: IdCard,
      color: 'bg-emerald-50 text-emerald-700',
      enlace: enlace('/operadores', 'Ver operadores'),
    },
    {
      titulo: 'Zonas',
      valor: r.zonas.total,
      descripcion: `${r.zonas.deTermino} son zonas de término`,
      icono: MapPinned,
      color: 'bg-violet-50 text-violet-700',
      enlace: enlace('/zonas', 'Ver zonas'),
    },
    {
      titulo: 'Hoteles',
      valor: r.hoteles.total,
      descripcion: 'hoteles de recogida y entrega',
      icono: Hotel,
      color: 'bg-rose-50 text-rose-700',
      enlace: enlace('/hoteles', 'Ver hoteles'),
    },
    {
      titulo: 'Servicios pendientes',
      valor: r.servicios.pendientes,
      descripcion: `de ${r.servicios.total} servicios del ${fechaCorta(r.servicios.fecha)}`,
      icono: CalendarClock,
      color: 'bg-amber-50 text-amber-700',
      // Aún no existe la pantalla de servicios (llega con la importación).
    },
  ]
}

/** Pantalla de inicio: saludo y tarjetas de resumen con datos de GET /api/resumen. */
export function InicioPage() {
  const { usuario } = useAuth()
  const resumen = useQuery({ queryKey: ['resumen'], queryFn: () => pedir<Resumen>('/resumen') })
  // La fecha de hoy se calcula una sola vez al entrar a la pantalla.
  const [hoy] = useState(() => new Date())
  if (!usuario) return null
  const conEnlaces = ROLES_CATALOGOS.includes(usuario.rol)

  return (
    <section className="space-y-8">
      <Card className="overflow-hidden border-0 bg-primary text-primary-foreground shadow-md">
        <CardContent className="relative flex flex-col gap-3 p-6 sm:p-8">
          <div className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-acento/20 blur-3xl" />
          <p className="text-sm opacity-75 first-letter:uppercase">{fechaLarga(hoy)}</p>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Hola, {usuario.nombre}</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm opacity-90">
            Entraste como
            <Badge className="bg-acento text-acento-foreground">{NOMBRE_ROL[usuario.rol]}</Badge>
          </div>
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">Resumen</h3>

        {resumen.isError ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-6 text-sm text-destructive">
              <TriangleAlert className="size-5" />
              No se pudo cargar el resumen: {resumen.error.message}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            {resumen.data
              ? tarjetas(resumen.data, conEnlaces).map((t) => <TarjetaResumen key={t.titulo} {...t} />)
              : Array.from({ length: 5 }, (_, i) => <TarjetaCargando key={i} />)}
          </div>
        )}
      </div>
    </section>
  )
}

function TarjetaResumen({ titulo, valor, descripcion, icono: Icono, color, enlace }: Tarjeta) {
  return (
    <Card className="flex flex-col gap-0 py-0 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{titulo}</p>
          <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', color)}>
            <Icono className="size-5" />
          </span>
        </div>
        <p className="text-4xl font-semibold tracking-tight tabular-nums">{valor}</p>
        <p className="text-sm text-muted-foreground">{descripcion}</p>
      </CardContent>
      <div className="border-t px-5 py-3">
        {enlace ? (
          <Link
            to={enlace.ruta}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            {enlace.texto}
            <ArrowRight className="size-4" />
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">Pantalla de servicios: próxima fase</span>
        )}
      </div>
    </Card>
  )
}

function TarjetaCargando() {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="size-10 rounded-xl" />
        </div>
        <Skeleton className="h-9 w-16" />
        <Skeleton className="h-4 w-40" />
      </CardContent>
      <div className="border-t px-5 py-3">
        <Skeleton className="h-4 w-24" />
      </div>
    </Card>
  )
}
