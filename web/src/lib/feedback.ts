// Avisos cortos ("✓ Guardado") y confirmaciones antes de acciones delicadas. El estado vive acá y lo
// dibuja <Feedback /> (components/Feedback.tsx), montado una vez en App.

export type Toast = { id: number; text: string; tone: 'ok' | 'err' | 'brand' }
export type Confirm = {
  title: string
  text?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  resolve: (ok: boolean) => void
}

type State = { toasts: Toast[]; confirm: Confirm | null }

let state: State = { toasts: [], confirm: null }
const listeners = new Set<() => void>()
let nextId = 1

function set(next: Partial<State>) {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

export const feedbackStore = {
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  get: () => state,
}

export function toast(text: string, tone: Toast['tone'] = 'ok', ms = 3500) {
  const id = nextId++
  set({ toasts: [...state.toasts, { id, text, tone }].slice(-3) })
  setTimeout(() => dismissToast(id), ms)
}

export function dismissToast(id: number) {
  set({ toasts: state.toasts.filter((t) => t.id !== id) })
}

// const ok = await confirmar({ title: '¿Canjear el premio?', confirmLabel: 'Canjear' })
export function confirmar(opts: Omit<Confirm, 'resolve'>): Promise<boolean> {
  state.confirm?.resolve(false)
  return new Promise((resolve) => set({ confirm: { ...opts, resolve } }))
}

export function closeConfirm(ok: boolean) {
  state.confirm?.resolve(ok)
  set({ confirm: null })
}
