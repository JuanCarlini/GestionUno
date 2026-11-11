import { createClient } from "@/lib/supabase/service"

// El cliente tipado no conoce las funciones de la base: database.types.ts las genera a partir
// de lo que la API expone, y a estas se les revoca EXECUTE para anon y authenticated a
// propósito (solo las llama la service key). Así que el tipo se afirma acá, igual que hace
// reporte.repository con las rpc_reporte_*.
type ClienteRpc<T> = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: T | null; error: unknown }>
}

// Invoca una función que devuelve UNA fila (las altas transaccionales). Un `data` vacío sin
// error no debería pasar: significaría que la función no devolvió el documento creado, y
// seguir con `null` convertiría eso en un 500 lejos de la causa.
export async function rpcFila<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const supabase = createClient() as unknown as ClienteRpc<T>
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  if (data === null) throw new Error(`${fn} no devolvió la fila creada`)
  return data
}
