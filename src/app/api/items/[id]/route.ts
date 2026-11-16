import { NextRequest, NextResponse } from "next/server"
import { ItemService } from "@/services"
import { UpdateItemSchema } from "@/shared/validation/item-validation"
import { requirePermission } from "@/lib/auth/permissions-server"
import { parseId } from "@/lib/route/parse-id"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { getByIdRoute } from "@/lib/route/crud-route"
import type { IdParams } from "@/lib/route/params"
import { respuestaError } from "@/lib/route/respuesta-error"
import { CACHE_CATALOGO } from "@/lib/route/cache"

// GET /api/items/[id] - Obtener un item por ID
export const GET = getByIdRoute({
  autorizar: () => requirePermission("items", "ver"),
  getById: (id) => ItemService.getById(id),
  noEncontrado: "Item no encontrado",
  contexto: "GET /api/items/[id]",
  cache: CACHE_CATALOGO,
})

// PUT /api/items/[id] - Actualizar un item
export async function PUT(request: NextRequest, { params }: IdParams) {
  try {
    const { error: authError } = await requirePermission("items", "crear")
    if (authError) return authError

    const itemId = parseId((await params).id)
    const validatedData = UpdateItemSchema.parse(await request.json())

    const itemActualizado = await ItemService.update(itemId, validatedData)
    if (!itemActualizado) {
      return respuestaError(404, "Item no encontrado")
    }

    return NextResponse.json(itemActualizado)
  } catch (error) {
    return handleRouteError(error, "PUT /api/items/[id]")
  }
}

// DELETE /api/items/[id] - Soft delete de un item
export async function DELETE(request: NextRequest, { params }: IdParams) {
  try {
    const { error: authError } = await requirePermission("items", "crear")
    if (authError) return authError

    const itemId = parseId((await params).id)

    // Soft delete: el 409 de "está en uso" lo tira el service, igual que en PATCH /estado.
    const item = await ItemService.setActivo(itemId, false)
    if (!item) {
      return respuestaError(404, "Item no encontrado")
    }

    return NextResponse.json({ message: "Item marcado como inactivo correctamente" })
  } catch (error) {
    return handleRouteError(error, "DELETE /api/items/[id]")
  }
}
