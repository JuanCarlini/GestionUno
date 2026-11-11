import { describe, it, expect } from "vitest"
import {
  PaginacionSchema,
  LIMITE_MAXIMO,
  rango,
  parsearOrden,
  cuerpoPaginado,
  leerPaginacion,
} from "./paginacion"

describe("PaginacionSchema", () => {
  it("por defecto es la página 1 con 25 filas", () => {
    expect(PaginacionSchema.parse({})).toEqual({ page: 1, limit: 25 })
  })

  it("coacciona los strings de la query", () => {
    expect(PaginacionSchema.parse({ page: "3", limit: "50" })).toEqual({ page: 3, limit: 50 })
  })

  // Sin techo, ?limit=100000 es una descarga de la tabla entera disfrazada de paginación.
  it("rechaza un limit por encima del máximo", () => {
    expect(PaginacionSchema.safeParse({ limit: LIMITE_MAXIMO + 1 }).success).toBe(false)
  })

  it("rechaza page 0 y negativos (la primera página es la 1)", () => {
    expect(PaginacionSchema.safeParse({ page: 0 }).success).toBe(false)
    expect(PaginacionSchema.safeParse({ page: -1 }).success).toBe(false)
  })

  it("rechaza un page no numérico en vez de caer al default en silencio", () => {
    expect(PaginacionSchema.safeParse({ page: "abc" }).success).toBe(false)
  })
})

describe("rango", () => {
  it("traduce page 1-based al range 0-based de PostgREST", () => {
    expect(rango({ page: 1, limit: 25 })).toEqual({ desde: 0, hasta: 24 })
    expect(rango({ page: 2, limit: 25 })).toEqual({ desde: 25, hasta: 49 })
    expect(rango({ page: 4, limit: 10 })).toEqual({ desde: 30, hasta: 39 })
  })
})

describe("parsearOrden", () => {
  const COLUMNAS = ["fecha_oc", "total_con_iva"] as const
  const DEFECTO = { columna: "created_at", ascending: false }

  it("parsea campo.dir", () => {
    expect(parsearOrden("fecha_oc.asc", COLUMNAS, DEFECTO)).toEqual({
      columna: "fecha_oc",
      ascending: true,
    })
  })

  it("sin parámetro usa el orden por defecto", () => {
    expect(parsearOrden(null, COLUMNAS, DEFECTO)).toEqual(DEFECTO)
  })

  // La whitelist es lo que evita que el parámetro sirva para ordenar por cualquier columna de
  // la tabla, incluida una que la respuesta no expone.
  it("una columna fuera de la whitelist cae al default", () => {
    expect(parsearOrden("password_hash.asc", COLUMNAS, DEFECTO)).toEqual(DEFECTO)
  })

  it("una dirección inválida cae al default", () => {
    expect(parsearOrden("fecha_oc.arriba", COLUMNAS, DEFECTO)).toEqual(DEFECTO)
  })

  it("un formato sin punto cae al default", () => {
    expect(parsearOrden("fecha_oc", COLUMNAS, DEFECTO)).toEqual(DEFECTO)
  })
})

describe("cuerpoPaginado", () => {
  const URL_BASE = "https://app.test/api/ordenes-compra?estado=aprobado"

  it("devuelve data, total, page y limit", () => {
    const cuerpo = cuerpoPaginado(URL_BASE, { data: [{ id: 1 }], total: 60 }, { page: 1, limit: 25 })
    expect(cuerpo).toMatchObject({ data: [{ id: 1 }], total: 60, page: 1, limit: 25 })
  })

  // next arrastra los filtros del request: la ruta no tiene que acordarse de ninguno.
  it("next apunta a la página siguiente conservando los filtros", () => {
    const { next } = cuerpoPaginado(URL_BASE, { data: [], total: 60 }, { page: 1, limit: 25 })
    expect(next).toBe("/api/ordenes-compra?estado=aprobado&page=2&limit=25")
  })

  it("next es null en la última página", () => {
    const { next } = cuerpoPaginado(URL_BASE, { data: [], total: 50 }, { page: 2, limit: 25 })
    expect(next).toBeNull()
  })

  it("next es null cuando no hay filas", () => {
    expect(cuerpoPaginado(URL_BASE, { data: [], total: 0 }, { page: 1, limit: 25 }).next).toBeNull()
  })

  it("reemplaza un page que ya venía en la URL en vez de duplicarlo", () => {
    const { next } = cuerpoPaginado(
      "https://app.test/api/items?page=2&limit=10",
      { data: [], total: 100 },
      { page: 2, limit: 10 }
    )
    expect(next).toBe("/api/items?page=3&limit=10")
  })
})

describe("leerPaginacion", () => {
  it("lee los parámetros de la URL", () => {
    expect(leerPaginacion("https://app.test/api/items?page=2&limit=10")).toEqual({
      page: 2,
      limit: 10,
    })
  })

  it("sin parámetros devuelve los defaults", () => {
    expect(leerPaginacion("https://app.test/api/items")).toEqual({ page: 1, limit: 25 })
  })

  it("tira ZodError con un limit inválido (la ruta lo convierte en 400)", () => {
    expect(() => leerPaginacion("https://app.test/api/items?limit=999")).toThrow()
  })
})
