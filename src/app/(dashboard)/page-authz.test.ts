import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { join, relative, sep } from "node:path"

// REGLA DURA (enforced): toda página del dashboard DEBE tener una guarda de autorización
// SERVER-SIDE. Es lo que bloquea el acceso por URL directa: sin esto, un guard en
// useEffect solo esconde la UI después de hidratar (y no corre si el JS falla).
// Hermano de src/app/api/route-authz.test.ts, que hace lo propio con las rutas mutantes.

const DASHBOARD_DIR = join(process.cwd(), "src", "app", "(dashboard)")

function pageFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...pageFiles(full))
    else if (entry.name === "page.tsx") out.push(full)
  }
  return out
}

// Páginas que legítimamente NO llevan guarda por permiso:
// - dashboard y reportes no son módulos de la matriz RBAC (los ve cualquier autenticado;
//   el middleware ya exige JWT válido).
// - las de admin/* están gateadas por (dashboard)/admin/layout.tsx, que es Server Component
//   y llama a requirePageAdmin() — ver el test de más abajo.
const ALLOWLIST = [
  "dashboard/page.tsx",
  "reportes/page.tsx",
  "admin/usuarios/page.tsx",
  "admin/auditoria/page.tsx",
].map((p) => p.split("/").join(sep))

// Ojo: exigimos la LLAMADA (`nombre(`), no la mención. Con /requirePagePermission/ a secas,
// un archivo que importa la guarda pero no la invoca pasaba el test — verificado saboteando
// una página: dejaba el import y borraba el `await`, y el test seguía verde.
const GATE = /requirePagePermission\s*\(|requirePageAdmin\s*\(/

const pages = pageFiles(DASHBOARD_DIR).map((f) => [relative(DASHBOARD_DIR, f), f] as const)

describe("regla dura de seguridad: toda página del dashboard tiene guarda server-side", () => {
  it("encontró páginas para escanear", () => {
    expect(pages.length).toBeGreaterThan(10)
  })

  it.each(pages)("%s", (rel, full) => {
    if (ALLOWLIST.includes(rel)) return
    const src = readFileSync(full, "utf8")
    expect(src, `${rel}: página sin guarda server-side (requirePagePermission)`).toMatch(GATE)
    expect(src, `${rel}: es "use client", así que la guarda no corre en el servidor`).not.toMatch(
      /^\s*["']use client["']/m
    )
  })

  it("el layout de admin gatea server-side (cubre a las páginas de admin/*)", () => {
    const layout = readFileSync(join(DASHBOARD_DIR, "admin", "layout.tsx"), "utf8")
    expect(layout, 'admin/layout.tsx no debe ser "use client": el guard no correría en el servidor').not.toMatch(
      /^\s*["']use client["']/m
    )
    expect(layout, "admin/layout.tsx debe llamar a requirePageAdmin()").toMatch(/requirePageAdmin/)
  })
})
