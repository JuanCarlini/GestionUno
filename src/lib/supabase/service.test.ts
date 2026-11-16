import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

// El módulo memoiza a nivel de módulo, así que cada test re-importa fresco
// (vi.resetModules) para partir sin instancia cacheada.
describe("createClient (Singleton service_role)", () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...OLD_ENV }
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proyecto.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key-de-prueba"
  })

  afterEach(() => {
    process.env = OLD_ENV
  })

  it("devuelve la MISMA instancia en llamadas repetidas (memoización)", async () => {
    const { createClient } = await import("./service")
    expect(createClient()).toBe(createClient())
  })

  it("fail-fast si falta SUPABASE_SERVICE_ROLE_KEY", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const { createClient } = await import("./service")
    expect(() => createClient()).toThrow(/SERVICE_ROLE_KEY/)
  })

  it("fail-fast si falta NEXT_PUBLIC_SUPABASE_URL", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    const { createClient } = await import("./service")
    expect(() => createClient()).toThrow(/SUPABASE_URL/)
  })
})
