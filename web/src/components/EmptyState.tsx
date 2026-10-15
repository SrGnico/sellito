import type { ReactNode } from 'react'
import empty404 from '../assets/empty-404.svg'
import emptyClients from '../assets/empty-clients.svg'
import emptyExpired from '../assets/empty-expired.svg'
import emptyOffline from '../assets/empty-offline.svg'
import emptySearch from '../assets/empty-search.svg'
import reward from '../assets/reward.svg'

const ILLUSTRATIONS = {
  '404': empty404,
  clients: emptyClients,
  expired: emptyExpired,
  offline: emptyOffline,
  search: emptySearch,
  reward,
}

type Props = {
  illustration: keyof typeof ILLUSTRATIONS
  title: string
  children: ReactNode
  action?: ReactNode
}

// Patrón de vacíos y errores: ilustración, título corto, una frase y un solo botón.
export default function EmptyState({ illustration, title, children, action }: Props) {
  return (
    <div className="empty-state fade-up">
      <img src={ILLUSTRATIONS[illustration]} alt="" width={240} height={180} />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  )
}
