import { NextRequest, NextResponse } from "next/server"
import { ItemService } from "@/services"
import { requirePermission } from "@/lib/auth/permissions-server"
import { parseId } from "@/lib/route/parse-id"
import { handleRouteError } from "@/lib/route/handle-route-error"

interface Params {
  params: Promise<{
    id: string
  }>
}

// POST /api/items/[id]/reactivate - Reactivar un item inactivo
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { error: authError } = await requirePermission("items", "crear")
    if (authError) return authError

    const itemId = parseId((await params).id)

    const success = await ItemService.reactivate(itemId)

    if (!success) {
      return NextResponse.json(
        { error: "Item no encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: "Item reactivado correctamente"
    })
  } catch (error) {
    return handleRouteError(error, "POST /api/items/[id]/reactivate")
  }
}
