import { useEffect, useRef, useSyncExternalStore } from 'react'
import { closeConfirm, dismissToast, feedbackStore } from '../lib/feedback'

// Dibuja los avisos y el diálogo de confirmación (lib/feedback.ts). Va una sola vez, en App.
export default function Feedback() {
  const { toasts, confirm } = useSyncExternalStore(feedbackStore.subscribe, feedbackStore.get)
  const confirmBtn = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!confirm) return
    const previous = document.activeElement as HTMLElement | null
    confirmBtn.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeConfirm(false)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [confirm])

  return (
    <>
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <span aria-hidden="true" className="toast-icon">{t.tone === 'err' ? '!' : '✓'}</span>
            <span style={{ flex: 1 }}>{t.text}</span>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => dismissToast(t.id)} aria-label="Cerrar aviso">
              ✕
            </button>
          </div>
        ))}
      </div>
      {confirm && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && closeConfirm(false)}>
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby={confirm.text ? 'confirm-text' : undefined}>
            <h3 id="confirm-title">{confirm.title}</h3>
            {confirm.text && <p id="confirm-text" style={{ margin: 0, color: 'var(--text-soft)' }}>{confirm.text}</p>}
            <div className="dialog-actions">
              <button className="btn" type="button" onClick={() => closeConfirm(false)}>{confirm.cancelLabel ?? 'Cancelar'}</button>
              <button ref={confirmBtn} className={`btn ${confirm.danger ? 'btn-danger' : 'btn-primary'}`} type="button" onClick={() => closeConfirm(true)}>
                {confirm.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
