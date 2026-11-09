import { Menu } from 'lucide-react'
import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/contexto'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { MenuUsuario } from './MenuUsuario'
import { tituloDe } from './menu'
import { Navegacion } from './Navegacion'

/**
 * Estructura de las pantallas internas (como en los prototipos de la memoria):
 * menú lateral fijo en escritorio y, en móvil, oculto y abierto con un botón
 * (Sheet); encabezado con el título de la pantalla y el usuario con su rol.
 */
export function Layout() {
  const { usuario } = useAuth()
  const { pathname } = useLocation()
  const [menuMovil, setMenuMovil] = useState(false)
  if (!usuario) return null

  return (
    <div className="min-h-svh bg-background lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      {/* Menú lateral en escritorio */}
      <aside className="sticky top-0 hidden h-svh lg:block">
        <Navegacion rol={usuario.rol} />
      </aside>

      {/* Menú lateral en móvil */}
      <Sheet open={menuMovil} onOpenChange={setMenuMovil}>
        <SheetContent side="left" className="w-72 border-0 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Menú principal</SheetTitle>
          <SheetDescription className="sr-only">Secciones del sistema</SheetDescription>
          <Navegacion rol={usuario.rol} alNavegar={() => setMenuMovil(false)} />
        </SheetContent>
      </Sheet>

      {/* min-w-0 permite que las tablas se desplacen sin ensanchar la página */}
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-6 lg:px-10">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMenuMovil(true)}
            aria-label="Abrir menú"
          >
            <Menu />
          </Button>
          <div className="min-w-0">
            <p className="hidden text-xs text-muted-foreground sm:block">Best Line · Operaciones</p>
            <h1 className="truncate text-lg font-semibold tracking-tight">{tituloDe(pathname)}</h1>
          </div>
          <div className="ml-auto">
            <MenuUsuario />
          </div>
        </header>

        <main className="w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
