import { useState } from 'react'
import { callable } from '../lib/firebase'
import { MAX_LOCATIONS } from '../lib/proximity'
import type { BusinessLocation } from '../lib/types'
import Spinner from './Spinner'

type GeoResult = { address: string; lat: number; lng: number }
const geocodeAddress = callable<{ businessId: string; query: string }, { results: GeoResult[] }>('geocodeAddress')

const mapLink = (l: { lat: number; lng: number }) => `https://www.openstreetmap.org/?mlat=${l.lat}&mlon=${l.lng}#map=18/${l.lat}/${l.lng}`

// Locales del negocio (máx. 10): se busca la dirección, se elige el resultado y se le pone un nombre.
export default function LocationsEditor({
  businessId,
  value,
  onChange,
}: {
  businessId: string
  value: BusinessLocation[]
  onChange: (locations: BusinessLocation[]) => void
}) {
  const [query, setQuery] = useState('')
  const [label, setLabel] = useState('')
  const [results, setResults] = useState<GeoResult[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const full = value.length >= MAX_LOCATIONS

  // Está dentro del formulario del editor: Enter busca, no guarda la tarjeta.
  async function search() {
    if (query.trim().length < 4) return setError('Escribí la dirección con calle, número y ciudad.')
    setBusy(true)
    setError(null)
    setResults(null)
    try {
      const { results } = (await geocodeAddress({ businessId, query: query.trim() })).data
      if (results.length === 0) setError('No encontramos esa dirección. Probá agregando la ciudad o la provincia.')
      else setResults(results)
    } catch {
      setError('No pudimos buscar la dirección. Intentá de nuevo en unos segundos.')
    } finally {
      setBusy(false)
    }
  }

  function add(r: GeoResult) {
    onChange([...value, { label: label.trim() || `Local ${value.length + 1}`, address: r.address, lat: r.lat, lng: r.lng }])
    setQuery('')
    setLabel('')
    setResults(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {value.length === 0 && <p className="help" style={{ margin: 0 }}>Todavía no cargaste ningún local.</p>}
      {value.map((l, i) => (
        <div key={`${l.lat},${l.lng},${i}`} className="location-row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              className="input"
              value={l.label}
              maxLength={40}
              aria-label={`Nombre del local ${i + 1}`}
              onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
            />
            <p className="help" style={{ margin: '4px 0 0' }}>
              {l.address ?? `${l.lat.toFixed(5)}, ${l.lng.toFixed(5)}`} ·{' '}
              <a href={mapLink(l)} target="_blank" rel="noreferrer">Ver en el mapa</a>
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Quitar ${l.label}`}>
            Quitar
          </button>
        </div>
      ))}

      {full ? (
        <p className="help" style={{ margin: 0 }}>Llegaste al máximo de {MAX_LOCATIONS} locales.</p>
      ) : (
        <div className="location-add">
          <div>
            <label className="label" htmlFor="loc-query">Dirección del local</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="loc-query"
                className="input"
                placeholder="Ej.: Av. Corrientes 1234, CABA"
                value={query}
                maxLength={200}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    search()
                  }
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'loc-error' : undefined}
              />
              <button className="btn" type="button" onClick={search} disabled={busy} aria-busy={busy} style={{ flexShrink: 0 }}>
                {busy ? <Spinner small /> : 'Buscar'}
              </button>
            </div>
            {error && <p className="help help-error" id="loc-error" role="alert">{error}</p>}
          </div>

          {results && (
            <>
              <div>
                <label className="label" htmlFor="loc-label">Nombre (opcional)</label>
                <input id="loc-label" className="input" placeholder="Ej.: Sucursal Palermo" value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} />
              </div>
              <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <legend className="label">¿Cuál es?</legend>
                {results.map((r) => (
                  <div key={`${r.lat},${r.lng}`} className="location-result">
                    <span style={{ flex: 1, fontSize: 'var(--text-sm)' }}>
                      {r.address} · <a href={mapLink(r)} target="_blank" rel="noreferrer">mapa</a>
                    </span>
                    <button className="btn btn-sm btn-secondary" type="button" onClick={() => add(r)}>
                      Agregar
                    </button>
                  </div>
                ))}
              </fieldset>
              <p className="help" style={{ margin: 0 }}>Direcciones de © OpenStreetMap.</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
