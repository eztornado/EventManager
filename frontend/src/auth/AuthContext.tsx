import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Center, Loader } from '@mantine/core'
import { api, setToken } from '../api/client'
import type { SessionUser } from '../types'

interface AuthContextValue {
  user: SessionUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<SessionUser>
  logout: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const current = await api.get<SessionUser>('/admin/auth/me')
      setUser(current)
    } catch {
      logout()
    }
  }, [logout])

  useEffect(() => {
    const stored = localStorage.getItem('eventmanager_token')
    if (!stored) {
      setLoading(false)
      return
    }
    refresh().finally(() => setLoading(false))
  }, [refresh])

  useEffect(() => {
    window.addEventListener('eventmanager:unauthorized', logout)
    return () => window.removeEventListener('eventmanager:unauthorized', logout)
  }, [logout])

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post<{ token: string; user: SessionUser }>('/admin/auth/login', {
      email,
      password,
    })
    setToken(response.token)
    setUser(response.user)
    return response.user
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh }),
    [user, loading, login, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    )
  }
  if (!user) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}
