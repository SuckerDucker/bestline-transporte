import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './contexto'
import type { Rol } from './tipos'

interface Props {
  /** Roles que pueden entrar. Si no se indica, basta con haber iniciado sesión. */
  roles?: readonly Rol[]
  children?: ReactNode
}

/**
 * Protege una ruta: sin sesión manda al login (recordando a dónde quería ir);
 * con sesión pero sin el rol necesario muestra un aviso de acceso denegado.
 * La API vuelve a revisar los permisos: esto solo evita pantallas que no sirven.
 */
export function RutaProtegida({ roles, children }: Props) {
  const { usuario } = useAuth()
  const ubicacion = useLocation()

  if (!usuario) {
    return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />
  }
  if (roles && !roles.includes(usuario.rol)) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        <h1 className="text-base font-semibold">Acceso denegado</h1>
        <p className="mt-1">Tu rol no tiene permiso para ver esta sección.</p>
      </div>
    )
  }
  return children ?? <Outlet />
}
