// Política de caché de las lecturas de la API, en un solo lugar para que la decisión no quede
// implícita en cada ruta.

/**
 * Catálogo: ítems, categorías, cajas y proyectos. Cambian poco y los consumen los formularios
 * del circuito en cada apertura (el selector de ítems de una OC, las cajas de una OP), así que
 * un minuto de caché saca la mayoría de esas lecturas repetidas.
 *
 * `private` es lo importante: la respuesta se sirve detrás de una cookie de sesión y NO puede
 * terminar en una caché compartida. `stale-while-revalidate` deja que el browser muestre lo
 * viejo mientras pide lo nuevo, así el formulario no espera.
 */
export const CACHE_CATALOGO = "private, max-age=60, stale-while-revalidate=300"

/**
 * Documentos del circuito y reportes: nunca. Un listado de OC con un minuto de atraso muestra
 * un estado que ya cambió —y el circuito es justamente una cadena de cambios de estado—, así
 * que acá la frescura no es negociable.
 */
export const CACHE_NUNCA = "no-store"

/** Headers de respuesta con la política dada. */
export function headersCache(politica: string): { "Cache-Control": string } {
  return { "Cache-Control": politica }
}
