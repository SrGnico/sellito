import type { CardConfig } from '../lib/cardDesign'
import { autoTextColor } from '../lib/color'
import { proximityText } from '../lib/proximity'
import { PROGRAM_NAME } from '../lib/wallet'
import StampGrid from './StampGrid'

export type WalletPlatform = 'android' | 'iphone'

// Código de muestra: la tarjeta muestra los últimos 4 caracteres (functions/src/cards/codes.ts).
const SAMPLE_CODE = 'T9HZ'

type Props = { config: CardConfig; filled: number; platform?: WalletPlatform }

// Copia del frente de la tarjeta en cada Wallet. El orden lo fija cada plataforma:
// - Google Wallet (Android): logo y nombre, título, QR, contador y la imagen de sellos abajo.
// - Apple Wallet (iPhone): logo y nombre arriba con el contador, imagen de sellos, "Tu progreso" y QR abajo
//   (igual que functions/src/wallet/apple.ts).
export default function CardPreview({ config, filled, platform = 'android' }: Props) {
  const total = config.stampsRequired
  const stamps = Math.min(filled, total)
  const fg = autoTextColor(config.bgColor)
  const name = config.name.trim() || 'Tu negocio'
  const balance = stamps === total ? '¡Premio listo!' : `${stamps} de ${total}`

  const logo = config.logoUrl ? (
    <img className="wallet-card-logo" src={config.logoUrl} alt="" />
  ) : (
    <span className="wallet-card-logo" aria-hidden="true" style={{ background: '#fff', color: '#12372A' }}>
      {name.charAt(0).toUpperCase()}
    </span>
  )
  // Logo horizontal con el nombre: va solo, sin el logo redondo ni el nombre escrito.
  const wide = config.wideLogoUrl ? <img className="wallet-card-wide-logo" src={config.wideLogoUrl} alt={name} /> : null
  const stampsImage = (
    <StampGrid
      total={total}
      filled={stamps}
      bgColor={config.bgColor}
      textColor={fg}
      stampIconId={config.stampIconId}
      stampIconUrl={config.stampIconUrl}
      bannerUrl={config.bannerUrl}
      rewardText={config.rewardText}
    />
  )
  const code = (
    <div className="wallet-card-code">
      <FakeQr />
      <span>{SAMPLE_CODE}</span>
    </div>
  )

  if (platform === 'iphone') {
    return (
      <figure className="wallet-card wallet-card-iphone" style={{ background: config.bgColor, color: fg }}>
        <div className="wallet-card-iphone-header">
          {wide ?? (
            <>
              {logo}
              <span className="wallet-card-issuer">{name}</span>
            </>
          )}
          <span className="wallet-card-iphone-points">
            <span className="wallet-card-label">Sellos</span>
            <span className="wallet-card-value">{balance}</span>
          </span>
        </div>
        {stampsImage}
        <div className="wallet-card-iphone-fields">
          <span className="wallet-card-label">Tu progreso</span>
          <span className="wallet-card-value">{proximityText(config, stamps)}</span>
        </div>
        {code}
        <figcaption className="sr-only">Vista previa de la tarjeta en Apple Wallet</figcaption>
      </figure>
    )
  }

  return (
    <figure className="wallet-card" style={{ background: config.bgColor, color: fg }}>
      <div className="wallet-card-header">
        {wide ?? (
          <>
            {logo}
            <span className="wallet-card-issuer">{name}</span>
          </>
        )}
      </div>
      <p className="wallet-card-title">{PROGRAM_NAME}</p>
      {code}
      <div className="wallet-card-points">
        <span className="wallet-card-label">Sellos</span>
        <span className="wallet-card-value">{balance}</span>
      </div>
      {stampsImage}
      <figcaption className="sr-only">Vista previa de la tarjeta en Google Wallet</figcaption>
    </figure>
  )
}

// Selector "Android / iPhone" para la vista previa.
export function PlatformToggle({ value, onChange }: { value: WalletPlatform; onChange: (p: WalletPlatform) => void }) {
  return (
    <div className="segmented" role="group" aria-label="Ver la tarjeta en">
      {(
        [
          ['android', 'Android'],
          ['iphone', 'iPhone'],
        ] as const
      ).map(([id, label]) => (
        <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </div>
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
