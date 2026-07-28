import { NextResponse } from "next/server"
import { ItemService } from "@/services"
import { handleRouteError } from "@/lib/route/handle-route-error"

// GET /api/items/categorias - Obtener todas las categorías únicas
export async function GET() {
  try {
    const categorias = await ItemService.getCategorias()
    return NextResponse.json(categorias || [])
  } catch (error) {
    return handleRouteError(error, "GET /api/items/categorias")
  }
}
