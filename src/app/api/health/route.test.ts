import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { SaludRepository } from "@/repositories/salud.repository"
import { pingStorage } from "@/lib/storage/comprobantes"
import { GET } from "./route"

vi.mock("@/repositories/salud.repository", () => ({
  SaludRepository: { pingBase: vi.fn() },
}))
vi.mock("@/lib/storage/comprobantes", () => ({ pingStorage: vi.fn() }))

const db = vi.mocked(SaludRepository.pingBase)
const storage = vi.mocked(pingStorage)

beforeEach(() => {
  vi.clearAllMocks()
  db.mockResolvedValue(undefined)
  storage.mockResolvedValue(undefined)
  // La ruta loguea el detalle de cada falla; no queremos el ruido en la corrida.
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
})

describe("GET /api/health", () => {
  it("200 con todo en ok", async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, db: "ok", storage: "ok" })
  })

  it("nunca se cachea: un health check cacheado reporta el pasado", async () => {
    expect((await GET()).headers.get("Cache-Control")).toBe("no-store")
  })

  // 503 y no 200-con-ok-false: el monitoreo decide por el status, sin parsear el cuerpo.
  it("503 si la base no responde, y dice cuál falló", async () => {
    db.mockRejectedValue(new Error("connection refused"))

    const res = await GET()

    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ ok: false, db: "error", storage: "ok" })
  })

  it("503 si Storage no responde", async () => {
    storage.mockRejectedValue(new Error("bucket not found"))

    const res = await GET()

    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ ok: false, db: "ok", storage: "error" })
  })

  it("503 con las dos caídas", async () => {
    db.mockRejectedValue(new Error("x"))
    storage.mockRejectedValue(new Error("y"))
    expect(await (await GET()).json()).toMatchObject({ ok: false, db: "error", storage: "error" })
  })

  // Es público: el cuerpo no puede filtrar el motivo técnico de la falla.
  it("no expone el mensaje del error, que va al log", async () => {
    db.mockRejectedValue(new Error("password authentication failed for user postgres"))

    const cuerpo = JSON.stringify(await (await GET()).json())

    expect(cuerpo).not.toContain("password")
    expect(cuerpo).not.toContain("postgres")
  })

  it("una dependencia colgada corta a los 3 s en vez de esperar para siempre", async () => {
    vi.useFakeTimers()
    db.mockReturnValue(new Promise(() => {}))

    const promesa = GET()
    await vi.advanceTimersByTimeAsync(3000)
    const res = await promesa

    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ db: "error", storage: "ok" })
  })

  it("los dos chequeos corren en paralelo, no uno después del otro", async () => {
    vi.useFakeTimers()
    let dbListo = false
    db.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 1000))
      dbListo = true
    })
    storage.mockImplementation(async () => {
      // Si fueran en serie, al llegar acá la de base ya habría terminado.
      expect(dbListo).toBe(false)
    })

    const promesa = GET()
    await vi.advanceTimersByTimeAsync(1000)
    expect((await promesa).status).toBe(200)
  })

  it("version 'local' cuando no hay sha de despliegue", async () => {
    expect((await (await GET()).json()).version).toBe("local")
  })
})
