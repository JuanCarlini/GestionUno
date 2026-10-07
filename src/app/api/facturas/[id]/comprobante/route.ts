import { NextRequest, NextResponse } from "next/server"
import { FacturaService } from "@/services/factura.service"
import { requirePermission } from "@/lib/auth/permissions-server"
import { parseId } from "@/lib/route/parse-id"
import { handleRouteError } from "@/lib/route/handle-route-error"
import { HttpError } from "@/lib/route/http-error"
import { AuditService } from "@/lib/audit/audit.service"
import { subirComprobante, urlComprobante, MAX_BYTES } from "@/lib/storage/comprobantes"
import type { IdParams } from "@/lib/route/params"

/**
 * PDF del comprobante de una factura, guardado en Supabase Storage (servicio externo).
 *   GET  200 { url } firmada por 5 min · 404 factura o PDF inexistente · 503 Storage caído
 *   POST 200 subido · 400 no es PDF / muy grande · 404 factura · 503 Storage caído
 */
async function facturaExistente(id: number) {
  const factura = await FacturaService.getById(id)
  if (!factura) throw new HttpError(404, "Factura no encontrada")
  return factura
}

export async function GET(_request: NextRequest, { params }: IdParams) {
  try {
    const { error: authError } = await requirePermission("facturas", "ver")
    if (authError) return authError

    const id = parseId((await params).id)
    await facturaExistente(id)

    const url = await urlComprobante(id)
    if (!url) return NextResponse.json({ error: "La factura no tiene PDF adjunto" }, { status: 404 })
    return NextResponse.json({ url })
  } catch (error) {
    return handleRouteError(error, "GET /api/facturas/[id]/comprobante")
  }
}

export async function POST(request: NextRequest, { params }: IdParams) {
  try {
    const { error: authError, user } = await requirePermission("facturas", "crear")
    if (authError) return authError

    const id = parseId((await params).id)
    const factura = await facturaExistente(id)

    // Se valida ANTES de llamar al servicio externo: un archivo inválido es culpa del cliente (400).
    const archivo = (await request.formData()).get("archivo")
    if (!(archivo instanceof File)) throw new HttpError(400, "Falta el archivo (campo 'archivo')")
    if (archivo.type !== "application/pdf") throw new HttpError(400, "El comprobante tiene que ser un PDF")
    if (archivo.size === 0 || archivo.size > MAX_BYTES) {
      throw new HttpError(400, "El PDF tiene que pesar entre 1 byte y 4 MB")
    }

    await subirComprobante(id, await archivo.arrayBuffer())

    await AuditService.registrar({
      usuarioId: user!.id,
      tabla: "gu_facturas",
      registroId: id,
      accion: "actualizar",
      detalle: `Factura ${factura.numero_factura ?? id}: PDF del comprobante adjuntado`,
    })

    return NextResponse.json({ message: "Comprobante adjuntado" })
  } catch (error) {
    return handleRouteError(error, "POST /api/facturas/[id]/comprobante")
  }
}
