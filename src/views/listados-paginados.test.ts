import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"

// REGLA DURA (enforced): ninguna vista puede LEER una colección paginada con `fetch` pelado.
//
// Por qué existe este test: cuando los listados pasaron a devolver `{ data, total, page, ... }`
// (paginación en el servidor), los cuatro formularios del circuito siguieron tratando la
// respuesta como un array. `data.filter(...)` tiraba TypeError, el catch dejaba la lista vacía
// y la pantalla decía "No hay proveedores disponibles" con once proveedores en la base. No se
// podía dar de alta NADA desde la UI.
//
// La suite entera estaba en verde: el e2e recorre el circuito por API y nunca abre un
// formulario, así que el único lugar donde el bug existía era el único que nadie miraba.
// Esta es la red que faltaba. Las lecturas de colección van por `listado()` de
// shared/api-client, que lee `.data` en un solo lugar.

const VIEWS_DIR = join(process.cwd(), "src", "views")
const API_DIR = join(process.cwd(), "src", "app", "api")

function archivos(dir: string, filtro: (n: string) => boolean): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...archivos(full, filtro))
    else if (filtro(entry.name)) out.push(full)
  }
  return out
}

// Los recursos paginados se DERIVAN del servidor (quién llama a cuerpoPaginado), no se
// hardcodean: una colección nueva queda cubierta sola el día que se pagina.
const recursosPaginados = archivos(API_DIR, (n) => n === "route.ts")
  .filter((f) => readFileSync(f, "utf8").includes("cuerpoPaginado("))
  .map((f) => relative(API_DIR, f).split(/[/\\]/).slice(0, -1).join("/"))
  .filter((r) => r && !r.includes("["))

// Solo las LECTURAS: `fetch("/api/x")` sin segundo argumento. Un POST a la colección
// (`fetch("/api/ordenes-compra", { method: "POST" })`) devuelve el documento creado, no una
// página, así que es legítimo y no lo tocamos — de ahí el `)` obligatorio al final.
function lecturaDeColeccion(recurso: string): RegExp {
  return new RegExp(`fetch\\(\\s*["'\`]/api/${recurso}(\\?[^"'\`]*)?["'\`]\\s*\\)`)
}

const vistas = archivos(VIEWS_DIR, (n) => n.endsWith(".tsx")).map(
  (f) => [relative(VIEWS_DIR, f), f] as const
)

describe("regla dura: las colecciones paginadas se leen con listado(), no con fetch pelado", () => {
  it("derivó los recursos paginados del servidor", () => {
    expect(recursosPaginados.length).toBeGreaterThan(3)
  })

  it.each(vistas)("%s", (rel, full) => {
    const src = readFileSync(full, "utf8")
    for (const recurso of recursosPaginados) {
      expect(
        lecturaDeColeccion(recurso).test(src),
        `${rel}: lee /api/${recurso} con fetch pelado. Esa ruta devuelve { data, total, ... }, ` +
          `no un array: usá listado<T>("/api/${recurso}?...") de @/shared/api-client`
      ).toBe(false)
    }
  })
})
