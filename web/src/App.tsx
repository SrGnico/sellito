import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AuthProvider from './components/AuthProvider'
import RequireAuth from './components/RequireAuth'
import Admin from './pages/Admin'
import Enroll from './pages/Enroll'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Panel from './pages/Panel'
import Scanner from './pages/Scanner'
import ScannerLauncher from './pages/ScannerLauncher'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Hasta que exista la landing (paso 10), la raíz lleva al panel. */}
          <Route path="/" element={<Navigate to="/panel" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/panel/*" element={<RequireAuth><Panel /></RequireAuth>} />
          <Route path="/c/:code" element={<Enroll />} />
          <Route path="/escaner" element={<ScannerLauncher />} />
          <Route path="/escaner/:businessId" element={<Scanner />} />
          <Route path="/admin/*" element={<RequireAuth><Admin /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
