import type { User } from 'firebase/auth'
import { createContext, useContext } from 'react'

export type AuthState = { user: User | null; loading: boolean }

export const AuthContext = createContext<AuthState>({ user: null, loading: true })

export function useAuth() {
  return useContext(AuthContext)
}

// Mensajes que dicen qué hacer, no solo qué falló (SELLITO_DESIGN_SYSTEM.md §5).
export function authErrorMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'Ingresá un mail válido.'
    case 'auth/missing-password':
      return 'Ingresá tu contraseña.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'El mail o la contraseña no coinciden. Revisalos e intentá de nuevo.'
    case 'auth/email-already-in-use':
      return 'Ya hay una cuenta con ese mail. Iniciá sesión o recuperá tu contraseña.'
    case 'auth/weak-password':
      return 'Usá una contraseña de al menos 6 caracteres.'
    case 'auth/too-many-requests':
      return 'Hubo muchos intentos. Esperá unos minutos y volvé a probar.'
    case 'auth/network-request-failed':
      return 'No hay conexión. Revisá tu internet e intentá de nuevo.'
    default:
      return 'Algo salió mal. Intentá de nuevo.'
  }
}
