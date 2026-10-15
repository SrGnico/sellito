import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState'

export default function NotFound() {
  return (
    <main>
      <EmptyState
        illustration="404"
        title="No encontramos esta página"
        action={<Link className="btn btn-primary" to="/">Ir al inicio</Link>}
      >
        Puede que el link esté mal escrito o que la página ya no exista.
      </EmptyState>
    </main>
  )
}
