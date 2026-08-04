// Wrapper de fetch del cliente (el browser no habla con Supabase: RLS niega anon). Lo usan
// los hooks de lista; los formularios todavía hacen fetch a mano — deuda de consistencia.
// Si la respuesta no es ok, lanza Error con el `{ error }` del body para mostrarlo en un toast.
export async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Error ${res.status}`)
  }
  return res.json()
}
