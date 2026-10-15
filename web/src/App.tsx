import { BrowserRouter, Link, Route, Routes, useParams } from 'react-router-dom'
import AuthProvider from './components/AuthProvider'
import RequireAuth from './components/RequireAuth'
import { app } from './lib/firebase'
import Enroll from './pages/Enroll'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Scanner from './pages/Scanner'
import Panel from './pages/Panel'
import { APP_NAME } from './lib/urls'

// Pantallas provisorias: cada una se reemplaza en su paso del orden de construcción.
function Placeholder({ title }: { title: string }) {
  const params = useParams()
  return (
    <main>
      <h1>{title}</h1>
      {Object.keys(params).length > 0 && <pre>{JSON.stringify(params, null, 2)}</pre>}
      <p>
        <Link to="/">Volver</Link>
      </p>
    </main>
  )
}

function Home() {
  return (
    <main>
      <h1>{APP_NAME}</h1>
      <div className="alert alert-ok" role="status" style={{ margin: '24px 0' }}>
        <div>
          <span className="alert-title">Conectado a Firebase</span>
          <span className="alert-text">Proyecto: <code>{app.options.projectId}</code></span>
        </div>
      </div>
      <div className="card" style={{ gap: 12 }}>
        <Link className="btn btn-primary" to="/login">Login negocio</Link>
        <Link className="btn" to="/panel">Panel</Link>
        <Link className="btn btn-ghost" to="/admin">Super admin</Link>
      </div>
    </main>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/panel/*" element={<RequireAuth><Panel /></RequireAuth>} />
          <Route path="/c/:code" element={<Enroll />} />
          <Route path="/escaner/:businessId" element={<Scanner />} />
          <Route path="/admin/*" element={<Placeholder title="Super admin" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
