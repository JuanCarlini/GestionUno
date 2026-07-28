import { NextRequest, NextResponse } from "next/server"
import { ProveedorService } from "@/services"
import { requirePermission } from "@/lib/auth/permissions-server"
import { EstadoProveedor } from "@/models"
import { parseId } from "@/lib/route/parse-id"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { AuditService } from "@/lib/audit/audit.service"

interface Params {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { error: authError, user } = await requirePermission("proveedores", "crear")
    if (authError) return authError

    const id = parseId((await params).id)
    // "Desactivar" un proveedor lo pone en inactivo (el enum solo tiene activo/inactivo).
    const proveedor = await ProveedorService.update(id, { estado: EstadoProveedor.INACTIVO })

    if (!proveedor) {
      return NextResponse.json(
        { error: "Proveedor no encontrado" },
        { status: 404 }
      )
    }

    await AuditService.registrar({
      usuarioId: user!.id,
      tabla: "gu_proveedores",
      registroId: id,
      accion: "desactivar",
      detalle: `Proveedor ${proveedor.nombre ?? id} desactivado (inactivo)`,
    })

    return NextResponse.json(proveedor)
  } catch (error) {
    return handleRouteError(error, "PATCH /api/proveedores/[id]/suspender")
  }
}
