import { Navigate, Route, Routes } from 'react-router-dom'
import { RutaProtegida } from './auth/RutaProtegida'
import { LoginPage } from './features/auth/LoginPage'
import { HotelesPage } from './features/hoteles/HotelesPage'
import { InicioPage } from './features/inicio/InicioPage'
import { OperadoresPage } from './features/operadores/OperadoresPage'
import { VehiculosPage } from './features/vehiculos/VehiculosPage'
import { ZonasPage } from './features/zonas/ZonasPage'
import { Layout } from './layout/Layout'
import { ROLES_CATALOGOS } from './layout/menu'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Todo lo de adentro exige sesión iniciada */}
      <Route element={<RutaProtegida />}>
        <Route element={<Layout />}>
          <Route index element={<InicioPage />} />
          {/* Catálogos: solo para los roles del menú (la API vuelve a revisarlo) */}
          <Route element={<RutaProtegida roles={ROLES_CATALOGOS} />}>
            <Route path="vehiculos" element={<VehiculosPage />} />
            <Route path="operadores" element={<OperadoresPage />} />
            <Route path="zonas" element={<ZonasPage />} />
            <Route path="hoteles" element={<HotelesPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
