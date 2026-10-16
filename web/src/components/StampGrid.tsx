import { useId, useState } from 'react'
import { CHECK_ICON, rewardBadge, stampIconById } from '../lib/stampIcons'
import { APP_NAME } from '../lib/urls'
import StampIconSvg from './StampIconSvg'

// Mismo tamaño que la imagen "hero" de Google Wallet (1032×336).
// MISMA disposición que functions/src/images/stamps.ts: si cambia una, cambiar la otra.
const W = 1032
const H = 336
const PAD = 28
// Espacio reservado abajo para la firma de la marca (igual que el backend).
const MARK_H = 34

type Props = {
  total: number
  filled: number
  bgColor: string
  textColor: string
  stampIconId?: string
  stampIconUrl?: string
  bannerUrl?: string
  rewardText?: string // define el texto del último sello (rewardBadge)
}

export default function StampGrid({ total, filled, bgColor, textColor, stampIconId, stampIconUrl, bannerUrl, rewardText }: Props) {
  const badge = rewardBadge(rewardText)
  // useId puede traer caracteres que no sirven dentro de url(#…).
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const rows = total <= 8 ? 1 : 2
  const cols = Math.ceil(total / rows)
  const cellW = (W - PAD * 2) / cols
  const cellH = (H - PAD * 2 - MARK_H) / rows
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
          <rect x={PAD / 2} y={PAD} width={W - PAD} height={rows * cellH + MARK_H} rx={r * 0.6} fill={bgColor} fillOpacity={0.82} />
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
        // Imagen propia: ocupa casi todo el sello (queda un aro fino). Igual que functions/src/images/stamps.ts.
        const imageSize = r * 1.84

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
                fontSize={r * (badge.length <= 3 ? 0.55 : 0.4)}
              >
                {badge}
              </text>
            ) : (
              isFilled &&
              (stampIconUrl ? (
                <>
                  <clipPath id={`${uid}-${i}`}>
                    <circle cx={cx} cy={cy} r={imageSize / 2} />
                  </clipPath>
                  <image
                    href={stampIconUrl}
                    x={cx - imageSize / 2}
                    y={cy - imageSize / 2}
                    width={imageSize}
                    height={imageSize}
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
      <BrandMark cx={W / 2} cy={PAD + rows * cellH + MARK_H * 0.55} color={textColor} />
    </svg>
  )
}

// Firma de la marca: "Creada con ☺ Sellito", mascota en contorno, un solo color (el del texto), centrada.
// Misma forma que brandMark() en functions/src/images/stamps.ts: los textos se anclan a la mascota
// (fin y comienzo) para que el espacio a cada lado sea exacto.
function BrandMark({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  const size = 16
  const r = size * 0.62
  const gap = size * 0.3
  const charW = size * 0.5
  const before = 'Creada con'
  const after = APP_NAME
  const total = before.length * charW + gap + r * 2 + gap + after.length * charW
  const ix = cx - total / 2 + before.length * charW + gap + r
  const textProps = { y: cy + size * 0.36, fill: color, fontFamily: 'Fredoka, system-ui, sans-serif', fontWeight: 600, fontSize: size }
  return (
    <g opacity={0.85}>
      <text x={ix - r - gap} textAnchor="end" {...textProps}>{before}</text>
      <circle cx={ix} cy={cy} r={r - 0.8} fill="none" stroke={color} strokeWidth={1.6} />
      <circle cx={ix - r * 0.32} cy={cy - r * 0.18} r={r * 0.11} fill={color} />
      <circle cx={ix + r * 0.32} cy={cy - r * 0.18} r={r * 0.11} fill={color} />
      <path
        d={`M${ix - r * 0.4} ${cy + r * 0.15} Q${ix} ${cy + r * 0.6} ${ix + r * 0.4} ${cy + r * 0.15}`}
        fill="none"
        stroke={color}
        strokeWidth={r * 0.14}
        strokeLinecap="round"
      />
      <text x={ix + r + gap} textAnchor="start" {...textProps}>{after}</text>
    </g>
  )
}
