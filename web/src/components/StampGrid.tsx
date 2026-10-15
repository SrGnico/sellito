import { useId, useState } from 'react'
import { CHECK_ICON, stampIconById } from '../lib/stampIcons'
import StampIconSvg from './StampIconSvg'

// Mismo tamaño que la imagen "hero" de Google Wallet (1032×336).
// MISMA disposición que functions/src/images/stamps.ts: si cambia una, cambiar la otra.
const W = 1032
const H = 336
const PAD = 28

type Props = {
  total: number
  filled: number
  bgColor: string
  textColor: string
  stampIconId?: string
  stampIconUrl?: string
  bannerUrl?: string
}

export default function StampGrid({ total, filled, bgColor, textColor, stampIconId, stampIconUrl, bannerUrl }: Props) {
  // useId puede traer caracteres que no sirven dentro de url(#…).
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const rows = total <= 8 ? 1 : 2
  const cols = Math.ceil(total / rows)
  const cellW = (W - PAD * 2) / cols
  const cellH = (H - PAD * 2) / rows
  const r = Math.min(Math.min(cellW, cellH) * 0.4, 62)
  const icon = stampIconById(stampIconId) ?? CHECK_ICON

  // Cuando suben los sellos, los nuevos se "estampan" (.stamp-in de sellito-motion.css).
  const [prevFilled, setPrevFilled] = useState(filled)
  const [animateFrom, setAnimateFrom] = useState<number | null>(null)
  if (filled !== prevFilled) {
    setAnimateFrom(filled > prevFilled ? prevFilled : null)
    setPrevFilled(filled)
  }

  return (
    <svg className="stamp-grid" viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} role="img" aria-label={`${filled} de ${total} sellos`}>
      <rect width={W} height={H} fill={bgColor} />
      {bannerUrl && (
        <>
          <image href={bannerUrl} width={W} height={H} preserveAspectRatio="xMidYMid slice" />
          {/* Franja del color de fondo para que los sellos se lean sobre cualquier foto. */}
          <rect x={PAD / 2} y={PAD} width={W - PAD} height={rows * cellH} rx={r * 0.6} fill={bgColor} fillOpacity={0.82} />
        </>
      )}
      {Array.from({ length: total }, (_, i) => {
        const row = Math.floor(i / cols)
        // La última fila se centra si queda incompleta.
        const inRow = row === rows - 1 ? total - cols * (rows - 1) : cols
        const col = i - row * cols
        const cx = PAD + (W - PAD * 2 - inRow * cellW) / 2 + cellW * (col + 0.5)
        const cy = PAD + cellH * (row + 0.5)
        const isFilled = i < filled
        const isLast = i === total - 1
        const iconSize = r * 1.15

        const isNew = isFilled && animateFrom !== null && i >= animateFrom

        return (
          <g key={isNew ? `${i}-${filled}` : i} className={isNew ? 'stamp-in' : undefined}>
            {isFilled ? (
              <circle cx={cx} cy={cy} r={r} fill={textColor} />
            ) : (
              <circle
                cx={cx}
                cy={cy}
                r={r - r * 0.05}
                fill={bgColor}
                fillOpacity={0.85}
                stroke={textColor}
                strokeWidth={r * 0.09}
                strokeDasharray={`${r * 0.22} ${r * 0.16}`}
              />
            )}
            {isLast ? (
              <text
                x={cx}
                y={cy + r * 0.14}
                textAnchor="middle"
                fill={isFilled ? bgColor : textColor}
                fontFamily="Fredoka, system-ui, sans-serif"
                fontWeight={600}
                fontSize={r * 0.4}
              >
                GRATIS
              </text>
            ) : (
              isFilled &&
              (stampIconUrl ? (
                <>
                  <clipPath id={`${uid}-${i}`}>
                    <circle cx={cx} cy={cy} r={iconSize / 2} />
                  </clipPath>
                  <image
                    href={stampIconUrl}
                    x={cx - iconSize / 2}
                    y={cy - iconSize / 2}
                    width={iconSize}
                    height={iconSize}
                    clipPath={`url(#${uid}-${i})`}
                    preserveAspectRatio="xMidYMid meet"
                  />
                </>
              ) : (
                <StampIconSvg
                  icon={icon}
                  x={cx - iconSize / 2}
                  y={cy - iconSize / 2}
                  width={iconSize}
                  height={iconSize}
                  stroke={bgColor}
                />
              ))
            )}
          </g>
        )
      })}
    </svg>
  )
}
