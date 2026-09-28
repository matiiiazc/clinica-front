import { useContext } from 'react'

import { AuthContext, type AuthContextValue } from './auth-context'

export function useAuth(): AuthContextValue {
  const contexto = useContext(AuthContext)
  if (!contexto) throw new Error('useAuth hay que usarlo dentro de <AuthProvider>')
  return contexto
}
