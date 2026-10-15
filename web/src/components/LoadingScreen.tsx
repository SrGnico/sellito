import loader from '../assets/loader.svg'

// Pantalla de carga completa. El texto dice qué se carga ("Cargando tu tarjeta…"), nunca solo "Cargando…".
export default function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="loading-screen" role="status">
      <img src={loader} alt="" width={96} height={96} />
      <span>{label}</span>
    </div>
  )
}
