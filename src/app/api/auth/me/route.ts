import { NextResponse } from "next/server"
import { getCurrentUser } from '@/lib/auth/auth.cookies'
import { RolRepository } from '@/repositories/rol.repository'
import { respuestaError } from "@/lib/route/respuesta-error"

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return respuestaError(401, "No autenticado")
    }

    const rol = user.rol_nombre?.toLowerCase() || 'usuario'
    // Permisos del rol para que el cliente gatee botones (mismo criterio que requirePermission).
    const permisos = await RolRepository.findPermisosByNombre(rol)

    // Mapear el usuario al formato esperado por el frontend (models/user.model.ts AuthUser)
    return NextResponse.json({
      user: { id: user.id, email: user.email, nombre: user.nombre, rol, permisos }
    })
    
  } catch (error) {
    console.error('Error al obtener usuario:', error)
    return respuestaError(500, "Error al obtener usuario")
  }
}
