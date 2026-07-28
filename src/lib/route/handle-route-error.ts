import { NextResponse } from "next/server"
import { ZodError } from "zod"
import { HttpError } from "./http-error"

// Único traductor excepción → respuesta HTTP. Las reglas duras viven en triggers de Postgres:
// un RAISE EXCEPTION llega como code 'P0001' y se devuelve tal cual con 422 (no se reimplementa en JS).
export function handleRouteError(e: unknown, contexto: string): NextResponse {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  if (e instanceof ZodError) {
    return NextResponse.json({ error: "Datos inválidos", details: e.flatten() }, { status: 400 })
  }

  const pg = e as { code?: string; message?: string }
  if (pg?.code === "P0001") {
    return NextResponse.json({ error: pg.message }, { status: 422 })
  }
  if (pg?.code === "23505") {
    return NextResponse.json({ error: "El registro ya existe" }, { status: 409 })
  }
  if (pg?.code === "23503" || pg?.code === "23514") {
    // FK / CHECK: el mensaje de Postgres filtra nombres de constraint → genérico afuera, detalle al log.
    console.error(`${contexto} (${pg.code}):`, pg.message)
    return NextResponse.json({ error: "Los datos violan una restricción de la base" }, { status: 422 })
  }

  console.error(`${contexto}:`, e)
  return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
}
