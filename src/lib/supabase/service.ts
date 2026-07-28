import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Cliente SERVER-ONLY con service_role (bypasea RLS): única puerta a la base, y la key sin
// prefijo NEXT_PUBLIC_ nunca llega al bundle. Singleton memoizado: supabase-js es stateless.
type ServiceClient = ReturnType<typeof createSupabaseClient<Database>>

let cliente: ServiceClient | null = null

export function createClient(): ServiceClient {
  if (cliente) return cliente

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL no está configurada.')
  }
  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY no está configurada. Copiala del dashboard de Supabase (Settings → API) a .env.local.'
    )
  }

  cliente = createSupabaseClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cliente
}
