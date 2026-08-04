import { NextRequest, NextResponse } from "next/server"
import { FacturaService } from "@/services/factura.service"
import { ImputarSchema } from "@/shared/validation/factura-validation"
import { requirePermission } from "@/lib/auth/permissions-server"
import { parseId } from "@/lib/route/parse-id"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { HttpError } from "@/lib/route/http-error"
import type { IdParams } from "@/lib/route/params"

// POST /api/facturas/[id]/imputaciones - Imputar certificaciones (con monto) a la factura.
// Solo en borrador. 422 si la cert no está aprobada o si Σ supera el total de líneas.
export async function POST(request: NextRequest, { params }: IdParams) {
  try {
    const { error: authError } = await requirePermission("facturas", "crear")
    if (authError) return authError

    const facturaId = parseId((await params).id)
    const { imputaciones } = ImputarSchema.parse(await request.json())

    await FacturaService.imputar(facturaId, imputaciones)
    return NextResponse.json({ message: "Imputaciones agregadas" }, { status: 201 })
  } catch (error) {
    return handleRouteError(error, "POST /api/facturas/[id]/imputaciones")
  }
}

// DELETE /api/facturas/[id]/imputaciones?certificacionId=N - Quitar una imputación (borrador)
export async function DELETE(request: NextRequest, { params }: IdParams) {
  try {
    const { error: authError } = await requirePermission("facturas", "crear")
    if (authError) return authError

    const facturaId = parseId((await params).id)
    const certParam = request.nextUrl.searchParams.get("certificacionId")
    if (!certParam) throw new HttpError(400, "Falta el parámetro certificacionId")

    const ok = await FacturaService.desimputar(facturaId, parseId(certParam))
    if (!ok) return NextResponse.json({ error: "Imputación no encontrada" }, { status: 404 })

    return NextResponse.json({ message: "Imputación eliminada" })
  } catch (error) {
    return handleRouteError(error, "DELETE /api/facturas/[id]/imputaciones")
  }
}
