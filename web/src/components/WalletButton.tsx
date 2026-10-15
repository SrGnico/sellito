import appleBadge from '../assets/wallet/add-to-apple-wallet-esmx.svg'
import googleButton from '../assets/wallet/add-to-google-wallet-es419.svg'
import Spinner from './Spinner'

// Botones oficiales para agregar la tarjeta al Wallet (SELLITO_DESIGN_SYSTEM.md §7, WalletButton).
// Sin modificar (guías de marca de Apple y Google): artes oficiales en español latinoamericano,
// 48 px de alto y margen libre alrededor. Con `href` es un link; si no, envía el formulario.
const ART = {
  google: { src: googleButton, label: 'Agregar a la Billetera de Google' },
  apple: { src: appleBadge, label: 'Agregar a Apple Wallet' },
}

type Props = { platform: 'google' | 'apple'; busy?: boolean; href?: string }

export default function WalletButton({ platform, busy = false, href }: Props) {
  const { src, label } = ART[platform]
  const img = <img src={src} alt="" height={48} />
  return (
    <div className="wallet-official">
      {href ? (
        <a className="wallet-official-btn" href={href} aria-label={label}>
          {img}
        </a>
      ) : (
        <button className="wallet-official-btn" type="submit" disabled={busy} aria-busy={busy} aria-label={label}>
          {img}
        </button>
      )}
      {busy && (
        <p role="status" className="help" style={{ margin: 0, justifyContent: 'center' }}>
          <Spinner small /> Creando tu tarjeta…
        </p>
      )}
    </div>
  )
}
