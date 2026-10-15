import { useState } from 'react'
import type { CardConfig } from '../lib/cardDesign'
import CardPreview from './CardPreview'

// "Y el tuyo": la persona escribe el nombre de su negocio y ve su tarjeta al instante. Cada letra suma
// un sello (el guiño), y el botón la lleva a crear la cuenta con el nombre y el color ya cargados
// (Login guarda ?negocio y ?color; los usa CreateBusiness en el panel).
const COLORS = ['#FF9EC4', '#FFD166', '#7BD389', '#8EC5FF', '#C9A7FF', '#12372A']
const TOTAL = 6

export default function YourCard({ signupUrl, onCta }: { signupUrl: string; onCta: () => void }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const clean = name.trim()
  const filled = Math.min(clean.replace(/\s/g, '').length, TOTAL)
  const config: CardConfig = {
    name: clean || 'Tu negocio',
    bgColor: color,
    stampIconId: 'estrella',
    stampsRequired: TOTAL,
    rewardText: 'lo que vos quieras',
    itemSingular: '',
    itemPlural: '',
    conditions: '',
    askFields: { name: true, phone: true, email: false },
    locations: [],
    proximityEnabled: false,
  }
  const params = new URLSearchParams({ color })
  if (clean) params.set('negocio', clean)
  const href = `${signupUrl}&${params}`

  return (
    <div className="rubro-example your-card">
      <div className="rubro-card">
        <CardPreview config={config} filled={filled} />
      </div>
      <div className="rubro-text">
        <h3>Probá con el tuyo</h3>
        <div>
          <label className="label" htmlFor="your-name">¿Cómo se llama tu negocio?</label>
          <input id="your-name" className="input" maxLength={40} placeholder="Ej.: Lo de Marta" value={name} autoComplete="organization"
            onChange={(e) => setName(e.target.value)} />
          <p className="help" aria-live="polite">
            {filled === 0
              ? 'Escribilo y mirá la tarjeta. Cada letra, un sello.'
              : filled < TOTAL
                ? `${filled} de ${TOTAL} sellos… seguí escribiendo 😄`
                : `¡Tarjeta completa! Así de fácil van a juntar sellos tus clientes en ${clean}.`}
          </p>
        </div>
        <div className="swatches" role="radiogroup" aria-label="Color de la tarjeta">
          {COLORS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} className="swatch" style={{ background: c }}
              onClick={() => setColor(c)} />
          ))}
        </div>
        <a className="btn btn-lg btn-primary" href={href} onClick={onCta}>
          {clean ? `Crear la tarjeta de ${clean}` : 'Crear mi tarjeta'}
        </a>
        <p className="help" style={{ margin: 0 }}>Diseñarla es gratis. Tu nombre y tu color ya quedan cargados.</p>
      </div>
    </div>
  )
}
