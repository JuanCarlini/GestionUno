import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/auth/permissions-server"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { HttpError } from "@/lib/route/http-error"
import { REPORTES } from "@/services/reporte.service"
import { ESTRATEGIAS } from "@/lib/export/registro"

interface Params {
  params: Promise<{
    reporte: string
  }>
}

// ExcelJS usa Buffer y APIs de Node: en el runtime edge no corre.
export const runtime = "nodejs"

const TOPE_FILAS = 50_000

// Hermana de la ruta de datos: mismo despacho por registro, misma autorización.
// Acá se agrega la generación del archivo, siempre recalculando desde la base.
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { error: authError } = await requirePermission("reportes", "ver")
    if (authError) return authError

    const { reporte: nombre } = await params

    // hasOwn y no un truthy check: mismo motivo que la ruta de datos.
    if (!Object.hasOwn(REPORTES, nombre)) {
      return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 })
    }

    const formato = request.nextUrl.searchParams.get("formato") ?? "xlsx"
    if (!Object.hasOwn(ESTRATEGIAS, formato)) {
      return NextResponse.json({ error: "Formato no soportado" }, { status: 400 })
    }

    // Se recalcula acá, nunca se reciben filas del cliente: sino cualquiera podría
    // fabricar un archivo con los números que quisiera y sacarlo con apariencia oficial.
    const filtros = Object.fromEntries(request.nextUrl.searchParams)
    const { tablas } = await REPORTES[nombre].generar(filtros)

    // El tamaño recién se conoce después de consultar; no hay forma de anticiparlo antes.
    const excedida = tablas.some((t) => t.filas.length > TOPE_FILAS)
    if (excedida) {
      throw new HttpError(400, `El reporte supera las ${TOPE_FILAS} filas. Acotá el período o filtrá por proveedor.`)
    }

    const estrategia = ESTRATEGIAS[formato]
    const contenido = await estrategia.generar(tablas)

    // La clave del registro (no el título) es siempre ASCII: evita nombres de archivo
    // rotos por acentos en Content-Disposition.
    const fecha = new Date().toISOString().slice(0, 10)
    const archivo = `reporte-${nombre}_${fecha}.${estrategia.extension}`

    return new NextResponse(new Uint8Array(contenido), {
      headers: {
        "Content-Type": estrategia.mime,
        "Content-Disposition": `attachment; filename="${archivo}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    return handleRouteError(error, "GET /api/reportes/[reporte]/export")
  }
}
