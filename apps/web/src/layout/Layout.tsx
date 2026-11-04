import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/contexto'
import { NOMBRE_ROL } from '../auth/tipos'
import { opcionesPara } from './menu'

/** Estructura de las pantallas internas: menú lateral según el rol y contenido. */
export function Layout() {
  const { usuario, cerrarSesion } = useAuth()
  if (!usuario) return null

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="flex w-60 shrink-0 flex-col bg-slate-800 text-slate-100">
        <div className="border-b border-slate-700 px-5 py-4">
          <p className="text-sm font-semibold">Best Line · Operaciones</p>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Menú principal">
          {opcionesPara(usuario.rol).map((opcion) => (
            <NavLink
              key={opcion.ruta}
              to={opcion.ruta}
              end={opcion.ruta === '/'}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm ${
                  isActive ? 'bg-slate-700 font-medium text-white' : 'text-slate-300 hover:bg-slate-700/60'
                }`
              }
            >
              {opcion.etiqueta}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-700 px-5 py-4 text-sm">
          <p className="font-medium">{usuario.nombre}</p>
          <p className="text-xs text-slate-400">{NOMBRE_ROL[usuario.rol]}</p>
          <button
            type="button"
            onClick={cerrarSesion}
            className="mt-3 w-full rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
