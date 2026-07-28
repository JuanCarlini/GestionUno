import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/permissions-server"
import { RolService } from "@/services/rol.service"
import { AuditService } from "@/lib/audit/audit.service"
import { handleRouteError } from "@/lib/route/handle-route-error"

// GET /api/admin/roles - Catálogo de roles con cantidad de usuarios (solo admin)
export async function GET() {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const roles = await RolService.getAll()
    return NextResponse.json(roles)
  } catch (error) {
    return handleRouteError(error, "GET /api/admin/roles")
  }
}

// POST /api/admin/roles - Crear rol
export async function POST(request: NextRequest) {
  try {
    const { error: authError, user } = await requireAdmin()
    if (authError) return authError

    const { nombre, descripcion, permisos } = await request.json()
    if (!nombre?.trim()) {
      return NextResponse.json({ error: "El nombre del rol es requerido" }, { status: 400 })
    }

    const nuevo = await RolService.create({ nombre, descripcion, permisos })

    await AuditService.registrar({
      usuarioId: user!.id,
      tabla: "gu_roles",
      registroId: nuevo.id,
      accion: "crear",
      detalle: `Rol "${nuevo.nombre}" creado`,
    })

    return NextResponse.json(nuevo, { status: 201 })
  } catch (error) {
    return handleRouteError(error, "POST /api/admin/roles")
  }
}
