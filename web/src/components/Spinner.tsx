// Spinner de puntos (sellito-motion.css). Hereda el color del texto.
export default function Spinner({ small = false }: { small?: boolean }) {
  return (
    <svg className={small ? 'spinner spinner-sm' : 'spinner'} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="0 5.65" />
    </svg>
  )
}
