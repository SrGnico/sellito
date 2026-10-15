import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AuthProvider from './components/AuthProvider'
import RequireAuth from './components/RequireAuth'
import Admin from './pages/Admin'
import Enroll from './pages/Enroll'
import Landing from './pages/Landing'
import Legal from './pages/Legal'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Panel from './pages/Panel'
import Scanner from './pages/Scanner'
import ScannerLauncher from './pages/ScannerLauncher'
import { updateRobots } from './lib/seo'
import { isSiteHost } from './lib/urls'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <RobotsTag />
        <Routes>
          {/* misellito.com.ar muestra la landing; app.misellito.com.ar (y localhost) van al panel. */}
          <Route path="/" element={isSiteHost() ? <Landing /> : <Navigate to="/panel" replace />} />
          <Route path="/landing" element={<Landing />} />
          <Route path="/privacidad" element={<Legal kind="privacy" />} />
          <Route path="/terminos" element={<Legal kind="terms" />} />
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

// Marca cada página como indexable o no según dónde estamos (ver lib/seo.ts).
function RobotsTag() {
  const { pathname } = useLocation()
  useEffect(() => updateRobots(pathname), [pathname])
  return null
}
