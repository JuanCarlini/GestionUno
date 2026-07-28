import { NextRequest, NextResponse } from "next/server"
import { parseId } from "./parse-id"
import { handleRouteError } from "./handle-route-error"
import { AuditService, type AccionAuditoria } from "@/lib/audit/audit.service"

// Template Method de las rutas PATCH /[id]/estado (OC/CE/FACT/OP): algoritmo fijo, cada ruta
// rellena los huecos. `autorizar` es función (no rol) para mezclar RBAC y grupo de rol sin ramificar.

// Shape mínimo que devuelven requireRole/requirePermission: alcanza con user.id para auditar.
type Autorizacion = Promise<{ error: NextResponse | null; user: { id: number } | null }>

interface EstadoRouteConfig<E extends string, T> {
  schema: { parse: (data: unknown) => { estado: E } }
  autorizar: (estado: E) => Autorizacion
  cambiarEstado: (id: number, estado: E) => Promise<T>
  tabla: string
  accion: (estado: E) => AccionAuditoria
  detalle: (entidad: T, estado: E) => string
  contexto: string
}

export function estadoRoute<E extends string, T>(cfg: EstadoRouteConfig<E, T>) {
  return async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    try {
      const id = parseId((await params).id)
      const { estado } = cfg.schema.parse(await request.json())

      // El permiso/rol depende del DESTINO, no del documento.
      const { error: authError, user } = await cfg.autorizar(estado)
      if (authError) return authError

      const entidad = await cfg.cambiarEstado(id, estado)

      await AuditService.registrar({
        usuarioId: user!.id,
        tabla: cfg.tabla,
        registroId: id,
        accion: cfg.accion(estado),
        detalle: cfg.detalle(entidad, estado),
      })

      return NextResponse.json(entidad)
    } catch (error) {
      return handleRouteError(error, cfg.contexto)
    }
  }
}
