import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createClient } from "@/lib/supabase/service"

vi.mock("@/lib/supabase/service", () => ({ createClient: vi.fn() }))

// Cada test importa el módulo de cero: `bucketListo` es estado de módulo (cachea que el
// bucket existe) y si no se resetea, el segundo test nunca pasa por asegurarBucket.
async function cargar() {
  vi.resetModules()
  return import("./comprobantes")
}

type Resultado = { data?: unknown; error?: unknown }

// Storage falso: cada operación devuelve lo que se le configure, o una promesa que nunca
// resuelve (para el caso del timeout).
function mockStorage(ops: {
  getBucket?: Resultado | "cuelga"
  createBucket?: Resultado
  createSignedUrl?: Resultado | "cuelga"
  upload?: Resultado | "cuelga"
}) {
  const nunca = new Promise<never>(() => {})
  const resolver = (v: Resultado | "cuelga" | undefined, porDefecto: Resultado) =>
    v === "cuelga" ? nunca : Promise.resolve(v ?? porDefecto)

  const from = vi.fn(() => ({
    createSignedUrl: vi.fn(() => resolver(ops.createSignedUrl, { data: null, error: null })),
    upload: vi.fn(() => resolver(ops.upload, { error: null })),
  }))

  vi.mocked(createClient).mockReturnValue({
    storage: {
      getBucket: vi.fn(() => resolver(ops.getBucket, { data: {}, error: null })),
      createBucket: vi.fn(() => resolver(ops.createBucket, { error: null })),
      from,
    },
  } as never)

  return { from }
}

beforeEach(() => {
  vi.clearAllMocks()
  // servicioCaido loguea el detalle técnico; no queremos el ruido en la corrida.
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
})

describe("urlComprobante — la factura sin PDF no es un error", () => {
  it("404 en status (number) devuelve null", async () => {
    mockStorage({ createSignedUrl: { data: null, error: { status: 404, message: "Object not found" } } })
    const { urlComprobante } = await cargar()
    expect(await urlComprobante(7)).toBeNull()
  })

  it("404 en statusCode (string, según la versión del SDK) devuelve null", async () => {
    mockStorage({
      createSignedUrl: { data: null, error: { statusCode: "404", message: "cualquier cosa" } },
    })
    const { urlComprobante } = await cargar()
    expect(await urlComprobante(7)).toBeNull()
  })

  // El mensaje dejó de ser la fuente de verdad: lo que manda es el código. Un 500 que
  // casualmente diga "not found" ya no se traga como "no tiene PDF".
  it("500 con un mensaje que dice 'not found' igual es 503", async () => {
    mockStorage({
      createSignedUrl: { data: null, error: { status: 500, message: "upstream: object not found" } },
    })
    const { urlComprobante } = await cargar()
    await expect(urlComprobante(7)).rejects.toMatchObject({ status: 503 })
  })

  it("500 devuelve 503 sin tocar la factura", async () => {
    mockStorage({ createSignedUrl: { data: null, error: { status: 500, message: "internal" } } })
    const { urlComprobante } = await cargar()
    await expect(urlComprobante(7)).rejects.toMatchObject({ status: 503 })
  })

  it("devuelve la URL firmada cuando el archivo está", async () => {
    mockStorage({ createSignedUrl: { data: { signedUrl: "https://x/y.pdf" }, error: null } })
    const { urlComprobante } = await cargar()
    expect(await urlComprobante(7)).toBe("https://x/y.pdf")
  })

  describe("respaldo por mensaje, cuando el error no trae código", () => {
    it("un mensaje de 'not found' sin código sigue devolviendo null", async () => {
      mockStorage({ createSignedUrl: { data: null, error: { message: "Object not found" } } })
      const { urlComprobante } = await cargar()
      expect(await urlComprobante(7)).toBeNull()
    })

    it("un error sin código y con otro mensaje es 503", async () => {
      mockStorage({ createSignedUrl: { data: null, error: { message: "connection reset" } } })
      const { urlComprobante } = await cargar()
      await expect(urlComprobante(7)).rejects.toMatchObject({ status: 503 })
    })
  })
})

describe("timeout del servicio de archivos", () => {
  it("si Storage se cuelga, corta en 8 s con 503", async () => {
    vi.useFakeTimers()
    mockStorage({ createSignedUrl: "cuelga" })
    const { urlComprobante } = await cargar()

    const promesa = urlComprobante(7)
    const esperado = expect(promesa).rejects.toMatchObject({ status: 503 })
    await vi.advanceTimersByTimeAsync(8000)
    await esperado
  })
})

describe("asegurarBucket", () => {
  it("si el bucket ya existía (409 al crearlo), sigue de largo", async () => {
    mockStorage({
      getBucket: { data: null, error: { status: 404, message: "Bucket not found" } },
      createBucket: { error: { status: 409, message: "The resource already exists" } },
      createSignedUrl: { data: { signedUrl: "https://x/y.pdf" }, error: null },
    })
    const { urlComprobante } = await cargar()
    expect(await urlComprobante(7)).toBe("https://x/y.pdf")
  })

  it("si crear el bucket falla con 500, es 503", async () => {
    mockStorage({
      getBucket: { data: null, error: { status: 404, message: "Bucket not found" } },
      createBucket: { error: { status: 500, message: "internal" } },
    })
    const { urlComprobante } = await cargar()
    await expect(urlComprobante(7)).rejects.toMatchObject({ status: 503 })
  })
})

describe("subirComprobante", () => {
  it("un error de upload es 503 y la factura queda intacta", async () => {
    mockStorage({ upload: { error: { status: 500, message: "internal" } } })
    const { subirComprobante } = await cargar()
    await expect(subirComprobante(7, new ArrayBuffer(8))).rejects.toMatchObject({ status: 503 })
  })

  it("un upload OK no devuelve nada", async () => {
    mockStorage({ upload: { error: null } })
    const { subirComprobante } = await cargar()
    await expect(subirComprobante(7, new ArrayBuffer(8))).resolves.toBeUndefined()
  })
})
