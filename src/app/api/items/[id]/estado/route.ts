import { NextRequest, NextResponse } from "next/server"
import { ItemService } from "@/services"
import { requirePermission } from "@/lib/auth/permissions-server"
import { parseId } from "@/lib/route/parse-id"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { respuestaError } from "@/lib/route/respuesta-error"
import { CambiarActivoSchema } from "@/shared/validation/estado-validation"
import type { IdParams } from "@/lib/route/params"

// PATCH /api/items/[id]/estado — body { activo: boolean }.
//
// Reemplaza POST /api/items/[id]/reactivate, que además era un POST para un cambio de estado
// idempotente. Desactivar por acá es lo mismo que el DELETE del recurso (soft delete); el
// DELETE queda porque es el verbo que espera quien piensa en borrar, y los dos pasan por el
// mismo chequeo de uso en órdenes de compra.
export async function PATCH(request: NextRequest, { params }: IdParams) {
  try {
    const { error: authError } = await requirePermission("items", "crear")
    if (authError) return authError

    const itemId = parseId((await params).id)
    const { activo } = CambiarActivoSchema.parse(await request.json())

    // El 409 de "está en uso" lo tira el service (ItemService.setActivo).
    const item = await ItemService.setActivo(itemId, activo)
    if (!item) {
      return respuestaError(404, "Item no encontrado")
    }

    return NextResponse.json(item)
  } catch (error) {
    return handleRouteError(error, "PATCH /api/items/[id]/estado")
  }
}
