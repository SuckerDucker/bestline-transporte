import { Navigate, Route, Routes } from 'react-router-dom'
import { RutaProtegida } from './auth/RutaProtegida'
import { LoginPage } from './features/auth/LoginPage'
import { InicioPage } from './features/inicio/InicioPage'
import { Layout } from './layout/Layout'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Todo lo de adentro exige sesión iniciada */}
      <Route element={<RutaProtegida />}>
        <Route element={<Layout />}>
          <Route index element={<InicioPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
