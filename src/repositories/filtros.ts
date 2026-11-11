import type { FiltrosListado } from "@/lib/route/paginacion"

/**
 * Sanea el texto que se interpola en un `.or(...)` de PostgREST.
 *
 * El `.or()` recibe una expresión en texto: una coma o un paréntesis sin sanear convierten
 * `?q=x,id.gt.0` en una condición OR extra. Los comodines de LIKE (% y _) no son vector: como
 * mucho ensanchan la búsqueda del propio usuario. Es el mismo saneo que ya hacía
 * ItemService.search, acá compartido.
 */
export function saneaTextoOr(texto: string): string {
  return texto.replace(/[,()"\\]/g, " ").replace(/\s+/g, " ").trim()
}

/**
 * Expresión `.or(...)` que busca el texto en varias columnas con ilike.
 * Devuelve null si no queda nada que buscar, para que el repo no aplique el filtro.
 */
export function orIlike(texto: string | null | undefined, columnas: readonly string[]): string | null {
  if (!texto) return null
  const limpio = saneaTextoOr(texto)
  if (!limpio) return null
  return columnas.map((c) => `${c}.ilike.%${limpio}%`).join(",")
}

export type { FiltrosListado }
