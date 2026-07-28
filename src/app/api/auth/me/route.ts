import { NextResponse } from "next/server"
import { getCurrentUser } from '@/lib/auth/auth.cookies'
import { RolRepository } from '@/repositories/rol.repository'

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      )
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
    return NextResponse.json(
      { error: "Error al obtener usuario" },
      { status: 500 }
    )
  }
}
