import { NextResponse } from "next/server"

// Formato único de error de la API: { error: { codigo, mensaje, detalles? } }.
//
// Antes cada ruta devolvía `{ error: "texto" }` y el de Zod `{ error, details }`, así que el
// cliente solo podía ramificar comparando el MENSAJE —que es texto para el usuario y cambia—
// o el status HTTP, que no alcanza: un 422 puede ser un gate de la base o una pre-condición
// de la app, y un 409 puede ser una transición inválida o una escritura concurrente.
//
// El `codigo` es la semántica de APLICACIÓN y es estable: el status seguirá siendo la
// semántica de transporte.
export type CodigoError =
  | "VALIDACION"
  | "NO_AUTORIZADO"
  | "PROHIBIDO"
  | "NO_ENCONTRADO"
  | "CONFLICTO"
  | "REGLA_NEGOCIO"
  | "DEMASIADOS_INTENTOS"
  | "SERVICIO_NO_DISPONIBLE"
  | "ERROR_INTERNO"

// DEMASIADOS_INTENTOS y ERROR_INTERNO no estaban en la lista del plan, pero 429 y 500 existen
// y sin código quedarían como el default, que es justamente el que no dice nada.
const POR_STATUS: Record<number, CodigoError> = {
  400: "VALIDACION",
  401: "NO_AUTORIZADO",
  403: "PROHIBIDO",
  404: "NO_ENCONTRADO",
  409: "CONFLICTO",
  422: "REGLA_NEGOCIO",
  429: "DEMASIADOS_INTENTOS",
  503: "SERVICIO_NO_DISPONIBLE",
}

export interface CuerpoError {
  error: { codigo: CodigoError; mensaje: string; detalles?: unknown }
}

/**
 * Respuesta de error con el formato único. El código sale del status, así que no hay forma de
 * que una ruta devuelva un par incoherente.
 *
 * `headers` existe para los casos en que el error lleva metadata de transporte: hoy solo el
 * Retry-After del 429.
 */
export function respuestaError(
  status: number,
  mensaje: string,
  opts: { detalles?: unknown; headers?: Record<string, string> } = {}
): NextResponse {
  const codigo = POR_STATUS[status] ?? "ERROR_INTERNO"
  const error =
    opts.detalles === undefined ? { codigo, mensaje } : { codigo, mensaje, detalles: opts.detalles }

  return NextResponse.json({ error }, { status, headers: opts.headers })
}
