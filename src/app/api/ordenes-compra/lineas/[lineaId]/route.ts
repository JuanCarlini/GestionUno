import { NextRequest, NextResponse } from "next/server"
import { OrdenCompraService } from "@/services"
import { requirePermission } from "@/lib/auth/permissions-server"
import { parseId } from "@/lib/route/parse-id"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { z } from "zod"

interface Params {
  params: Promise<{ lineaId: string }>
}

// Los totales de la línea NO se aceptan del cliente: los recalcula el service.
const UpdateLineaSchema = z.object({
  descripcion: z.string().optional(),
  cantidad: z.number().positive("Cantidad debe ser mayor a 0").optional(),
  precio_unitario_neto: z.number().nonnegative("Precio no puede ser negativo").optional(),
  iva_porcentaje: z.number().min(0).max(100).optional(),
})

// PUT /api/ordenes-compra/lineas/[lineaId] - Actualizar una línea.
// Recalcula los totales de la línea y de la cabecera. 422 si la OC ya no es editable.
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { error: authError } = await requirePermission("ordenes_compra", "crear")
    if (authError) return authError

    const lineaId = parseId((await params).lineaId)
    const validatedData = UpdateLineaSchema.parse(await request.json())

    const lineaActualizada = await OrdenCompraService.updateLine(lineaId, validatedData)
    if (!lineaActualizada) {
      return NextResponse.json({ error: "Línea no encontrada" }, { status: 404 })
    }

    return NextResponse.json(lineaActualizada)
  } catch (error) {
    return handleRouteError(error, "PUT /api/ordenes-compra/lineas/[lineaId]")
  }
}

// DELETE /api/ordenes-compra/lineas/[lineaId] - Eliminar una línea (recalcula la cabecera)
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { error: authError } = await requirePermission("ordenes_compra", "crear")
    if (authError) return authError

    const lineaId = parseId((await params).lineaId)

    const success = await OrdenCompraService.deleteLine(lineaId)
    if (!success) {
      return NextResponse.json({ error: "Línea no encontrada" }, { status: 404 })
    }

    return NextResponse.json({ message: "Línea eliminada correctamente" })
  } catch (error) {
    return handleRouteError(error, "DELETE /api/ordenes-compra/lineas/[lineaId]")
  }
}
