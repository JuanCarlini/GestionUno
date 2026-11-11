import { describe, it, expect } from "vitest"
import { respuestaError } from "./respuesta-error"

// El código sale del status, así que no existe la forma de devolver un par incoherente. Esto
// fija el mapa: si alguien cambia un status en una ruta, el código acompaña solo.
describe("respuestaError", () => {
  it("deriva el código del status", async () => {
    const res = respuestaError(403, "No podés")
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: { codigo: "PROHIBIDO", mensaje: "No podés" } })
  })

  it("omite detalles cuando no se pasan, en vez de mandar undefined", async () => {
    const body = await respuestaError(404, "No está").json()
    expect("detalles" in body.error).toBe(false)
  })

  it("incluye detalles cuando se pasan", async () => {
    const body = await respuestaError(400, "Datos inválidos", {
      detalles: { fieldErrors: { nombre: ["requerido"] } },
    }).json()
    expect(body.error.detalles.fieldErrors.nombre).toEqual(["requerido"])
  })

  // El 429 del rate-limit necesita decirle al cliente cuánto esperar, y eso es transporte.
  it("pasa los headers, para el Retry-After del 429", async () => {
    const res = respuestaError(429, "Demasiados intentos", { headers: { "Retry-After": "900" } })
    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBe("900")
    expect((await res.json()).error.codigo).toBe("DEMASIADOS_INTENTOS")
  })

  // Un status sin código asignado no puede quedar sin código: cae en el genérico.
  it("un status no mapeado cae en ERROR_INTERNO", async () => {
    expect((await respuestaError(418, "x").json()).error.codigo).toBe("ERROR_INTERNO")
  })
})
