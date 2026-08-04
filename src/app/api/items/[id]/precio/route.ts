import { NextRequest, NextResponse } from "next/server"
import { ItemPrecioRepository } from "@/repositories/item-precio.repository"
import { requirePermission } from "@/lib/auth/permissions-server"
import { parseId } from "@/lib/route/parse-id"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { HttpError } from "@/lib/route/http-error"

// GET /api/items/[id]/precio?proveedorId=N — precio de este item PARA ese proveedor.
// 404 si el par no tiene precio todavía: la UI pide uno y se da de alta al vuelo.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requirePermission("items", "ver")
    if (error) return error

    const itemId = parseId((await params).id)
    const proveedorParam = request.nextUrl.searchParams.get("proveedorId")
    if (!proveedorParam) throw new HttpError(400, "Falta el parámetro proveedorId")
    const proveedorId = parseId(proveedorParam)

    const precio = await ItemPrecioRepository.findPrecio(itemId, proveedorId)
    if (precio === null) {
      return NextResponse.json(
        { error: "El item no tiene precio cargado para este proveedor" },
        { status: 404 }
      )
    }

    return NextResponse.json({ item_id: itemId, proveedor_id: proveedorId, precio })
  } catch (error) {
    return handleRouteError(error, "GET /api/items/[id]/precio")
  }
}
