import { ChevronDown, LogOut } from 'lucide-react'
import { useAuth } from '@/auth/contexto'
import { NOMBRE_ROL } from '@/auth/tipos'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/** Iniciales para el avatar (máximo dos letras). */
const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

/** Usuario con su rol en el encabezado y menú con "Cerrar sesión". */
export function MenuUsuario() {
  const { usuario, cerrarSesion } = useAuth()
  if (!usuario) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-11 gap-3 rounded-xl px-2 sm:pr-3">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {iniciales(usuario.nombre)}
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-sm font-medium">{usuario.nombre}</span>
            <span className="block text-xs text-muted-foreground">{NOMBRE_ROL[usuario.rol]}</span>
          </span>
          <ChevronDown className="hidden text-muted-foreground sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="space-y-1.5 py-2">
          <p className="text-sm font-medium text-foreground">{usuario.nombre}</p>
          <p className="text-xs font-normal text-muted-foreground">{usuario.email}</p>
          <Badge variant="secondary">{NOMBRE_ROL[usuario.rol]}</Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={cerrarSesion}>
          <LogOut />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
