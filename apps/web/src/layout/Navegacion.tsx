import { NavLink } from 'react-router-dom'
import type { Rol } from '@/auth/tipos'
import { cn } from '@/lib/utils'
import { Marca } from './Marca'
import { menuAgrupado, type OpcionMenu } from './menu'

interface Props {
  rol: Rol
  /** Se llama al elegir una opción (en móvil, para cerrar el menú). */
  alNavegar?: () => void
}

/** Contenido del menú lateral: marca, opciones sueltas y los grupos (Catálogos, Configuración, Administración). */
export function Navegacion({ rol, alNavegar }: Props) {
  const grupos = menuAgrupado(rol)

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <Marca className="px-5 py-5" />
      <div className="mx-5 h-px bg-sidebar-border" />

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Menú principal">
        {grupos.map(({ grupo, opciones }) => (
          <div key={grupo ?? 'sueltas'} role="group" aria-label={grupo ?? 'General'}>
            {grupo && (
              <p className="px-3 pb-2 text-[0.7rem] font-semibold tracking-wider text-sidebar-foreground/50 uppercase">
                {grupo}
              </p>
            )}
            <ul className="space-y-1">
              {opciones.map((o) => (
                <Opcion key={o.ruta} opcion={o} alNavegar={alNavegar} />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <p className="px-5 py-4 text-[0.7rem] text-sidebar-foreground/40">Best Line Travel Agency · Cancún</p>
    </div>
  )
}

function Opcion({ opcion, alNavegar }: { opcion: OpcionMenu; alNavegar?: () => void }) {
  const Icono = opcion.icono
  return (
    <li>
      <NavLink
        to={opcion.ruta}
        end={opcion.ruta === '/'}
        onClick={alNavegar}
        className={({ isActive }) =>
          cn(
            'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
          )
        }
      >
        {({ isActive }) => (
          <>
            {/* Indicador de la opción activa con el color de acento */}
            <span
              className={cn(
                'absolute top-1.5 bottom-1.5 left-0 w-1 rounded-full bg-sidebar-primary transition-opacity',
                isActive ? 'opacity-100' : 'opacity-0',
              )}
              aria-hidden
            />
            <Icono className={cn('size-[1.1rem]', isActive ? 'text-sidebar-primary' : 'opacity-80')} />
            {opcion.etiqueta}
          </>
        )}
      </NavLink>
    </li>
  )
}
