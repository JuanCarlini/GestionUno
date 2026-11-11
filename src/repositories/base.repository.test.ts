import { describe, it, expect, vi, beforeEach } from "vitest"
import { createClient } from "@/lib/supabase/service"
import { createBaseRepository } from "./base.repository"

vi.mock("@/lib/supabase/service", () => ({ createClient: vi.fn() }))

// Cliente Supabase falso: builder encadenable + thenable. Cada método registra su llamada
// y devuelve el builder; los terminales (single / await del builder) resuelven `result`.
function fakeClient(result: { data?: any; error?: any }) {
  const calls: Record<string, any[]> = { from: [], select: [], order: [], eq: [], insert: [], update: [], delete: [], single: [] }
  const b: any = {
    from: (t: string) => (calls.from.push(t), b),
    select: (s: string) => (calls.select.push(s), b),
    order: (c: string, o: any) => (calls.order.push([c, o]), b),
    eq: (c: string, v: any) => (calls.eq.push([c, v]), b),
    insert: (row: any) => (calls.insert.push(row), b),
    update: (row: any) => (calls.update.push(row), b),
    delete: () => (calls.delete.push(true), b),
    single: () => (calls.single.push(true), Promise.resolve(result)),
    then: (resolve: any) => resolve(result),
  }
  return { b, calls }
}

function mockClient(result: { data?: any; error?: any }) {
  const { b, calls } = fakeClient(result)
  vi.mocked(createClient).mockReturnValue(b)
  return calls
}

const repo = createBaseRepository<{ id: number; nombre: string }>("gu_test")

beforeEach(() => vi.clearAllMocks())

describe("createBaseRepository.findAll", () => {
  it("devuelve las filas ordenadas por created_at desc por defecto", async () => {
    const calls = mockClient({ data: [{ id: 1, nombre: "a" }], error: null })
    const rows = await repo.findAll()
    expect(rows).toEqual([{ id: 1, nombre: "a" }])
    expect(calls.from).toEqual(["gu_test"])
    expect(calls.select).toEqual(["*"])
    expect(calls.order).toEqual([["created_at", { ascending: false }]])
  })

  it("usa la columna de orden configurada", async () => {
    const calls = mockClient({ data: [], error: null })
    const r = createBaseRepository("gu_test", { orderBy: { column: "nombre", ascending: true } })
    await r.findAll()
    expect(calls.order).toEqual([["nombre", { ascending: true }]])
  })

  it("devuelve [] cuando data es null", async () => {
    mockClient({ data: null, error: null })
    expect(await repo.findAll()).toEqual([])
  })

  it("lanza si hay error", async () => {
    mockClient({ data: null, error: new Error("db caída") })
    await expect(repo.findAll()).rejects.toThrow("db caída")
  })
})

describe("createBaseRepository.findById", () => {
  it("devuelve la fila via single filtrando por id", async () => {
    const calls = mockClient({ data: { id: 7, nombre: "x" }, error: null })
    const row = await repo.findById(7)
    expect(row).toEqual({ id: 7, nombre: "x" })
    expect(calls.eq).toEqual([["id", 7]])
    expect(calls.single).toHaveLength(1)
  })

  // PGRST116 (.single() sin filas) es el unico error que significa "no existe". Cualquier
  // otro sube: tragarlo convertia un 409/422 real en un 404 mentiroso.
  it("devuelve null si .single() no trajo filas (PGRST116)", async () => {
    mockClient({ data: null, error: { code: "PGRST116", message: "no rows" } })
    expect(await repo.findById(999)).toBeNull()
  })

  it("lanza si el error no es PGRST116", async () => {
    mockClient({ data: null, error: { code: "08006", message: "conexion caida" } })
    await expect(repo.findById(999)).rejects.toMatchObject({ code: "08006" })
  })
})

describe("createBaseRepository.insert", () => {
  it("devuelve la fila creada", async () => {
    const calls = mockClient({ data: { id: 3, nombre: "nuevo" }, error: null })
    const row = await repo.insert({ nombre: "nuevo" })
    expect(row).toEqual({ id: 3, nombre: "nuevo" })
    expect(calls.insert).toEqual([{ nombre: "nuevo" }])
  })

  it("lanza si hay error", async () => {
    mockClient({ data: null, error: new Error("unique violation") })
    await expect(repo.insert({ nombre: "dup" })).rejects.toThrow("unique violation")
  })
})

describe("createBaseRepository.update", () => {
  it("devuelve la fila actualizada filtrando por id", async () => {
    const calls = mockClient({ data: { id: 5, nombre: "editado" }, error: null })
    const row = await repo.update(5, { nombre: "editado" })
    expect(row).toEqual({ id: 5, nombre: "editado" })
    expect(calls.update).toEqual([{ nombre: "editado" }])
    expect(calls.eq).toEqual([["id", 5]])
  })

  it("devuelve null si .single() no trajo filas (PGRST116)", async () => {
    mockClient({ data: null, error: { code: "PGRST116", message: "not found" } })
    expect(await repo.update(5, { nombre: "x" })).toBeNull()
  })

  it("lanza si el error no es PGRST116 (constraint, trigger)", async () => {
    mockClient({ data: null, error: { code: "23503", message: "fk violation" } })
    await expect(repo.update(5, { nombre: "x" })).rejects.toMatchObject({ code: "23503" })
  })
})

describe("createBaseRepository.delete", () => {
  it("devuelve true al borrar", async () => {
    const calls = mockClient({ error: null })
    expect(await repo.delete(4)).toBe(true)
    expect(calls.delete).toHaveLength(1)
    expect(calls.eq).toEqual([["id", 4]])
  })

  it("lanza si hay error (ya no devuelve false)", async () => {
    mockClient({ error: new Error("fk violation") })
    await expect(repo.delete(4)).rejects.toThrow("fk violation")
  })
})
