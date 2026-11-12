import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { generarContrato, RUTAS_DEL_CONTRATO } from "./contrato"

// REGLA DURA: toda ruta de src/app/api tiene que estar descrita en el contrato. Un contrato
// que se escribe a mano empieza completo y envejece mal: alguien agrega una ruta, nadie se
// acuerda del documento, y el contrato pasa a mentir. Acá el olvido rompe el CI.
//
// Mismo enfoque que route-authz.test.ts: se recorre el filesystem y se compara contra la
// declaración, en vez de confiar en que alguien mantenga dos listas sincronizadas.

const API_DIR = join(process.cwd(), "src", "app", "api")

function archivosDeRuta(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...archivosDeRuta(full))
    else if (entry.name === "route.ts") out.push(full)
  }
  return out
}

const METODO = /export\s+(?:async\s+function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g

// El contrato se describe a sí mismo? No: /api/openapi.json es el documento, no parte de la
// superficie que documenta.
const FUERA_DEL_CONTRATO = ["openapi.json"]

/** Operaciones que EXISTEN en el código, como "GET /api/ordenes-compra". */
function operacionesReales(): string[] {
  const out: string[] = []
  for (const archivo of archivosDeRuta(API_DIR)) {
    const rel = relative(API_DIR, archivo).split(sep).join("/").replace(/\/route\.ts$/, "")
    if (FUERA_DEL_CONTRATO.includes(rel)) continue

    const ruta = `/api/${rel}`.replace(/\[(\w+)\]/g, "{$1}").replace(/\/$/, "")
    const src = readFileSync(archivo, "utf8")
    for (const [, metodo] of src.matchAll(METODO)) out.push(`${metodo} ${ruta}`)
  }
  return out.sort()
}

describe("contrato OpenAPI — cobertura", () => {
  it("encontró rutas para escanear", () => {
    expect(operacionesReales().length).toBeGreaterThan(40)
  })

  it("toda ruta de la API está en el contrato", () => {
    const declaradas = new Set(RUTAS_DEL_CONTRATO)
    const faltantes = operacionesReales().filter((op) => !declaradas.has(op))

    expect(
      faltantes,
      `Estas operaciones existen pero no están en OPERACIONES de contrato.ts:\n${faltantes.join("\n")}`
    ).toEqual([])
  })

  // El otro lado: una entrada que quedó después de borrar la ruta describe algo que no existe.
  it("el contrato no describe rutas que ya no existen", () => {
    const reales = new Set(operacionesReales())
    const sobrantes = RUTAS_DEL_CONTRATO.filter((op) => !reales.has(op))

    expect(
      sobrantes,
      `Estas operaciones están en el contrato pero no existen en src/app/api:\n${sobrantes.join("\n")}`
    ).toEqual([])
  })
})

describe("contrato OpenAPI — documento", () => {
  const doc = generarContrato()

  it("es un OpenAPI 3.0 con título y versión", () => {
    expect(doc.openapi).toBe("3.0.0")
    expect(doc.info.title).toContain("Gestión Uno")
    expect(doc.info.version).toBeTruthy()
  })

  it("describe el formato de error uniforme como componente", () => {
    const error = doc.components?.schemas?.Error as { properties?: Record<string, unknown> }
    expect(error).toBeDefined()
    expect(JSON.stringify(error)).toContain("REGLA_NEGOCIO")
  })

  it("los listados declaran los parámetros de paginación, filtros y orden", () => {
    const get = doc.paths?.["/api/ordenes-compra"]?.get as {
      parameters?: { name: string }[]
    }
    const nombres = (get.parameters ?? []).map((p) => p.name)
    expect(nombres).toEqual(expect.arrayContaining(["page", "limit", "q", "estado", "orden"]))
  })

  it("el cuerpo de un alta sale del schema Zod que valida la ruta", () => {
    const post = doc.paths?.["/api/ordenes-compra"]?.post as {
      requestBody?: { content: Record<string, { schema: { properties?: Record<string, unknown> } }> }
    }
    const props = post.requestBody?.content["application/json"].schema.properties ?? {}
    // Los mismos campos que CreateOrdenCompraSchema: si alguien agrega uno, aparece acá solo.
    expect(Object.keys(props)).toEqual(expect.arrayContaining(["proveedor_id", "fecha_oc", "lineas"]))
  })

  it("cada operación dice qué autorización exige", () => {
    const patch = doc.paths?.["/api/ordenes-compra/{id}/estado"]?.patch as { description?: string }
    expect(patch.description).toContain("ordenes_compra:aprobar")
  })

  it("las rutas con {id} declaran el parámetro de path", () => {
    const get = doc.paths?.["/api/ordenes-compra/{id}"]?.get as { parameters?: { name: string; in: string }[] }
    expect(get.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "id", in: "path", required: true })])
    )
  })
})
