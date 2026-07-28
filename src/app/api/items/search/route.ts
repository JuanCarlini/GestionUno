import { NextRequest, NextResponse } from "next/server"
import { ItemService } from "@/services"
import { handleRouteError } from "@/lib/route/handle-route-error"

// GET /api/items/search?query=texto - Buscar items por nombre o descripción
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("query")

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Query de búsqueda requerido" },
        { status: 400 }
      )
    }

    const items = await ItemService.search(query.trim())
    
    return NextResponse.json(items || [])
  } catch (error) {
    return handleRouteError(error, "GET /api/items/search")
  }
}
