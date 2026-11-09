import { useQuery } from '@tanstack/react-query'
import { ScrollText, X } from 'lucide-react'
import { useState } from 'react'
import { pedir, type Paginado } from '@/api/cliente'
import { Campo } from '@/components/comunes/Campo'
import { Paginacion } from '@/components/comunes/Paginacion'
import { SelectSimple } from '@/components/comunes/SelectSimple'
import { TablaDatos, type Columna } from '@/components/comunes/TablaDatos'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TODOS } from '@/lib/opciones'
import { useListado } from '../catalogos/api'
import type { UsuarioAdmin } from '../usuarios/api'
import { ACCIONES, ENTIDADES, formatoFecha, separarAccion } from './formato'

interface RegistroBitacora {
  id: number
  fecha: string
  accion: string
  entidad: string
  entidadId: number
  usuario: { id: number; nombre: string; email: string }
}

const LIMITE = 15
const FILTRO_ACCION = [{ valor: TODOS, etiqueta: 'Todas las acciones' }, ...ACCIONES]
const FILTRO_ENTIDAD = [{ valor: TODOS, etiqueta: 'Todas las entidades' }, ...ENTIDADES]
const FILTROS_VACIOS = { usuarioId: TODOS, accion: TODOS, entidad: TODOS, desde: '', hasta: '' }

/** Consulta de la bitácora (CU-04). Solo ADMINISTRADOR. */
export function BitacoraPage() {
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [pagina, setPagina] = useState(1)
  const cambiar = (campo: keyof typeof FILTROS_VACIOS) => (valor: string) => {
    setFiltros((f) => ({ ...f, [campo]: valor }))
    setPagina(1)
  }

  // Lista de usuarios para el filtro (hasta 100, de sobra para el área).
  const usuarios = useQuery({
    queryKey: ['usuarios', 'opciones'],
    queryFn: () => pedir<Paginado<UsuarioAdmin>>('/usuarios', { query: { limite: 100 } }),
  })
  const opcionesUsuario = [
    { valor: TODOS, etiqueta: 'Todos los usuarios' },
    ...(usuarios.data?.datos ?? []).map((u) => ({ valor: String(u.id), etiqueta: u.nombre })),
  ]

  const rangoInvertido = !!filtros.desde && !!filtros.hasta && filtros.desde > filtros.hasta
  const listado = useListado<RegistroBitacora>('bitacora', {
    ...filtros,
    // Con el rango invertido no se consulta; se avisa junto a las fechas.
    ...(rangoInvertido && { desde: '', hasta: '' }),
    pagina,
    limite: LIMITE,
  })
  const hayFiltros = JSON.stringify(filtros) !== JSON.stringify(FILTROS_VACIOS)

  const columnas: Columna<RegistroBitacora>[] = [
    {
      encabezado: 'Fecha y hora',
      celda: (r) => <span className="whitespace-nowrap text-muted-foreground tabular-nums">{formatoFecha(r.fecha)}</span>,
    },
    {
      encabezado: 'Usuario',
      celda: (r) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{r.usuario.nombre}</span>
          <span className="text-xs text-muted-foreground">{r.usuario.email}</span>
        </div>
      ),
    },
    {
      encabezado: 'Acción',
      celda: (r) => {
        const { accion, detalle } = separarAccion(r.accion)
        return (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="h-6 font-mono text-[0.7rem]">
              {accion}
            </Badge>
            {detalle && <span className="text-sm text-muted-foreground">{detalle}</span>}
          </div>
        )
      },
    },
    {
      encabezado: 'Entidad',
      celda: (r) => (
        <span>
          {ENTIDADES.find((e) => e.valor === r.entidad)?.etiqueta ?? r.entidad}
          <span className="ml-1 text-muted-foreground tabular-nums">#{r.entidadId}</span>
        </span>
      ),
    },
  ]

  return (
    <section>
      <p className="mb-6 text-sm text-muted-foreground">
        Registro de quién hizo cada cambio y cuándo, del más reciente al más antiguo (hora de Cancún).
      </p>

      <div className="mb-4 grid gap-3 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_10rem_10rem_auto] lg:items-end">
        <Campo etiqueta="Usuario" htmlFor="filtro-usuario">
          <SelectSimple id="filtro-usuario" valor={filtros.usuarioId} alCambiar={cambiar('usuarioId')} opciones={opcionesUsuario} className="h-9" />
        </Campo>
        <Campo etiqueta="Acción" htmlFor="filtro-accion">
          <SelectSimple id="filtro-accion" valor={filtros.accion} alCambiar={cambiar('accion')} opciones={FILTRO_ACCION} className="h-9" />
        </Campo>
        <Campo etiqueta="Entidad" htmlFor="filtro-entidad">
          <SelectSimple id="filtro-entidad" valor={filtros.entidad} alCambiar={cambiar('entidad')} opciones={FILTRO_ENTIDAD} className="h-9" />
        </Campo>
        <Campo etiqueta="Desde" htmlFor="filtro-desde" error={rangoInvertido ? 'Debe ser antes de "Hasta"' : undefined}>
          <Input
            id="filtro-desde"
            type="date"
            value={filtros.desde}
            onChange={(e) => cambiar('desde')(e.target.value)}
            aria-invalid={rangoInvertido || undefined}
          />
        </Campo>
        <Campo etiqueta="Hasta" htmlFor="filtro-hasta">
          <Input id="filtro-hasta" type="date" value={filtros.hasta} onChange={(e) => cambiar('hasta')(e.target.value)} />
        </Campo>
        <Button
          variant="ghost"
          disabled={!hayFiltros}
          onClick={() => {
            setFiltros(FILTROS_VACIOS)
            setPagina(1)
          }}
        >
          <X />
          Limpiar
        </Button>
      </div>

      <TablaDatos
        columnas={columnas}
        filas={listado.data?.datos}
        clave={(r) => r.id}
        cargando={listado.isLoading}
        error={listado.error?.message}
        mensajeVacio="No hay registros con esos filtros."
        iconoVacio={ScrollText}
      />
      {listado.data && <Paginacion pagina={pagina} limite={LIMITE} total={listado.data.total} alCambiar={setPagina} />}
    </section>
  )
}
