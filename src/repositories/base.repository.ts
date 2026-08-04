import { createClient } from "@/lib/supabase/service"

// Repo GENÉRICO sobre la tabla: adentro se usa el cliente sin tipar y la seguridad de
// tipos vive en el borde (generics Row/Insert/Update + el export tipado por repo).
type UntypedClient = {
  from: (table: string) => any
}
function db(): UntypedClient {
  return createClient() as unknown as UntypedClient
}

// CRUD genérico para tablas con PK `id`: findAll/insert tiran, findById/update devuelven
// null, delete devuelve bool. Los repos con semántica distinta componen métodos custom aparte.

// PGRST116 = .single() sin filas: el único error que significa "no existe". Cualquier otro
// (constraint, trigger, conexión) sube: tragarlo convertía un 409/422 real en un 404 mentiroso.
export function esSinFilas(error: { code?: string }): boolean {
  return error?.code === "PGRST116"
}
interface BaseRepositoryOptions {
  orderBy?: { column: string; ascending?: boolean }
}

export function createBaseRepository<Row, Insert = Partial<Row>, Update = Partial<Row>>(
  table: string,
  opts: BaseRepositoryOptions = {}
) {
  const order = opts.orderBy ?? { column: "created_at", ascending: false }

  return {
    async findAll(): Promise<Row[]> {
      const supabase = db()
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order(order.column, { ascending: order.ascending ?? false })

      if (error) throw error
      return (data ?? []) as Row[]
    },

    async findById(id: number): Promise<Row | null> {
      const supabase = db()
      const { data, error } = await supabase.from(table).select("*").eq("id", id).single()
      if (error) {
        if (esSinFilas(error)) return null
        throw error
      }
      return data as Row
    },

    async insert(row: Insert): Promise<Row> {
      const supabase = db()
      const { data, error } = await supabase.from(table).insert(row).select().single()
      if (error) throw error
      return data as Row
    },

    async update(id: number, row: Update): Promise<Row | null> {
      const supabase = db()
      const { data, error } = await supabase.from(table).update(row).eq("id", id).select().single()
      if (error) {
        if (esSinFilas(error)) return null
        throw error
      }
      return data as Row
    },

    async delete(id: number): Promise<boolean> {
      const supabase = db()
      const { error } = await supabase.from(table).delete().eq("id", id)
      if (error) throw error
      return true
    },
  }
}
