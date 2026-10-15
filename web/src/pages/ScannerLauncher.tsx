import { Navigate } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import { lastScannerBusiness } from '../lib/scanner'

// /escaner (sin local): es lo que abre el acceso directo instalado. Vuelve al último escáner usado.
export default function ScannerLauncher() {
  const businessId = lastScannerBusiness()
  if (businessId) return <Navigate to={`/escaner/${businessId}`} replace />
  return (
    <main>
      <EmptyState illustration="search" title="Abrí el escáner desde su link">
        Pedile al dueño del local el link o el QR del escáner. Está en su panel, en “Escáner del local”.
      </EmptyState>
    </main>
  )
}
