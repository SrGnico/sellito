import mascot from '../assets/mascot.svg'

// El sello sonriente. Por debajo de 40 px se usa la versión simplificada (sin borde punteado).
export default function Mascot({ size = 48, label }: { size?: 32 | 48 | 96 | 150; label?: string }) {
  return <img src={size < 40 ? '/favicon.svg' : mascot} width={size} height={size} alt={label ?? ''} style={{ display: 'block' }} />
}
