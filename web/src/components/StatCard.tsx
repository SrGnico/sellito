// Número grande en Fredoka, etiqueta y detalle (SELLITO_DESIGN_SYSTEM.md §7). `value` null = cargando.
export default function StatCard({
  label,
  value,
  detail,
  pink = false,
}: {
  label: string
  value: number | null
  detail?: string
  pink?: boolean
}) {
  return (
    <div className={pink ? 'card card-pink stat-card' : 'card stat-card'}>
      <span className="stat-label">{label}</span>
      {value === null ? (
        <span className="skeleton" style={{ width: 64, height: 40 }} aria-label="Cargando" />
      ) : (
        <span className="stat-value">{value.toLocaleString('es-AR')}</span>
      )}
      {detail && <span className="stat-detail">{detail}</span>}
    </div>
  )
}
