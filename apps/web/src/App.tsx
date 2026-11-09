import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RutaProtegida } from './auth/RutaProtegida'
import { Skeleton } from './components/ui/skeleton'
import { LoginPage } from './features/auth/LoginPage'
import { InicioPage } from './features/inicio/InicioPage'
import { Layout } from './layout/Layout'
import { ROLES_ADMINISTRACION, ROLES_CATALOGOS } from './layout/menu'

// Las pantallas internas se descargan solo cuando se abren (paquete inicial más ligero).
const VehiculosPage = lazy(() => import('./features/vehiculos/VehiculosPage').then((m) => ({ default: m.VehiculosPage })))
const OperadoresPage = lazy(() => import('./features/operadores/OperadoresPage').then((m) => ({ default: m.OperadoresPage })))
const ZonasPage = lazy(() => import('./features/zonas/ZonasPage').then((m) => ({ default: m.ZonasPage })))
const HotelesPage = lazy(() => import('./features/hoteles/HotelesPage').then((m) => ({ default: m.HotelesPage })))
const ParametrosPage = lazy(() => import('./features/parametros/ParametrosPage').then((m) => ({ default: m.ParametrosPage })))
const ZonasTerminoPage = lazy(() => import('./features/zonas-termino/ZonasTerminoPage').then((m) => ({ default: m.ZonasTerminoPage })))
const MatrizPage = lazy(() => import('./features/matriz/MatrizPage').then((m) => ({ default: m.MatrizPage })))
const UsuariosPage = lazy(() => import('./features/usuarios/UsuariosPage').then((m) => ({ default: m.UsuariosPage })))
const BitacoraPage = lazy(() => import('./features/bitacora/BitacoraPage').then((m) => ({ default: m.BitacoraPage })))

/** Mientras se descarga una pantalla. */
const Cargando = () => (
  <div className="space-y-4">
    <Skeleton className="h-9 w-full max-w-md" />
    <Skeleton className="h-72 w-full" />
  </div>
)

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Todo lo de adentro exige sesión iniciada */}
      <Route element={<RutaProtegida />}>
        <Route element={<Layout />}>
          <Route index element={<InicioPage />} />
          {/* Catálogos y configuración: solo para los roles del menú (la API vuelve a revisarlo) */}
          <Route
            element={
              <Suspense fallback={<Cargando />}>
                <RutaProtegida roles={ROLES_CATALOGOS} />
              </Suspense>
            }
          >
            <Route path="vehiculos" element={<VehiculosPage />} />
            <Route path="operadores" element={<OperadoresPage />} />
            <Route path="zonas" element={<ZonasPage />} />
            <Route path="hoteles" element={<HotelesPage />} />
            {/* Configuración: el ADMINISTRADOR edita; COORDINADOR y SUPERVISOR consultan */}
            <Route path="parametros" element={<ParametrosPage />} />
            <Route path="zonas-termino" element={<ZonasTerminoPage />} />
            <Route path="matriz-tiempos" element={<MatrizPage />} />
          </Route>
          {/* Administración: solo ADMINISTRADOR */}
          <Route
            element={
              <Suspense fallback={<Cargando />}>
                <RutaProtegida roles={ROLES_ADMINISTRACION} />
              </Suspense>
            }
          >
            <Route path="usuarios" element={<UsuariosPage />} />
            <Route path="bitacora" element={<BitacoraPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
