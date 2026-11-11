import { describe, it, expect } from "vitest"
import { z } from "zod"
import { handleRouteError } from "./handle-route-error"
import { HttpError } from "./http-error"

// handleRouteError es el ÚNICO traductor excepción -> HTTP. Concentra 5 mapeos críticos;
// una regresión acá convierte un rechazo de regla de negocio (P0001) en un 500 opaco, o
// filtra el nombre de una constraint al cliente (23503/23514). Estos tests blindan ese seam.
//
// El cuerpo es { error: { codigo, mensaje, detalles? } }: el `codigo` sale del status, así que
// cada caso verifica los dos juntos. Antes era `{ error: "texto" }` y el cliente solo podía
// ramificar comparando mensajes.
describe("handleRouteError", () => {
  it("HttpError se devuelve con su status, su mensaje y el código que corresponde", async () => {
    const res = handleRouteError(new HttpError(404, "No encontrado"), "ctx")
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: { codigo: "NO_ENCONTRADO", mensaje: "No encontrado" } })
  })

  // Los cuatro status que la app usa para distinguir "por qué" no se pudo.
  it.each([
    [400, "VALIDACION"],
    [403, "PROHIBIDO"],
    [409, "CONFLICTO"],
    [422, "REGLA_NEGOCIO"],
    [503, "SERVICIO_NO_DISPONIBLE"],
  ])("un HttpError %i lleva el código %s", async (status, codigo) => {
    const res = handleRouteError(new HttpError(status, "x"), "ctx")
    expect(res.status).toBe(status)
    expect((await res.json()).error.codigo).toBe(codigo)
  })

  it("ZodError -> 400 VALIDACION con los campos en detalles", async () => {
    let zerr: z.ZodError
    try {
      z.object({ x: z.number() }).parse({ x: "no" })
      throw new Error("debería haber tirado")
    } catch (e) {
      zerr = e as z.ZodError
    }
    const res = handleRouteError(zerr!, "ctx")
    expect(res.status).toBe(400)
    const { error } = await res.json()
    expect(error.codigo).toBe("VALIDACION")
    expect(error.mensaje).toBe("Datos inválidos")
    // flatten(): el formulario necesita saber QUÉ campo está mal, no solo que algo lo está.
    expect(error.detalles.fieldErrors.x).toBeDefined()
  })

  it("P0001 (trigger) -> 422 con el mensaje del trigger VERBATIM", async () => {
    const mensajeTrigger = "No se puede certificar más del 100% de la línea de OC: cantidad 100.00, ya certificado 60.00, se intentó 50.00"
    const res = handleRouteError({ code: "P0001", message: mensajeTrigger }, "ctx")
    expect(res.status).toBe(422)
    expect((await res.json()).error).toEqual({ codigo: "REGLA_NEGOCIO", mensaje: mensajeTrigger })
  })

  it("23505 (unique_violation) -> 409 genérico", async () => {
    const res = handleRouteError({ code: "23505", message: 'duplicate key value violates unique constraint "gu_items_codigo_key"' }, "ctx")
    expect(res.status).toBe(409)
    expect((await res.json()).error).toEqual({ codigo: "CONFLICTO", mensaje: "El registro ya existe" })
  })

  it("23503 (FK) -> 422 genérico SIN filtrar el nombre de la constraint", async () => {
    const res = handleRouteError({ code: "23503", message: 'violates foreign key constraint "fk_lfact_factura"' }, "ctx")
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.mensaje).toBe("Los datos violan una restricción de la base")
    // el mensaje crudo de Postgres NO debe llegar al cliente
    expect(JSON.stringify(body)).not.toContain("fk_lfact_factura")
  })

  it("23514 (CHECK) -> 422 genérico", async () => {
    const res = handleRouteError({ code: "23514", message: 'violates check constraint "cantidad_positiva"' }, "ctx")
    expect(res.status).toBe(422)
    expect((await res.json()).error.mensaje).toBe("Los datos violan una restricción de la base")
  })

  it("error desconocido -> 500 ERROR_INTERNO (sin filtrar el mensaje interno)", async () => {
    const res = handleRouteError(new Error("connection refused a la DB interna"), "ctx")
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toEqual({ codigo: "ERROR_INTERNO", mensaje: "Error interno del servidor" })
    expect(JSON.stringify(body)).not.toContain("connection refused")
  })

  it("un P0001 sin mensaje no deja el cuerpo sin mensaje", async () => {
    const res = handleRouteError({ code: "P0001" }, "ctx")
    expect((await res.json()).error.mensaje).toBe("Regla de negocio violada")
  })
})
