import { NextResponse } from "next/server"
import { CertificacionService } from "@/services/certificacion.service"
import { CreateCertificacionSchema } from "@/shared/validation/certificacion-validation"
import { requirePermission } from "@/lib/auth/permissions-server"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { createRoute } from "@/lib/route/crud-route"

// GET /api/certificaciones - Lista con el rollup de facturación (v_cert_rollup)
export async function GET() {
  try {
    const { error: authError } = await requirePermission("certificaciones", "ver")
    if (authError) return authError
    return NextResponse.json(await CertificacionService.getAll())
  } catch (error) {
    return handleRouteError(error, "GET /api/certificaciones")
  }
}

// POST /api/certificaciones - Certificar contra UNA orden de compra aprobada.
// 422 si la OC no está aprobada o si el trigger del 100% rechaza el avance.
export const POST = createRoute({
  autorizar: () => requirePermission("certificaciones", "crear"),
  schema: CreateCertificacionSchema,
  crear: (data) => CertificacionService.create(data),
  audit: { tabla: "gu_certificaciones", detalle: (c) => `Certificación ${c.numero_cert} creada` },
  contexto: "POST /api/certificaciones",
})
