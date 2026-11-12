import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/permissions-server"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { generarContrato } from "@/lib/openapi/contrato"
import { CACHE_NUNCA, headersCache } from "@/lib/route/cache"

// GET /api/openapi.json — el contrato de la API, solo para admin.
//
// Solo admin y no público: el contrato es el mapa completo de la superficie de ataque (cada
// ruta, cada parámetro, qué permiso exige). Es un cliente interno, no una API pública; el día
// que haya consumidores de afuera, esta es la decisión a revisar.
export async function GET() {
  try {
    const { error } = await requireAdmin()
    if (error) return error

    return NextResponse.json(generarContrato(), { headers: headersCache(CACHE_NUNCA) })
  } catch (error) {
    return handleRouteError(error, "GET /api/openapi.json")
  }
}
