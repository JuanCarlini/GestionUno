import { NextResponse } from "next/server"
import { ZodError } from "zod"
import { HttpError } from "./http-error"
import { respuestaError } from "./respuesta-error"

// Único traductor excepción → respuesta HTTP, con el formato de respuesta-error.ts. Las reglas
// duras viven en triggers de Postgres: un RAISE EXCEPTION llega como code 'P0001' y se
// devuelve tal cual con 422 (no se reimplementa en JS).
export function handleRouteError(e: unknown, contexto: string): NextResponse {
  if (e instanceof HttpError) {
    return respuestaError(e.status, e.message)
  }
  if (e instanceof ZodError) {
    // flatten() ya separa fieldErrors de formErrors: es exactamente lo que el formulario
    // necesita para marcar los campos, y por eso va en detalles y no aplanado en el mensaje.
    return respuestaError(400, "Datos inválidos", { detalles: e.flatten() })
  }

  const pg = e as { code?: string; message?: string }
  if (pg?.code === "P0001") {
    return respuestaError(422, pg.message ?? "Regla de negocio violada")
  }
  if (pg?.code === "23505") {
    return respuestaError(409, "El registro ya existe")
  }
  if (pg?.code === "23503" || pg?.code === "23514") {
    // FK / CHECK: el mensaje de Postgres filtra nombres de constraint → genérico afuera, detalle al log.
    console.error(`${contexto} (${pg.code}):`, pg.message)
    return respuestaError(422, "Los datos violan una restricción de la base")
  }

  console.error(`${contexto}:`, e)
  return respuestaError(500, "Error interno del servidor")
}
