import { KeyRound, MoreHorizontal, Pencil, RotateCcw, UserCog, UserX } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/contexto'
import { NOMBRE_ROL, ROLES } from '@/auth/tipos'
import { Confirmacion } from '@/components/comunes/Confirmacion'
import { DialogoFormulario } from '@/components/comunes/DialogoFormulario'
import { Paginacion } from '@/components/comunes/Paginacion'
import { SelectSimple } from '@/components/comunes/SelectSimple'
import { TablaDatos, type Columna } from '@/components/comunes/TablaDatos'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TODOS } from '@/lib/opciones'
import { useGuardar, useListado, useRetrasado } from '../catalogos/api'
import { BarraFiltros } from '../catalogos/BarraFiltros'
import { Encabezado } from '../catalogos/Encabezado'
import { EstadoBadge } from '../catalogos/EstadoBadge'
import { useCambiarActivo, useCambiarPassword, type UsuarioAdmin } from './api'
import type { ValoresAltaUsuario, ValoresEdicionUsuario, ValoresPassword } from './esquema'
import { FormularioAltaUsuario, FormularioEdicionUsuario } from './FormularioUsuario'
import { FormularioPassword } from './FormularioPassword'

const LIMITE = 10
const FILTRO_ROL = [{ valor: TODOS, etiqueta: 'Todos los roles' }, ...ROLES.map((r) => ({ valor: r, etiqueta: NOMBRE_ROL[r] }))]
const FILTRO_ACTIVO = [
  { valor: TODOS, etiqueta: 'Activos e inactivos' },
  { valor: 'true', etiqueta: 'Activos' },
  { valor: 'false', etiqueta: 'Inactivos' },
]

/** La confirmación de la contraseña solo se usa en el formulario; no se envía a la API. */
function sinConfirmacion(valores: ValoresAltaUsuario | ValoresEdicionUsuario) {
  if (!('confirmacion' in valores)) return valores
  const { confirmacion: _confirmacion, ...datos } = valores
  return datos
}

