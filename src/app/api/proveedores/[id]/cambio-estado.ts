import { NextRequest, NextResponse } from "next/server"
import { ProveedorService } from "@/services"
import { requirePermission } from "@/lib/auth/permissions-server"
import { EstadoProveedor } from "@/models"
import { parseId } from "@/lib/route/parse-id"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { AuditService, type AccionAuditoria } from "@/lib/audit/audit.service"
import type { IdParams } from "@/lib/route/params"

// activar/ y suspender/ son la misma operación con distinto destino: un handler
// parametrizado en vez de dos archivos gemelos de 40 líneas.
export function patchEstadoProveedor(cfg: {
  estado: EstadoProveedor
  accion: AccionAuditoria
  detalle: (nombre: string) => string
  contexto: string
}) {
  return async function PATCH(_request: NextRequest, { params }: IdParams) {
    try {
      const { error: authError, user } = await requirePermission("proveedores", "aprobar")
      if (authError) return authError

      const id = parseId((await params).id)
      const proveedor = await ProveedorService.update(id, { estado: cfg.estado })

      if (!proveedor) {
        return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })
      }

      await AuditService.registrar({
        usuarioId: user!.id,
        tabla: "gu_proveedores",
        registroId: id,
        accion: cfg.accion,
        detalle: cfg.detalle(proveedor.nombre ?? String(id)),
      })

      return NextResponse.json(proveedor)
    } catch (error) {
      return handleRouteError(error, cfg.contexto)
    }
  }
}
