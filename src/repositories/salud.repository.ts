import { createClient } from "@/lib/supabase/service"

// Chequeo de vida de la base para /api/health.
//
// No es un `select 1` literal porque supabase-js habla PostgREST, no SQL: la consulta más
// barata que igual recorre el camino completo (HTTP -> PostgREST -> Postgres) es leer una
// columna de una tabla chica con limit 1. gu_roles siempre tiene filas (los 4 roles del
// sistema) y no contiene nada sensible.
export const SaludRepository = {
  async pingBase(): Promise<void> {
    const supabase = createClient()
    const { error } = await supabase.from("gu_roles").select("id").limit(1)
    if (error) throw error
  },
}
