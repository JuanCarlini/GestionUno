import { z } from "zod"

// Paginación, filtros y orden de los listados.
//
// Antes todos los getAll() traían TODAS las filas: con 34 OC no se nota, pero el costo crece
// con los datos y el cliente terminaba filtrando y ordenando en memoria sobre el total. Ahora
// la base hace el recorte y la app pide la página que necesita.

export const LIMITE_DEFECTO = 25
export const LIMITE_MAXIMO = 100

// `page` arranca en 1 (es lo que ve el usuario); el .range() de PostgREST es 0-based y la
// traducción vive en `rango()`, en un solo lugar.
export const PaginacionSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  // El techo es lo que evita que ?limit=100000 sea una descarga de la tabla entera disfrazada
  // de paginación.
  limit: z.coerce.number().int().positive().max(LIMITE_MAXIMO).default(LIMITE_DEFECTO),
})

export type Paginacion = z.infer<typeof PaginacionSchema>

/** Lo que devuelve un repositorio paginado: la página y el total de la consulta SIN paginar. */
export interface Pagina<T> {
  data: T[]
  total: number
}

export interface Orden {
  columna: string
  ascending: boolean
}

// Filtros de listado que viajan por query string y llegan hasta el repositorio sin cambiar de
// vocabulario. Cada recurso usa los que le aplican.
export const FiltrosListadoSchema = z.object({
  estado: z.string().min(1).nullish(),
  proveedorId: z.coerce.number().int().positive().nullish(),
  proyectoId: z.coerce.number().int().positive().nullish(),
  // Búsqueda de texto libre. Antes vivía en el cliente sobre el total de las filas; con la
  // lista paginada eso buscaría solo dentro de la página visible, así que baja a la base.
  q: z.string().min(1).nullish(),
})

export type FiltrosListado = z.infer<typeof FiltrosListadoSchema>

/** Índices para `.range()` (inclusivos, 0-based). */
export function rango({ page, limit }: Paginacion): { desde: number; hasta: number } {
  const desde = (page - 1) * limit
  return { desde, hasta: desde + limit - 1 }
}

/**
 * Parsea `?orden=campo.desc` (el mismo formato que usa PostgREST, para que no haya que
 * traducir dos vocabularios).
 *
 * `columnas` es una whitelist: sin ella, el parámetro sería un puente para ordenar por
 * cualquier columna de la tabla, incluida una que no se expone en la respuesta.
 */
export function parsearOrden(
  crudo: string | null | undefined,
  columnas: readonly string[],
  porDefecto: Orden
): Orden {
  if (!crudo) return porDefecto

  const [columna, dir] = crudo.split(".")
  if (!columnas.includes(columna) || (dir !== "asc" && dir !== "desc")) return porDefecto

  return { columna, ascending: dir === "asc" }
}

export interface CuerpoPaginado<T> {
  data: T[]
  total: number
  page: number
  limit: number
  /** URL de la página siguiente, o null si esta es la última. */
  next: string | null
}

/**
 * Cuerpo de respuesta de un listado. `next` se arma sobre la URL del request, así arrastra los
 * filtros y el orden sin que la ruta tenga que acordarse de ninguno.
 */
export function cuerpoPaginado<T>(
  url: string,
  { data, total }: Pagina<T>,
  { page, limit }: Paginacion
): CuerpoPaginado<T> {
  const hayMas = page * limit < total
  let next: string | null = null

  if (hayMas) {
    const siguiente = new URL(url)
    siguiente.searchParams.set("page", String(page + 1))
    siguiente.searchParams.set("limit", String(limit))
    next = `${siguiente.pathname}${siguiente.search}`
  }

  return { data, total, page, limit, next }
}

/** Lee page y limit de la query. Un valor inválido es un 400 de Zod, no un default silencioso. */
export function leerPaginacion(url: string): Paginacion {
  const params = new URL(url).searchParams
  return PaginacionSchema.parse({
    page: params.get("page") ?? undefined,
    limit: params.get("limit") ?? undefined,
  })
}

/**
 * Todo lo que una ruta de listado necesita leer de la query, de una vez: página, filtros y
 * orden. Las seis rutas de colección hacían el mismo bloque de parseo.
 *
 * `columnasOrden` es la whitelist de columnas ordenables de ESE recurso.
 */
export function leerListado(
  url: string,
  cfg: { columnasOrden: readonly string[]; ordenPorDefecto: Orden }
): { paginacion: Paginacion; filtros: FiltrosListado; orden: Orden } {
  const params = new URL(url).searchParams

  return {
    paginacion: leerPaginacion(url),
    filtros: FiltrosListadoSchema.parse({
      estado: params.get("estado"),
      proveedorId: params.get("proveedorId"),
      proyectoId: params.get("proyectoId"),
      q: params.get("q"),
    }),
    orden: parsearOrden(params.get("orden"), cfg.columnasOrden, cfg.ordenPorDefecto),
  }
}
