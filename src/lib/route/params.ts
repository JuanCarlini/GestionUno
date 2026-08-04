// Shape del segundo argumento de los handlers de rutas [id] (en Next 15 params es
// Promise). Antes cada ruta re-declaraba esta interface idéntica.
export interface IdParams {
  params: Promise<{ id: string }>
}
