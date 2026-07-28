import { NextRequest, NextResponse } from "next/server"
import { parseId } from "./parse-id"
import { handleRouteError } from "./handle-route-error"
import { AuditService } from "@/lib/audit/audit.service"

// Factories de los dos CRUD uniformes (GET /[id] y POST de colección). NO cubren PUT/DELETE:
// esos divergen (audit condicional, DELETE con isInUse→409) y forzarlos sería una sopa de flags.
//
// Mismo shape { error, user } que devuelven requireRole/requirePermission/requireAdmin.
type Autorizacion = Promise<{ error: NextResponse | null; user: { id: number } | null }>

// ---------- GET /[id] ----------
interface GetByIdConfig<T> {
  autorizar?: () => Autorizacion // opcional: la mayoría se apoya solo en el middleware
  getById: (id: number) => Promise<T | null>
  noEncontrado: string
  contexto: string
}

export function getByIdRoute<T>(cfg: GetByIdConfig<T>) {
  return async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    try {
      if (cfg.autorizar) {
        const { error } = await cfg.autorizar()
        if (error) return error
      }
      const id = parseId((await params).id)
      const entidad = await cfg.getById(id)
      if (!entidad) return NextResponse.json({ error: cfg.noEncontrado }, { status: 404 })
      return NextResponse.json(entidad)
    } catch (error) {
      return handleRouteError(error, cfg.contexto)
    }
  }
}

// ---------- POST (create) de colección ----------
// El estado inicial lo fija el server dentro del service; acá solo se orquesta.
interface CreateConfig<In, Out extends { id: number }> {
  autorizar: () => Autorizacion
  schema: { parse: (data: unknown) => In }
  crear: (data: In, user: { id: number }) => Promise<Out>
  // audit opcional: accion siempre 'crear', registroId = creado.id (fijos); la ruta da tabla + detalle.
  audit?: { tabla: string; detalle: (creado: Out) => string }
  contexto: string
}

export function createRoute<In, Out extends { id: number }>(cfg: CreateConfig<In, Out>) {
  return async function POST(request: NextRequest) {
    try {
      const { error, user } = await cfg.autorizar()
      if (error) return error

      const data = cfg.schema.parse(await request.json())
      const creado = await cfg.crear(data, user!)

      if (cfg.audit) {
        await AuditService.registrarDesdeRequest({
          tabla: cfg.audit.tabla,
          registroId: creado.id,
          accion: "crear",
          detalle: cfg.audit.detalle(creado),
        })
      }

      return NextResponse.json(creado, { status: 201 })
    } catch (error) {
      return handleRouteError(error, cfg.contexto)
    }
  }
}
