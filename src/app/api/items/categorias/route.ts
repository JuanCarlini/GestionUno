import { NextResponse } from "next/server"
import { ItemService } from "@/services"
import { requirePermission } from "@/lib/auth/permissions-server"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { CACHE_CATALOGO, headersCache } from "@/lib/route/cache"

// GET /api/items/categorias - Obtener todas las categorías únicas
export async function GET() {
  try {
    const { error } = await requirePermission("items", "ver")
    if (error) return error

    const categorias = await ItemService.getCategorias()
    return NextResponse.json(categorias || [], { headers: headersCache(CACHE_CATALOGO) })
  } catch (error) {
    return handleRouteError(error, "GET /api/items/categorias")
  }
}
