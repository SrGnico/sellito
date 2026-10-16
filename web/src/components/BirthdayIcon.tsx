// Torta de cumpleaños con el estilo de la marca (contorno verde, rosa y crema), en lugar del emoji.
export default function BirthdayIcon({ size = 56 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className="birthday-icon">
      <g stroke="#12372A" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
        {/* llama y vela */}
        <path d="M32 3c3.5 4 4.5 6.5 4.5 8.5a4.5 4.5 0 0 1-9 0c0-2 1-4.5 4.5-8.5z" fill="#FFD166" />
        <rect x="28.5" y="16" width="7" height="10" rx="2" fill="#FFF4E0" />
        {/* piso de arriba: crema con glaseado rosa */}
        <rect x="15" y="26" width="34" height="14" rx="3" fill="#FFF4E0" />
        <path d="M15 29a3 3 0 0 1 3-3h28a3 3 0 0 1 3 3v3c-2.8 0-2.8 3.5-5.6 3.5S40.6 32 37.8 32s-2.8 3.5-5.6 3.5S29.4 32 26.6 32s-2.8 3.5-5.6 3.5S18.2 32 15 32z" fill="#FF9EC4" />
        {/* base rosa con una línea de crema */}
        <rect x="7" y="40" width="50" height="19" rx="4" fill="#FF9EC4" />
        <path d="M7 48c3.6 0 3.6 3 7.2 3s3.6-3 7.2-3 3.6 3 7.2 3 3.6-3 7.2-3 3.6 3 7.2 3 3.6-3 7.2-3 3.6 3 6.8 3" fill="none" />
      </g>
    </svg>
  )
}
