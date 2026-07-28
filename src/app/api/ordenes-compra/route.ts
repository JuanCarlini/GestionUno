import { NextResponse } from "next/server"
import { OrdenCompraService } from "@/services"
import { CreateOrdenCompraSchema } from "@/shared/validation/orden-compra-validation"
import { requirePermission } from "@/lib/auth/permissions-server"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { createRoute } from "@/lib/route/crud-route"

// GET /api/ordenes-compra - Lista con el rollup de certificación (leído de v_oc_rollup).
// Gateado por permiso: 'ordenes_compra:ver' (los 4 roles del sistema lo tienen por el seed).
export async function GET() {
  try {
    const { error: authError } = await requirePermission("ordenes_compra", "ver")
    if (authError) return authError

    return NextResponse.json(await OrdenCompraService.getAll())
  } catch (error) {
    return handleRouteError(error, "GET /api/ordenes-compra")
  }
}

// POST /api/ordenes-compra - Crear nueva orden (nace en borrador, la DB le pone el número)
export const POST = createRoute({
  autorizar: () => requirePermission("ordenes_compra", "crear"),
  schema: CreateOrdenCompraSchema,
  crear: (data) => OrdenCompraService.create(data),
  audit: { tabla: "gu_ordenesdecompra", detalle: (oc) => `Orden de compra ${oc.numero_oc} creada` },
  contexto: "POST /api/ordenes-compra",
})
