"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { AuthUser } from "@/models"
import { tienePermiso } from "@/shared/permissions"

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  refreshUser: () => Promise<void>
  // ¿El usuario tiene el permiso `modulo:accion`? (admin siempre; el resto por su matriz). La
  // fuente de verdad es el backend (requirePermission); esto solo oculta botones que darían 403.
  puede: (modulo: string, accion: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error("Error al obtener usuario:", error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshUser()
  }, [])

  const puede = (modulo: string, accion: string) =>
    user ? tienePermiso(user.rol, user.permisos ?? [], modulo, accion) : false

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, puede }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth debe ser usado dentro de un AuthProvider")
  }
  return context
}
