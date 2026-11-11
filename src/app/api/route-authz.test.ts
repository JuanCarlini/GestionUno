import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { join, relative, sep } from "node:path"

// REGLA DURA (enforced): toda ruta de API con un método MUTANTE (POST/PUT/PATCH/DELETE)
// DEBE referenciar un gate de autorización. Si alguien agrega una ruta mutante sin gate,
// este test falla y rompe el build/CI — el hueco no llega a producción.

const API_DIR = join(process.cwd(), "src", "app", "api")

function routeFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...routeFiles(full))
    else if (entry.name === "route.ts") out.push(full)
  }
  return out
}

// Rutas públicas / self-action que legítimamente NO llevan gate de permiso:
// login es público; logout/change-password solo requieren estar autenticado (el
// usuario opera sobre su propia sesión/clave). El middleware ya exige auth en todas.
const ALLOWLIST = [
  "auth/login/route.ts",
  "auth/logout/route.ts",
  "auth/change-password/route.ts",
].map((p) => p.split("/").join(sep))

// Un gate válido: la matriz (requirePermission), admin (requireAdmin), o las route-factories
// que llevan `autorizar` adentro. `requireRole` salió de la lista en PERM-R2: los grupos de
// rol se retiraron cuando el RBAC por permisos los dejó sin consumidores, así que aceptarlo
// como gate válido sería aceptar algo que ya no existe.
// Se exige la LLAMADA (`nombre(`), no la mención: con el regex a secas, un archivo que
// importa el gate y no lo invoca pasaba el test. Verificado en negativo saboteando una ruta.
const GATE = /(requirePermission|requireAdmin|createRoute|estadoRoute|getByIdRoute)\s*\(/
const MUTATING = /export\s+(async\s+function|const)\s+(POST|PUT|PATCH|DELETE)\b/

const files = routeFiles(API_DIR).map((f) => [relative(API_DIR, f), f] as const)

describe("regla dura de seguridad: toda ruta mutante tiene gate de autorización", () => {
  it("encontró rutas para escanear", () => {
    expect(files.length).toBeGreaterThan(10)
  })

  it.each(files)("%s", (rel, full) => {
    if (ALLOWLIST.includes(rel)) return
    const src = readFileSync(full, "utf8")
    if (MUTATING.test(src)) {
      expect(src, `${rel}: tiene un método mutante (POST/PUT/PATCH/DELETE) sin gate de autorización`).toMatch(GATE)
    }
  })
})

// Segunda regla: los GET de LECTURA también llevan gate, salvo los que están acá abajo.
// El punto no es que ningún GET pueda ser solo-auth: es que esa decisión quede FIRMADA en
// una allowlist en vez de ser un olvido. Así se coló `GET /api/proyectos` sin gate mientras
// los 4 módulos del circuito sí lo tenían.
//
// LÍMITE CONOCIDO (compartido con la regla mutante de arriba): la detección es por ARCHIVO,
// no por método. Un route.ts cuyo POST tiene gate y cuyo GET no, pasa. Cazar eso pide un
// parser de TS; por ahora la red atrapa el caso realista —un archivo entero sin gate— y el
// resto lo cubre la revisión. Si alguna vez se agrega ts-morph al proyecto, afinar acá.
const GET_SIN_GATE_A_PROPOSITO = [
  // Catálogo de ítems: lo consume el ItemSelector del form de OC. Exigir `items:ver` acá
  // rompería el alta de líneas para un rol con `ordenes_compra:crear` pero sin `items:ver`.
  "items/route.ts",
  "items/[id]/route.ts",
  "items/search/route.ts",
  "items/categorias/route.ts",
  "items/[id]/precio/route.ts",
  // Cajas: las lista el form de OP para repartir el pago. Mismo razonamiento.
  "cajas/route.ts",
  "cajas/[id]/route.ts",
  // Auth: operan sobre la propia sesión del usuario.
  "auth/me/route.ts",
].map((p) => p.split("/").join(sep))

const HAS_GET = /export\s+(async\s+function|const)\s+GET\b/

describe("regla dura de seguridad: los GET llevan gate, o están firmados en la allowlist", () => {
  it.each(files)("%s", (rel, full) => {
    if (ALLOWLIST.includes(rel) || GET_SIN_GATE_A_PROPOSITO.includes(rel)) return
    const src = readFileSync(full, "utf8")
    if (HAS_GET.test(src)) {
      expect(
        src,
        `${rel}: tiene GET sin gate. Si es a propósito, agregalo a GET_SIN_GATE_A_PROPOSITO con el motivo`
      ).toMatch(GATE)
    }
  })
})
