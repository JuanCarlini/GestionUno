import { NextRequest, NextResponse } from "next/server"
import { OrdenCompraService } from "@/services"
import { CreateOrdenCompraLineaSchema } from "@/shared/validation/orden-compra-validation"
import { requirePermission } from "@/lib/auth/permissions-server"
import { parseId } from "@/lib/route/parse-id"
import { handleRouteError } from "@/lib/route/handle-route-error"
import type { IdParams } from "@/lib/route/params"

// GET /api/ordenes-compra/[id]/lineas - Líneas con el item del catálogo y su avance certificado
export async function GET(request: NextRequest, { params }: IdParams) {
  try {
    const { error: authError } = await requirePermission("ordenes_compra", "ver")
    if (authError) return authError

    const ordenId = parseId((await params).id)

    const [lineas, rollups] = await Promise.all([
      OrdenCompraService.getLinesWithItems(ordenId),
      OrdenCompraService.getLocRollups(ordenId),
    ])

    // El avance por línea lo publica v_loc_rollup (solo certificaciones aprobadas).
    const porLinea = new Map(rollups.map((r) => [r.linea_oc_id, r]))
    return NextResponse.json(
      lineas.map((l) => ({
        ...l,
        unidades_certificadas: Number(porLinea.get(l.id)?.unidades_certificadas ?? 0),
        unidades_pendientes: Number(porLinea.get(l.id)?.unidades_pendientes ?? l.cantidad),
        estado_certificacion: porLinea.get(l.id)?.estado_certificacion ?? "sin",
      }))
    )
  } catch (error) {
    return handleRouteError(error, "GET /api/ordenes-compra/[id]/lineas")
  }
}

// POST /api/ordenes-compra/[id]/lineas - Agregar línea eligiendo un item del catálogo.
// Sin precio_unitario_neto se hereda el del proveedor; con precio, se guarda para él.
export async function POST(request: NextRequest, { params }: IdParams) {
  try {
    const { error: authError } = await requirePermission("ordenes_compra", "crear")
    if (authError) return authError

    const ordenId = parseId((await params).id)
    const validatedData = CreateOrdenCompraLineaSchema.parse(await request.json())

    const nuevaLinea = await OrdenCompraService.addLinea(ordenId, validatedData)
    return NextResponse.json(nuevaLinea, { status: 201 })
  } catch (error) {
    return handleRouteError(error, "POST /api/ordenes-compra/[id]/lineas")
  }
}
