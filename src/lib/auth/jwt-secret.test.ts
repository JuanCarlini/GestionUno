import { describe, it, expect, afterEach } from "vitest"
import { getJwtSecret } from "./jwt-secret"

const original = process.env.JWT_SECRET
afterEach(() => { process.env.JWT_SECRET = original })

// Un secreto de firma débil anula TODA la cadena de autorización: quien lo adivina
// forja un token de admin y saltea middleware + requireAuth + requirePermission +
// las guardas de página. Estos tests son la red que impide que uno débil llegue a producción.
describe("getJwtSecret", () => {
  it("falla si la variable no está definida", () => {
    delete process.env.JWT_SECRET
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET no está configurada/)
  })

  it("falla si está vacía", () => {
    process.env.JWT_SECRET = ""
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET no está configurada/)
  })

  it("falla si tiene menos de 32 caracteres", () => {
    process.env.JWT_SECRET = "a".repeat(31)
    expect(() => getJwtSecret()).toThrow(/al menos 32 caracteres/)
  })

  it("falla si contiene una palabra de placeholder", () => {
    process.env.JWT_SECRET = "changeme-changeme-changeme-changeme"  // 35 chars: pasa longitud
    expect(() => getJwtSecret()).toThrow(/palabra previsible/)
  })

  it("falla si contiene el nombre del proyecto (el caso real que se rotó)", () => {
    process.env.JWT_SECRET = "gestion-uno-super-clave-secreta-2026"  // 36 chars, como el viejo
    expect(() => getJwtSecret()).toThrow(/palabra previsible/)
  })

  it("acepta un secreto aleatorio en base64url", () => {
    process.env.JWT_SECRET = "K7fQ2mXpL9vR4nT8wY3zB6cH1jD5gS0aE7uI2oP4kM8"
    expect(getJwtSecret()).toBe(process.env.JWT_SECRET)
  })

  it("acepta un secreto en hex (alfabeto chico pero 256 bits reales)", () => {
    // Regresión: un heurístico de 'caracteres distintos' rechazaría hex por error.
    process.env.JWT_SECRET = "a".repeat(0) + "3f5c9d2e8b1a47f6c0d93e2b5a8f14c73f5c9d2e8b1a47f6c0d93e2b5a8f14c7"
    expect(getJwtSecret()).toBe(process.env.JWT_SECRET)
  })
})
