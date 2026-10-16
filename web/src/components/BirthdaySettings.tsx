import { birthdayPreview } from '../lib/birthday'
import type { BirthdayConfig } from '../lib/types'

// Regalo de cumpleaños (panel → Tarjeta y asistente). Prenderlo también pide el cumpleaños al cliente.
type Props = {
  value: BirthdayConfig
  onChange: (c: BirthdayConfig) => void
  askBirthday: boolean
  onAskBirthday: (ask: boolean) => void
  businessName: string
  rewardText: string
}

export default function BirthdaySettings({ value, onChange, askBirthday, onAskBirthday, businessName, rewardText }: Props) {
  const set = (patch: Partial<BirthdayConfig>) => onChange({ ...value, ...patch })
  const preview = birthdayPreview(value, businessName, rewardText)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="switch-row">
        <button
          className="switch"
          type="button"
          role="switch"
          aria-checked={value.enabled}
          aria-labelledby="bday-label"
          onClick={() => {
            set({ enabled: !value.enabled })
            if (!value.enabled && !askBirthday) onAskBirthday(true)
          }}
        >
          <span className="knob" />
        </button>
        <span id="bday-label">Saludar a mis clientes en su cumpleaños</span>
      </div>
      {!value.enabled && (
        <p className="help" style={{ margin: 0 }}>
          Le pedimos el cumpleaños al sumarse (opcional) y la tarjeta lo saluda sola. Si querés, con un regalo: es un motivo más para
          que vuelva.
        </p>
      )}

      {value.enabled && (
        <>
          <fieldset className="choice-group">
            <legend className="label">¿Qué le regalás?</legend>
            <label><input type="radio" name="bday-reward" checked={value.reward === 'same'} onChange={() => set({ reward: 'same' })} />
              El mismo premio de la tarjeta{rewardText.trim() ? ` (${rewardText.trim()})` : ''}</label>
            <label><input type="radio" name="bday-reward" checked={value.reward === 'custom'} onChange={() => set({ reward: 'custom' })} />
              Otro regalo</label>
            {value.reward === 'custom' && (
              <input className="input" aria-label="Regalo de cumpleaños" maxLength={60} placeholder="Ej.: un postre, 20% de descuento"
                value={value.rewardText ?? ''} onChange={(e) => set({ rewardText: e.target.value })} />
            )}
            <label><input type="radio" name="bday-reward" checked={value.reward === 'none'} onChange={() => set({ reward: 'none' })} />
              Nada, solo saludarlo</label>
          </fieldset>

          {value.reward !== 'none' && (
            <fieldset className="choice-group">
              <legend className="label">¿Cuándo lo puede usar?</legend>
              <label><input type="radio" name="bday-when" checked={value.when === 'day'} onChange={() => set({ when: 'day' })} />
                El día de su cumpleaños</label>
              <label><input type="radio" name="bday-when" checked={value.when === 'month'} onChange={() => set({ when: 'month' })} />
                Todo el mes de su cumpleaños</label>
            </fieldset>
          )}

          <div className="switch-row">
            <button className="switch" type="button" role="switch" aria-checked={value.notify} aria-labelledby="bday-notify-label"
              onClick={() => set({ notify: !value.notify })}>
              <span className="knob" />
            </button>
            <span id="bday-notify-label">
              Avisarle al celular {value.reward !== 'none' && value.when === 'month' ? 'el 1° de su mes' : 'ese día'}
            </span>
          </div>
          {value.notify && (
            <div className="lockscreen-preview" aria-label="Así le llega el saludo">
              <span className="lockscreen-icon" aria-hidden="true" />
              <div>
                <strong>{preview.title}</strong>
                <span>{preview.body}</span>
              </div>
            </div>
          )}
          <p className="help" style={{ margin: 0 }}>
            El aviso le llega solo a quien aceptó recibir novedades. En el escáner vas a ver “🎂 Está de cumple” y entregás el regalo
            con un toque (una vez por año, sin tocar sus sellos).
          </p>
          {!askBirthday && (
            <div className="alert alert-warn" role="alert">
              <span className="alert-text">
                Para esto hay que pedir el cumpleaños. <button className="link-button" type="button" onClick={() => onAskBirthday(true)}>Pedirlo</button>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
