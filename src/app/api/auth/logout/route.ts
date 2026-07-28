import { NextResponse } from "next/server"
import { removeAuthCookie, getCurrentUser } from '@/lib/auth/auth.cookies'
import { AuditService } from '@/lib/audit/audit.service'

export async function POST() {
  try {
    // Bitácora: cierre de sesión — resolver el usuario ANTES de borrar la cookie
    const user = await getCurrentUser()
    if (user) {
      await AuditService.registrar({
        usuarioId: user.id,
        tabla: 'sesion',
        registroId: user.id,
        accion: 'logout',
        detalle: `Cierre de sesión: ${user.email}`,
      })
    }

    // Eliminar cookie de autenticación
    await removeAuthCookie()

    return NextResponse.json({
      message: "Sesión cerrada exitosamente"
    })
    
  } catch (error) {
    console.error('Error en logout:', error)
    return NextResponse.json(
      { error: "Error al cerrar sesión" },
      { status: 500 }
    )
  }
}
