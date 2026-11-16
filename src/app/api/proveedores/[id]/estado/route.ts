import { NextRequest, NextResponse } from "next/server"
import { ProveedorService } from "@/services"
import { requirePermission } from "@/lib/auth/permissions-server"
import { EstadoProveedor } from "@/models"
import { parseId } from "@/lib/route/parse-id"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { respuestaError } from "@/lib/route/respuesta-error"
import { CambiarActivoSchema } from "@/shared/validation/estado-validation"
import { AuditService } from "@/lib/audit/audit.service"
import type { IdParams } from "@/lib/route/params"

// PATCH /api/proveedores/[id]/estado — body { activo: boolean }.
//
// Reemplaza PATCH /activar y PATCH /suspender, que eran dos rutas gemelas para el mismo
// cambio. "Suspender" se materializa como inactivo: el enum de la DB solo tiene
// activo/inactivo.
export async function PATCH(request: NextRequest, { params }: IdParams) {
  try {
    // proveedores:aprobar cubre suspender, activar y borrar (solo supervisor+).
    const { error: authError, user } = await requirePermission("proveedores", "aprobar")
    if (authError) return authError

    const id = parseId((await params).id)
    const { activo } = CambiarActivoSchema.parse(await request.json())

    const proveedor = await ProveedorService.update(id, {
      estado: activo ? EstadoProveedor.ACTIVO : EstadoProveedor.INACTIVO,
    })

    if (!proveedor) {
      return respuestaError(404, "Proveedor no encontrado")
    }

    await AuditService.registrar({
      usuarioId: user!.id,
      tabla: "gu_proveedores",
      registroId: id,
      accion: activo ? "activar" : "desactivar",
      detalle: `Proveedor ${proveedor.nombre ?? id} ${activo ? "activado" : "desactivado (inactivo)"}`,
    })

    return NextResponse.json(proveedor)
  } catch (error) {
    return handleRouteError(error, "PATCH /api/proveedores/[id]/estado")
  }
}
