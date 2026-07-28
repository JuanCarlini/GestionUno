import { NextRequest, NextResponse } from "next/server"
import { CajaService } from "@/services"
import { CreateCajaSchema } from "@/shared/validation/caja-validation"
import { requireAdmin } from "@/lib/auth/permissions-server"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { createRoute } from "@/lib/route/crud-route"

// GET /api/cajas - Cajas activas (la OP las necesita; autentica el middleware)
export async function GET(request: NextRequest) {
  try {
    const incluirInactivas = request.nextUrl.searchParams.get("incluirInactivas") === "true"
    const cajas = incluirInactivas
      ? await CajaService.getAllIncludingInactive()
      : await CajaService.getAll()

    return NextResponse.json(cajas)
  } catch (error) {
    return handleRouteError(error, "GET /api/cajas")
  }
}

// POST /api/cajas - Crear caja (solo admin: es catálogo)
export const POST = createRoute({
  autorizar: () => requireAdmin(),
  schema: CreateCajaSchema,
  crear: (data) => CajaService.create(data),
  audit: {
    tabla: "gu_cajas",
    detalle: (c) => `Caja ${c.nombre} (${c.tipo}, ${c.moneda}) creada`,
  },
  contexto: "POST /api/cajas",
})
