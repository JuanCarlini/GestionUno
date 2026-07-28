import { Shield, Eye, User, Users } from "lucide-react"

// Tipos y mapas de presentación compartidos por la página de administración de
// usuarios y sus dos tabs (usuarios / roles). Extraídos al partir el god-component.

export interface UserData {
  id: string
  email: string
  nombre: string
  rol: string
  rol_id: number
  estado: "activo" | "inactivo"
  created_at: string
}

export interface RolData {
  id: number
  nombre: string
  descripcion: string | null
  usuarios: number
  es_sistema: boolean
  permisos: string[]
}

export const roleLabels: Record<string, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  usuario: "Usuario",
  readonly: "Solo Lectura",
}

export const roleIcons: Record<string, any> = {
  admin: Shield,
  supervisor: Eye,
  usuario: User,
  readonly: Users,
}

export const roleColors: Record<string, string> = {
  admin: "text-red-600",
  supervisor: "text-blue-600",
  usuario: "text-green-600",
  readonly: "text-muted-foreground",
}
