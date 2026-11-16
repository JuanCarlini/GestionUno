import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join, relative, sep } from "node:path"

// REGLA DURA: el loading.tsx de una ruta tiene que dibujar el encabezado si —y solo si— su
// page.tsx dibuja uno.
//
// El punto de un skeleton es que el layout NO salte. Un loading sin encabezado hace que al
// cargar aparezca el título y empuje todo hacia abajo; un loading con encabezado donde la
// página no tiene hace que al cargar desaparezca y todo suba. Las dos son el salto que el
// skeleton venía a evitar.
//
// Este test existe porque las dos cosas pasaron: dashboard y reportes sin encabezado en el
// loading, y las cinco pantallas de detalle con uno que la página no tiene. Se encontró
// mirando la app desplegada, no leyendo el código.

const DASHBOARD = join(process.cwd(), "src", "app", "(dashboard)")

function paginas(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...paginas(full))
    else if (entry.name === "page.tsx") out.push(full)
  }
  return out
}

const USA_HEADER = /<PageHeader[\s/>]/
const USA_HEADER_SKELETON = /<PageHeaderSkeleton[\s/>]/

const casos = paginas(DASHBOARD).map((page) => {
  const dir = page.slice(0, -"page.tsx".length)
  const loading = join(dir, "loading.tsx")
  return [relative(DASHBOARD, dir).split(sep).join("/") || ".", page, loading] as const
})

describe("regla dura de UI: el skeleton tiene la forma de su página", () => {
  it("encontró páginas para escanear", () => {
    expect(casos.length).toBeGreaterThan(10)
  })

  it.each(casos)("%s tiene loading.tsx", (ruta, _page, loading) => {
    expect(existsSync(loading), `${ruta}: falta loading.tsx`).toBe(true)
  })

  it.each(casos)("%s: encabezado del loading igual al de la página", (ruta, page, loading) => {
    if (!existsSync(loading)) return

    const paginaTieneHeader = USA_HEADER.test(readFileSync(page, "utf8"))
    const loadingTieneHeader = USA_HEADER_SKELETON.test(readFileSync(loading, "utf8"))

    expect(
      loadingTieneHeader,
      paginaTieneHeader
        ? `${ruta}: la página dibuja <PageHeader> pero su loading.tsx no dibuja <PageHeaderSkeleton>. Al cargar, el título aparece y empuja todo hacia abajo.`
        : `${ruta}: el loading.tsx dibuja <PageHeaderSkeleton> pero la página no tiene <PageHeader>. Al cargar, el encabezado desaparece y todo sube.`
    ).toBe(paginaTieneHeader)
  })
})
