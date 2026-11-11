import { createClient } from "@/lib/supabase/service"

// Repositorio de las dos fuentes de auditoría: solo I/O.
//   gu_auditoria → bitácora de operaciones con usuario, la escribe la app (el JWT identifica
//                  quién hizo qué). `accion` es texto libre.
//   gu_audit_log → control de cambios con valores anteriores y nuevos, lo escriben los
//                  triggers. `accion` es el enum audit_accion.
// La validación del filtro y el armado de la fila para la pantalla viven en AuditService.

const TABLE_BITACORA = "gu_auditoria"
const TABLE_CAMBIOS = "gu_audit_log"

// Tope de filas de las dos consultas: la pantalla de /admin/auditoria no paginaba y sin
// límite una tabla con meses de historia se traía todo.
const LIMITE = 500

export interface FiltroAuditoria {
  usuarioId?: string | null
  tabla?: string | null
  accion?: string | null
  desde?: string | null // YYYY-MM-DD
  hasta?: string | null // YYYY-MM-DD
}

export interface FilaBitacora {
  usuarioId: number
  tabla: string
  registroId: number
  accion: string
  detalle?: string | null
}

export class AuditoriaRepository {
  static async insertBitacora(fila: FilaBitacora): Promise<void> {
    const supabase = createClient()
    const { error } = await supabase.from(TABLE_BITACORA).insert({
      tabla_origen: fila.tabla,
      registro_id: fila.registroId,
      usuario_id: fila.usuarioId,
      accion: fila.accion,
      motivo_cambio: fila.detalle ?? null,
    })
    if (error) throw error
  }

  static async findBitacora(f: FiltroAuditoria): Promise<Record<string, unknown>[]> {
    const supabase = createClient()
    let q = supabase
      .from(TABLE_BITACORA)
      .select(
        "id, tabla_origen, registro_id, usuario_id, accion, motivo_cambio, fecha_cambio, gu_usuario(nombre, email)"
      )
      .order("fecha_cambio", { ascending: false })
      .limit(LIMITE)

    if (f.usuarioId) q = q.eq("usuario_id", Number(f.usuarioId))
    if (f.tabla) q = q.eq("tabla_origen", f.tabla)
    if (f.accion) q = q.eq("accion", f.accion)
    if (f.desde) q = q.gte("fecha_cambio", `${f.desde}T00:00:00`)
    if (f.hasta) q = q.lte("fecha_cambio", `${f.hasta}T23:59:59`)

    const { data, error } = await q
    if (error) throw error
    return (data as Record<string, unknown>[]) || []
  }

  // `accion` llega ya validada contra el enum: acá no se reinterpreta.
  static async findCambios(f: FiltroAuditoria): Promise<Record<string, unknown>[]> {
    const supabase = createClient()
    let q = supabase
      .from(TABLE_CAMBIOS)
      .select(
        "id, tabla_afectada, registro_id, usuario_id, accion, datos_anteriores, datos_nuevos, created_at, gu_usuario(nombre, email)"
      )
      .order("created_at", { ascending: false })
      .limit(LIMITE)

    if (f.usuarioId) q = q.eq("usuario_id", Number(f.usuarioId))
    if (f.tabla) q = q.eq("tabla_afectada", f.tabla)
    if (f.accion) q = q.eq("accion", f.accion as never)
    if (f.desde) q = q.gte("created_at", `${f.desde}T00:00:00`)
    if (f.hasta) q = q.lte("created_at", `${f.hasta}T23:59:59`)

    const { data, error } = await q
    if (error) throw error
    return (data as Record<string, unknown>[]) || []
  }
}
