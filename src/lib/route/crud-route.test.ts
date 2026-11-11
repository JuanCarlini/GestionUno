import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"

const registrarDesdeRequest = vi.fn()
vi.mock("@/lib/audit/audit.service", () => ({
  AuditService: { registrarDesdeRequest: (...a: unknown[]) => registrarDesdeRequest(...a) },
}))

import { getByIdRoute, createRoute } from "./crud-route"

const req = (body?: unknown) => ({ json: async () => body }) as any
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => registrarDesdeRequest.mockClear())

describe("getByIdRoute", () => {
  it("devuelve la entidad con 200", async () => {
    const GET = getByIdRoute({
      getById: async (id) => ({ id, nombre: "x" }),
      noEncontrado: "no está",
      contexto: "T",
    })
    const res = await GET(req(), ctx("5"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 5, nombre: "x" })
  })

  it("404 con el mensaje configurado si getById devuelve null", async () => {
    const GET = getByIdRoute({ getById: async () => null, noEncontrado: "no está", contexto: "T" })
    const res = await GET(req(), ctx("5"))
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: "no está" })
  })

  it("si autorizar corta, no consulta getById", async () => {
    const getById = vi.fn()
    const GET = getByIdRoute({
      autorizar: async () => ({ error: NextResponse.json({}, { status: 403 }), user: null }),
      getById,
      noEncontrado: "no está",
      contexto: "T",
    })
    const res = await GET(req(), ctx("5"))
    expect(res.status).toBe(403)
    expect(getById).not.toHaveBeenCalled()
  })

  it("id inválido → 400 sin consultar", async () => {
    const getById = vi.fn()
    const GET = getByIdRoute({ getById, noEncontrado: "no está", contexto: "T" })
    const res = await GET(req(), ctx("abc"))
    expect(res.status).toBe(400)
    expect(getById).not.toHaveBeenCalled()
  })
})

describe("createRoute", () => {
  const base = {
    autorizar: async () => ({ error: null, user: { id: 7 } }),
    schema: { parse: (d: any) => d },
    crear: async (data: any) => ({ id: 99, ...data }),
    contexto: "T",
  }

  it("crea con 201 y audita con accion 'crear' + registroId del creado", async () => {
    const POST = createRoute({
      ...base,
      audit: { tabla: "gu_test", detalle: (c: any) => `Test ${c.id}` },
    })
    const res = await POST(req({ nombre: "y" }))
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ id: 99, nombre: "y" })
    expect(registrarDesdeRequest).toHaveBeenCalledWith({
      tabla: "gu_test",
      registroId: 99,
      accion: "crear",
      detalle: "Test 99",
    })
  })

  it("sin audit configurado, no audita (caso items/proyectos)", async () => {
    const POST = createRoute(base)
    const res = await POST(req({ nombre: "y" }))
    expect(res.status).toBe(201)
    expect(registrarDesdeRequest).not.toHaveBeenCalled()
  })

  it("pasa el user a crear (para created_by) y corta si autorizar falla", async () => {
    const crear = vi.fn(async () => ({ id: 1 }))
    const denegado = createRoute({
      ...base,
      autorizar: async () => ({ error: NextResponse.json({}, { status: 403 }), user: null }),
      crear,
    })
    const res = await denegado(req({}))
    expect(res.status).toBe(403)
    expect(crear).not.toHaveBeenCalled()

    const ok = createRoute({ ...base, crear })
    await ok(req({ nombre: "z" }))
    expect(crear).toHaveBeenCalledWith({ nombre: "z" }, { id: 7 })
  })
})
