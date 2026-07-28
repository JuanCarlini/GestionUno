import { NextRequest, NextResponse } from "next/server"
import { ItemService } from "@/services"
import { UpdateItemSchema } from "@/shared/validation/item-validation"
import { requirePermission } from "@/lib/auth/permissions-server"
import { parseId } from "@/lib/route/parse-id"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { getByIdRoute } from "@/lib/route/crud-route"

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/items/[id] - Obtener un item por ID
export const GET = getByIdRoute({
  getById: (id) => ItemService.getById(id),
  noEncontrado: "Item no encontrado",
  contexto: "GET /api/items/[id]",
})

// PUT /api/items/[id] - Actualizar un item
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { error: authError } = await requirePermission("items", "crear")
    if (authError) return authError

    const itemId = parseId((await params).id)
    const validatedData = UpdateItemSchema.parse(await request.json())

    const itemActualizado = await ItemService.update(itemId, validatedData)
    if (!itemActualizado) {
      return NextResponse.json({ error: "Item no encontrado" }, { status: 404 })
    }

    return NextResponse.json(itemActualizado)
  } catch (error) {
    return handleRouteError(error, "PUT /api/items/[id]")
  }
}

// DELETE /api/items/[id] - Soft delete de un item
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { error: authError } = await requirePermission("items", "crear")
    if (authError) return authError

    const itemId = parseId((await params).id)

    // Un item usado en alguna OC no se borra: se marca inactivo
    if (await ItemService.isInUse(itemId)) {
      return NextResponse.json(
        {
          error: "No se puede eliminar el item porque está siendo utilizado en órdenes de compra",
          suggestion: "Puedes marcarlo como inactivo en su lugar",
        },
        { status: 409 }
      )
    }

    const success = await ItemService.softDelete(itemId)
    if (!success) {
      return NextResponse.json({ error: "Item no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ message: "Item marcado como inactivo correctamente" })
  } catch (error) {
    return handleRouteError(error, "DELETE /api/items/[id]")
  }
}
