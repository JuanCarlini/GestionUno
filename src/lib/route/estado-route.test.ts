import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"

// AuditService pega a Supabase; lo mockeamos para aislar el algoritmo del factory.
const registrar = vi.fn()
vi.mock("@/lib/audit/audit.service", () => ({
  AuditService: { registrar: (...a: unknown[]) => registrar(...a) },
}))

import { estadoRoute } from "./estado-route"

// Config mínima con huecos espiables. El schema acepta cualquier {estado}.
function makeRoute(overrides: Partial<Parameters<typeof estadoRoute>[0]> = {}) {
  const cambiarEstado = vi.fn(async (_id: number, estado: string) => ({ id: _id, estado }))
  const autorizar = vi.fn(async () => ({ error: null, user: { id: 7 } }))
  const handler = estadoRoute({
    schema: { parse: (d: any) => ({ estado: d.estado }) },
    autorizar,
    cambiarEstado,
    tabla: "gu_test",
    accion: () => "aprobar",
    detalle: (e: any, estado) => `Test ${e.id}: ${estado}`,
    contexto: "TEST",
    ...overrides,
  })
  return { handler, cambiarEstado, autorizar }
}

const req = (body: unknown) => ({ json: async () => body }) as any
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => registrar.mockClear())

describe("estadoRoute (Template Method de rutas de estado)", () => {
  it("camino feliz: cambia estado, audita con los campos derivados y responde 200", async () => {
    const { handler, cambiarEstado } = makeRoute()
    const res = await handler(req({ estado: "aprobado" }), ctx("5"))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 5, estado: "aprobado" })
    expect(cambiarEstado).toHaveBeenCalledWith(5, "aprobado")
    expect(registrar).toHaveBeenCalledWith({
      usuarioId: 7,
      tabla: "gu_test",
      registroId: 5,
      accion: "aprobar",
      detalle: "Test 5: aprobado",
    })
  })

  it("si autorizar devuelve error, corta: no cambia estado ni audita", async () => {
    const denegado = NextResponse.json({ error: "no" }, { status: 403 })
    const { handler, cambiarEstado } = makeRoute({
      autorizar: async () => ({ error: denegado, user: null }),
    })
    const res = await handler(req({ estado: "aprobado" }), ctx("5"))

    expect(res.status).toBe(403)
    expect(cambiarEstado).not.toHaveBeenCalled()
    expect(registrar).not.toHaveBeenCalled()
  })

  it("id inválido → 400 (parseId) sin tocar el service", async () => {
    const { handler, cambiarEstado } = makeRoute()
    const res = await handler(req({ estado: "aprobado" }), ctx("abc"))

    expect(res.status).toBe(400)
    expect(cambiarEstado).not.toHaveBeenCalled()
  })

  it("la autorización recibe el estado destino (permiso por destino)", async () => {
    const { handler, autorizar } = makeRoute()
    await handler(req({ estado: "anulado" }), ctx("9"))
    expect(autorizar).toHaveBeenCalledWith("anulado")
  })
})
