import { NextRequest, NextResponse } from "next/server"
import { OrdenPagoService } from "@/services"
import { AgregarFacturaSchema } from "@/shared/validation/orden-pago-validation"
import { requirePermission } from "@/lib/auth/permissions-server"
import { parseId } from "@/lib/route/parse-id"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { HttpError } from "@/lib/route/http-error"

interface Params {
  params: Promise<{ id: string }>
}

// POST /api/ordenes-pago/[id]/facturas - Agregar una factura a pagar.
// 422 si la factura no está finalizada o no es del mismo proveedor/moneda (fn_lop_factura_pagable).
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { error: authError } = await requirePermission("ordenes_pago", "crear")
    if (authError) return authError

    const opId = parseId((await params).id)
    const { factura_id, monto } = AgregarFacturaSchema.parse(await request.json())

    const linea = await OrdenPagoService.agregarFactura(opId, { factura_id, monto })
    return NextResponse.json(linea, { status: 201 })
  } catch (error) {
    return handleRouteError(error, "POST /api/ordenes-pago/[id]/facturas")
  }
}

// DELETE /api/ordenes-pago/[id]/facturas?facturaId=N
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { error: authError } = await requirePermission("ordenes_pago", "crear")
    if (authError) return authError

    const opId = parseId((await params).id)
    const facturaParam = request.nextUrl.searchParams.get("facturaId")
    if (!facturaParam) throw new HttpError(400, "Falta el parámetro facturaId")

    const ok = await OrdenPagoService.quitarFactura(opId, parseId(facturaParam))
    if (!ok) return NextResponse.json({ error: "Línea no encontrada" }, { status: 404 })

    return NextResponse.json({ message: "Factura quitada de la orden de pago" })
  } catch (error) {
    return handleRouteError(error, "DELETE /api/ordenes-pago/[id]/facturas")
  }
}
