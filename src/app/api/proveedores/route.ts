import { NextResponse } from "next/server"
import { ProveedorService } from "@/services"
import { requirePermission } from "@/lib/auth/permissions-server"
import { CreateProveedorSchema } from "@/shared/validation/proveedor-validation"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { createRoute } from "@/lib/route/crud-route"

export async function GET() {
  try {
    const { error: authError } = await requirePermission("proveedores", "ver")
    if (authError) return authError
    const proveedores = await ProveedorService.getAll()
    return NextResponse.json(proveedores || [])
  } catch (error) {
    return handleRouteError(error, "GET /api/proveedores")
  }
}

export const POST = createRoute({
  autorizar: () => requirePermission("proveedores", "crear"),
  schema: CreateProveedorSchema, // whitelist de campos
  crear: (data) => ProveedorService.create(data),
  audit: { tabla: "gu_proveedores", detalle: (p) => `Proveedor ${p.nombre} creado` },
  contexto: "POST /api/proveedores",
})
