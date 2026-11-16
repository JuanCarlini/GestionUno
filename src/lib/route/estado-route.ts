import { NextRequest, NextResponse } from "next/server"
import { parseId } from "./parse-id"
import { handleRouteError } from "./handle-route-error"
import { HttpError } from "./http-error"
import { AuditService, type AccionAuditoria } from "@/lib/audit/audit.service"

// Escritura concurrente: los cuatro cambiarEstado leen el documento, validan la transicion
// contra el estado leido y despues actualizan. Entre la lectura y el update otro usuario pudo
// mover el documento, y el update a secas pisaba ese cambio (ganaba el ultimo en escribir,
// aunque su transicion ya no fuera valida). Los repos hacen el update condicionado al estado
// leido; si no afecto ninguna fila, el cambio se perdio la carrera y esto lo corta en 409.
export const MENSAJE_ESTADO_DESACTUALIZADO = "El documento cambió mientras lo editabas, recargá"

export function exigirCambioAplicado<T>(fila: T | null): T {
  if (fila === null) throw new HttpError(409, MENSAJE_ESTADO_DESACTUALIZADO)
  return fila
}

// Template Method de las rutas PATCH /[id]/estado (OC/CE/FACT/OP): algoritmo fijo, cada ruta
// rellena los huecos. `autorizar` es función (no rol) para mezclar RBAC y grupo de rol sin ramificar.

// Shape mínimo que devuelven requirePermission/requireAdmin: alcanza con user.id para auditar.
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
