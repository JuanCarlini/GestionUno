import { NextResponse } from "next/server"
import { FacturaService } from "@/services/factura.service"
import { CreateFacturaSchema } from "@/shared/validation/factura-validation"
import { requirePermission } from "@/lib/auth/permissions-server"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { createRoute } from "@/lib/route/crud-route"

// GET /api/facturas - Lista con el rollup de pago (v_factura_rollup)
export async function GET() {
  try {
    const { error: authError } = await requirePermission("facturas", "ver")
    if (authError) return authError
    return NextResponse.json(await FacturaService.getAll())
  } catch (error) {
    return handleRouteError(error, "GET /api/facturas")
  }
}

// POST /api/facturas - Crear factura (líneas + imputaciones a certs aprobadas).
// 422 si una imputación viola fn_check_imputacion (cert no aprobada o Σ > total de líneas).
export const POST = createRoute({
  autorizar: () => requirePermission("facturas", "crear"),
  schema: CreateFacturaSchema,
  crear: (data) => FacturaService.create(data),
  audit: {
    tabla: "gu_facturas",
    detalle: (f) => `Factura ${f.numero_factura ?? f.id} creada`,
  },
  contexto: "POST /api/facturas",
})
