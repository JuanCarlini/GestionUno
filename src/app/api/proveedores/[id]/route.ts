import { NextRequest, NextResponse } from "next/server"
import { ProveedorService } from "@/services"
import { requirePermission } from "@/lib/auth/permissions-server"
import { UpdateProveedorSchema } from "@/shared/validation/proveedor-validation"
import { parseId } from "@/lib/route/parse-id"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { getByIdRoute } from "@/lib/route/crud-route"

interface Params {
  params: Promise<{
    id: string
  }>
}

export const GET = getByIdRoute({
  autorizar: () => requirePermission("proveedores", "ver"),
  getById: (id) => ProveedorService.getById(id),
  noEncontrado: "Proveedor no encontrado",
  contexto: "GET /api/proveedores/[id]",
})

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { error: authError } = await requirePermission("proveedores", "crear")
    if (authError) return authError

    const id = parseId((await params).id)
    const body = await request.json()
    const data = UpdateProveedorSchema.parse(body) // whitelist de campos
    const updatedProveedor = await ProveedorService.update(id, data)

    if (!updatedProveedor) {
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })
    }

    return NextResponse.json(updatedProveedor)
  } catch (error) {
    return handleRouteError(error, "PUT /api/proveedores/[id]")
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { error: authError } = await requirePermission("proveedores", "crear")
    if (authError) return authError

    const id = parseId((await params).id)
    const success = await ProveedorService.delete(id)

    if (!success) {
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ message: "Proveedor eliminado correctamente" })
  } catch (error) {
    return handleRouteError(error, "DELETE /api/proveedores/[id]")
  }
}
