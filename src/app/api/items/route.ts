import { NextRequest, NextResponse } from "next/server"
import { ItemService } from "@/services"
import { CreateItemSchema } from "@/shared/validation/item-validation"
import { requirePermission } from "@/lib/auth/permissions-server"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { createRoute } from "@/lib/route/crud-route"

// GET /api/items - Obtener todos los items activos
// Query params opcionales: ?includeInactive=true, ?categoria=string
export async function GET(request: NextRequest) {
  try {
    const { error } = await requirePermission("items", "ver")
    if (error) return error

    const searchParams = request.nextUrl.searchParams
    const includeInactive = searchParams.get("includeInactive") === "true"
    const categoria = searchParams.get("categoria")

    let items

    if (categoria) {
      items = await ItemService.getByCategoria(categoria)
    } else if (includeInactive) {
      items = await ItemService.getAllIncludingInactive()
    } else {
      items = await ItemService.getAll()
    }

    return NextResponse.json(items || [])
  } catch (error) {
    return handleRouteError(error, "GET /api/items")
  }
}

// POST /api/items - Crear nuevo item (created_by lo pone el server desde el JWT)
export const POST = createRoute({
  autorizar: () => requirePermission("items", "crear"),
  schema: CreateItemSchema,
  crear: (data, user) => ItemService.create(data, user.id),
  contexto: "POST /api/items",
})
