import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/auth/permissions-server"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { REPORTES } from "@/services/reporte.service"

interface Params {
  params: Promise<{
    reporte: string
  }>
}

// Una sola ruta con despacho por registro: seis rutas casi idénticas serían el mismo
// archivo copiado. El segmento viene del usuario y se resuelve contra REPORTES.
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { error: authError } = await requirePermission("reportes", "ver")
    if (authError) return authError

    const { reporte: nombre } = await params

    // hasOwn y no un truthy check: REPORTES["constructor"] devolvería el constructor
    // de Object y la llamada terminaría en un 500 en vez de un 404.
    if (!Object.hasOwn(REPORTES, nombre)) {
      return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 })
    }

    // Los filtros se pasan crudos: el servicio los valida con Zod y un rango inválido
    // sale como 400 por el traductor de errores, no como un resultado vacío.
    const filtros = Object.fromEntries(request.nextUrl.searchParams)
    const resultado = await REPORTES[nombre].generar(filtros)

    // Datos vivos: cachearlos mostraría cifras viejas sin que nada lo indique.
    return NextResponse.json(resultado, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return handleRouteError(error, "GET /api/reportes/[reporte]")
  }
}
