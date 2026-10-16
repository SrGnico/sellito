import { useState } from 'react'
import { isHexColor } from '../lib/color'

const COLORS = ['#FF9EC4', '#FFD166', '#7BD389', '#8EC5FF', '#C9A7FF', '#FF8A65', '#12372A', '#2B2B2B']

// Cuentagotas del navegador (Chrome y Edge en computadora). Donde no existe, el botón no se muestra.
type EyeDropperApi = { open: () => Promise<{ sRGBHex: string }> }
const EyeDropperCtor = (window as unknown as { EyeDropper?: new () => EyeDropperApi }).EyeDropper

// "abc123" o "#abc123" → "#ABC123"; si no es un color válido, null.
function normalize(v: string): string | null {
  const s = v.trim()
  const hex = s.startsWith('#') ? s : `#${s}`
  return isHexColor(hex) ? hex.toUpperCase() : null
}

// Color de la tarjeta: muestras rápidas, selector libre, código exacto de la marca y cuentagotas.
export default function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value)
  const [lastValue, setLastValue] = useState(value)
  // Si el color cambia desde una muestra o el selector, se actualiza el código.
  if (value !== lastValue) {
    setLastValue(value)
    setText(value)
  }
  const invalid = normalize(text) === null

  async function pick() {
    if (!EyeDropperCtor) return
    try {
      const { sRGBHex } = await new EyeDropperCtor().open()
      const hex = normalize(sRGBHex)
      if (hex) onChange(hex)
    } catch {
      // canceló con Esc
    }
  }

  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <legend className="label">Color de la tarjeta</legend>
      <div className="swatches">
        {COLORS.map((c) => (
          <label key={c} className="swatch" style={{ background: c }} title={c}>
            <input className="sr-only" type="radio" name="card-color" checked={value.toUpperCase() === c} onChange={() => onChange(c)} />
            <span className="sr-only">{c}</span>
          </label>
        ))}
        <label className="swatch swatch-custom" title="Otro color">
          <input type="color" aria-label="Elegir otro color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} />
        </label>
      </div>
      <div className="color-row">
        <span className="color-chip" style={{ background: value }} aria-hidden="true" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <label className="sr-only" htmlFor="card-color-hex">Código del color</label>
          <input
            id="card-color-hex"
            className="input"
            value={text}
            maxLength={7}
            spellCheck={false}
            autoCapitalize="characters"
            placeholder="#FF9EC4"
            onChange={(e) => {
              setText(e.target.value)
              const hex = normalize(e.target.value)
              if (hex) onChange(hex)
            }}
            aria-invalid={invalid ? true : undefined}
            aria-describedby="card-color-help"
          />
        </div>
        {EyeDropperCtor && (
          <button className="btn" type="button" onClick={pick} title="Tomar un color de la pantalla">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m2 22 1-1h3l9-9" /><path d="M3 21v-3l9-9" /><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
            </svg>
            Cuentagotas
          </button>
        )}
      </div>
      <p className={invalid ? 'help help-error' : 'help'} id="card-color-help" style={{ margin: 0 }}>
        {invalid
          ? 'Usá el código de 6 caracteres, por ejemplo #FF9EC4.'
          : `Si tu marca tiene un color exacto, pegá su código${EyeDropperCtor ? ' o tomalo con el cuentagotas desde tu logo o tu web' : ''}. El texto y los sellos se ponen blancos u oscuros solos para que siempre se lean.`}
      </p>
    </fieldset>
  )
}