/** Administración de usuarios (CU-03). Solo ADMINISTRADOR (la ruta y la API lo revisan). */
export function UsuariosPage() {
  const yo = useAuth().usuario
  const [buscar, setBuscar] = useState('')
  const [rol, setRol] = useState(TODOS)
  const [activo, setActivo] = useState(TODOS)
  const [pagina, setPagina] = useState(1)
  const [enEdicion, setEnEdicion] = useState<UsuarioAdmin | 'nuevo' | null>(null)
  const [paraPassword, setParaPassword] = useState<UsuarioAdmin | null>(null)
  const [porCambiar, setPorCambiar] = useState<UsuarioAdmin | null>(null)

  const listado = useListado<UsuarioAdmin>('usuarios', {
    buscar: useRetrasado(buscar),
    rol,
    activo,
    pagina,
    limite: LIMITE,
  })
  const guardar = useGuardar<UsuarioAdmin>('usuarios')
  const cambiarPassword = useCambiarPassword()
  const cambiarActivo = useCambiarActivo()

  const filtrar = (aplicar: () => void) => {
    aplicar()
    setPagina(1)
  }
  const alGuardar = (valores: ValoresAltaUsuario | ValoresEdicionUsuario) => {
    const id = enEdicion && enEdicion !== 'nuevo' ? enEdicion.id : undefined
    guardar.mutate(
      { id, datos: sinConfirmacion(valores) },
      {
        onSuccess: () => {
          setEnEdicion(null)
          toast.success(`Usuario ${valores.nombre} ${id ? 'actualizado' : 'dado de alta'}`)
        },
        onError: (error) => toast.error('No se pudo guardar el usuario', { description: error.message }),
      },
    )
  }
  const alCambiarPassword = ({ password }: ValoresPassword) => {
    if (!paraPassword) return
    cambiarPassword.mutate(
      { id: paraPassword.id, password },
      {
        onSuccess: () => {
          toast.success(`Contraseña de ${paraPassword.nombre} actualizada`)
          setParaPassword(null)
        },
        onError: (error) => toast.error('No se pudo cambiar la contraseña', { description: error.message }),
      },
    )
  }
  const confirmarCambioActivo = () => {
    if (!porCambiar) return
    const activar = !porCambiar.activo
    cambiarActivo.mutate(
      { id: porCambiar.id, activo: activar },
      {
        onSuccess: () => toast.success(`Usuario ${porCambiar.nombre} ${activar ? 'reactivado' : 'desactivado'}`),
        onError: (error) =>
          toast.error(`No se pudo ${activar ? 'reactivar' : 'desactivar'} el usuario`, { description: error.message }),
        onSettled: () => setPorCambiar(null),
      },
    )
  }

  const columnas: Columna<UsuarioAdmin>[] = [
    {
      encabezado: 'Usuario',
      celda: (u) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">
            {u.nombre}
            {u.id === yo?.id && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(tú)</span>}
          </span>
          <span className="text-xs text-muted-foreground">{u.email}</span>
        </div>
      ),
    },
    {
      encabezado: 'Rol',
      celda: (u) => (
        <Badge variant={u.rol === 'ADMINISTRADOR' ? 'default' : 'secondary'} className="h-6">
          {NOMBRE_ROL[u.rol]}
        </Badge>
      ),
    },
    {
      encabezado: 'Estado',
      celda: (u) => (u.activo ? <EstadoBadge texto="Activo" tono="exito" /> : <EstadoBadge texto="Inactivo" tono="neutro" />),
    },
    {
      encabezado: 'Acciones',
      alineacion: 'derecha',
      celda: (u) => (
        <AccionesUsuario
          usuario={u}
          esUnoMismo={u.id === yo?.id}
          alEditar={() => {
            guardar.reset()
            setEnEdicion(u)
          }}
          alCambiarPassword={() => {
            cambiarPassword.reset()
            setParaPassword(u)
          }}
          alCambiarActivo={() => setPorCambiar(u)}
        />
      ),
    },
  ]

  return (
    <section>
      <Encabezado
        descripcion="Cuentas de acceso al sistema y su rol."
        textoNuevo="Nuevo usuario"
        alNuevo={() => {
          guardar.reset()
          setEnEdicion('nuevo')
        }}
      />

      <BarraFiltros
        buscar={buscar}
        alBuscar={(v) => filtrar(() => setBuscar(v))}
        placeholder="Buscar por nombre o correo…"
        ariaLabel="Buscar usuarios"
      >
        <SelectSimple
          ariaLabel="Filtrar por rol"
          valor={rol}
          alCambiar={(v) => filtrar(() => setRol(v))}
          opciones={FILTRO_ROL}
          className="h-9 bg-card sm:w-48"
        />
        <SelectSimple
          ariaLabel="Filtrar por estado"
          valor={activo}
          alCambiar={(v) => filtrar(() => setActivo(v))}
          opciones={FILTRO_ACTIVO}
          className="h-9 bg-card sm:w-48"
        />
      </BarraFiltros>

      <TablaDatos
        columnas={columnas}
        filas={listado.data?.datos}
        clave={(u) => u.id}
        cargando={listado.isLoading}
        error={listado.error?.message}
        mensajeVacio="No hay usuarios con esos filtros."
        iconoVacio={UserCog}
      />
      {listado.data && <Paginacion pagina={pagina} limite={LIMITE} total={listado.data.total} alCambiar={setPagina} />}

      <DialogoFormulario
        titulo={enEdicion === 'nuevo' ? 'Nuevo usuario' : 'Editar usuario'}
        descripcion={
          enEdicion === 'nuevo'
            ? 'La contraseña se guarda cifrada; compártela con la persona por un medio seguro.'
            : 'Cambia el nombre o el rol. La contraseña se cambia desde el menú de acciones.'
        }
        abierto={enEdicion !== null}
        alCerrar={() => setEnEdicion(null)}
      >
        {enEdicion === 'nuevo' ? (
          <FormularioAltaUsuario guardando={guardar.isPending} alGuardar={alGuardar} alCancelar={() => setEnEdicion(null)} />
        ) : (
          enEdicion && (
            <FormularioEdicionUsuario
              key={enEdicion.id}
              inicial={enEdicion}
              esUnoMismo={enEdicion.id === yo?.id}
              guardando={guardar.isPending}
              alGuardar={alGuardar}
              alCancelar={() => setEnEdicion(null)}
            />
          )
        )}
      </DialogoFormulario>

      <DialogoFormulario
        titulo="Cambiar contraseña"
        descripcion={`Nueva contraseña para ${paraPassword?.nombre ?? ''}. La anterior deja de funcionar.`}
        abierto={paraPassword !== null}
        alCerrar={() => setParaPassword(null)}
      >
        <FormularioPassword
          key={paraPassword?.id}
          guardando={cambiarPassword.isPending}
          alGuardar={alCambiarPassword}
          alCancelar={() => setParaPassword(null)}
        />
      </DialogoFormulario>

      <Confirmacion
        titulo={porCambiar?.activo === false ? '¿Reactivar este usuario?' : '¿Desactivar este usuario?'}
        mensaje={
          porCambiar?.activo === false
            ? `${porCambiar.nombre} podrá volver a iniciar sesión.`
            : `${porCambiar?.nombre ?? ''} ya no podrá iniciar sesión y su sesión abierta se cerrará. No se borra del sistema.`
        }
        textoConfirmar={porCambiar?.activo === false ? 'Reactivar' : 'Desactivar'}
        destructiva={porCambiar?.activo !== false}
        abierto={porCambiar !== null}
        procesando={cambiarActivo.isPending}
        alConfirmar={confirmarCambioActivo}
        alCancelar={() => setPorCambiar(null)}
      />
    </section>
  )
}

function AccionesUsuario({
  usuario,
  esUnoMismo,
  alEditar,
  alCambiarPassword,
  alCambiarActivo,
}: {
  usuario: UsuarioAdmin
  esUnoMismo: boolean
  alEditar: () => void
  alCambiarPassword: () => void
  alCambiarActivo: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Acciones de ${usuario.nombre}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={alEditar}>
          <Pencil />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={alCambiarPassword}>
          <KeyRound />
          Cambiar contraseña
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {usuario.activo ? (
          // Igual que la API: un administrador no puede desactivarse a sí mismo.
          <DropdownMenuItem variant="destructive" disabled={esUnoMismo} onSelect={alCambiarActivo}>
            <UserX />
            Desactivar
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={alCambiarActivo}>
            <RotateCcw />
            Reactivar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
