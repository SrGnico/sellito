import { BrowserRouter, Link, Route, Routes, useParams } from 'react-router-dom'
import { app } from './lib/firebase'

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
      <h1>Sellito</h1>
      <p>Conectado a Firebase: <code>{app.options.projectId}</code></p>
      <ul>
        <li><Link to="/login">Login negocio</Link></li>
        <li><Link to="/panel">Panel</Link></li>
        <li><Link to="/alta/demo">Alta cliente (demo)</Link></li>
        <li><Link to="/escaner/demo">Escáner (demo)</Link></li>
        <li><Link to="/admin">Super admin</Link></li>
      </ul>
    </main>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Placeholder title="Login" />} />
        <Route path="/panel/*" element={<Placeholder title="Panel del negocio" />} />
        <Route path="/alta/:businessId" element={<Placeholder title="Alta de cliente" />} />
        <Route path="/escaner/:businessId" element={<Placeholder title="Escáner" />} />
        <Route path="/admin/*" element={<Placeholder title="Super admin" />} />
        <Route path="*" element={<Placeholder title="No encontrado" />} />
      </Routes>
    </BrowserRouter>
  )
}
