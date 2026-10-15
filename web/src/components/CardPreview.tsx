import type { CardConfig } from '../lib/cardDesign'
import { autoTextColor } from '../lib/color'
import { PROGRAM_NAME } from '../lib/wallet'
import StampGrid from './StampGrid'

// Código de muestra: la tarjeta muestra los últimos 4 caracteres (functions/src/cards/codes.ts).
const SAMPLE_CODE = 'T9HZ'

// Copia del frente de la tarjeta en Google Wallet: logo y nombre, título, QR con su código,
// contador de sellos y, abajo, la imagen de sellos (la misma que genera el backend).
export default function CardPreview({ config, filled }: { config: CardConfig; filled: number }) {
  const total = config.stampsRequired
  const stamps = Math.min(filled, total)
  const fg = autoTextColor(config.bgColor)
  const name = config.name.trim() || 'Tu negocio'

  return (
    <figure className="wallet-card" style={{ background: config.bgColor, color: fg }}>
      <div className="wallet-card-header">
        {config.logoUrl ? (
          <img className="wallet-card-logo" src={config.logoUrl} alt="" />
        ) : (
          <span className="wallet-card-logo" aria-hidden="true" style={{ background: '#fff', color: '#12372A' }}>
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="wallet-card-issuer">{name}</span>
      </div>
      <p className="wallet-card-title">{PROGRAM_NAME}</p>

      <div className="wallet-card-code">
        <FakeQr />
        <span>{SAMPLE_CODE}</span>
      </div>

      <div className="wallet-card-points">
        <span className="wallet-card-label">Sellos</span>
        <span className="wallet-card-value">{stamps === total ? '¡Premio listo!' : `${stamps} de ${total}`}</span>
      </div>

      <StampGrid
        total={total}
        filled={stamps}
        bgColor={config.bgColor}
        textColor={fg}
        stampIconId={config.stampIconId}
        stampIconUrl={config.stampIconUrl}
        bannerUrl={config.bannerUrl}
      />
      <figcaption className="sr-only">Vista previa de la tarjeta en Google Wallet</figcaption>
    </figure>
  )
}

// QR de muestra: el real lo genera el Wallet a partir del código de la tarjeta.
function FakeQr() {
  const n = 21
  const finder = (x: number, y: number) => x < 7 && y < 7
  const isFinder = (x: number, y: number) => finder(x, y) || finder(n - 1 - x, y) || finder(x, n - 1 - y)
  const cells: [number, number][] = []
  let seed = 7
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      seed = (seed * 9301 + 49297) % 233280
      if (!isFinder(x, y) && seed / 233280 > 0.55) cells.push([x, y])
    }
  }
  const eye = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={7} height={7} fill="#000" />
      <rect x={x + 1} y={y + 1} width={5} height={5} fill="#fff" />
      <rect x={x + 2} y={y + 2} width={3} height={3} fill="#000" />
    </g>
  )
  return (
    <svg viewBox={`-1 -1 ${n + 2} ${n + 2}`} width={96} height={96} aria-hidden="true" shapeRendering="crispEdges">
      <rect x={-1} y={-1} width={n + 2} height={n + 2} fill="#fff" />
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#000" />
      ))}
      {eye(0, 0)}
      {eye(n - 7, 0)}
      {eye(0, n - 7)}
    </svg>
  )
}
