import { ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
      <Card className="mx-auto max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-3 py-10">
          <span className="flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <ShieldAlert className="size-6" />
          </span>
          <h2 className="text-lg font-semibold">Acceso denegado</h2>
          <p className="text-sm text-muted-foreground">Tu rol no tiene permiso para ver esta sección.</p>
          <Button asChild variant="outline" className="mt-2">
            <Link to="/">Volver al inicio</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }
  return children ?? <Outlet />
}
