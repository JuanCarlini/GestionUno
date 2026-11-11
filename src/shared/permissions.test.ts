import { describe, it, expect } from "vitest"
import { tienePermiso } from "./permissions"
import { esPermisoValido, PERMISOS_VALIDOS } from "./permissions-catalog"

// tienePermiso es el único punto de decisión de RBAC (admin short-circuit + membership).
// Puro, sin DB → se testea directo. El I/O (resolver el array del rol) lo cubre el E2E de Fase 2.
describe("tienePermiso", () => {
  it("admin pasa siempre, aun con permisos vacíos (anti auto-lockout)", () => {
    expect(tienePermiso("admin", [], "ordenes_compra", "borrar")).toBe(true)
    expect(tienePermiso("Admin", [], "facturas", "aprobar")).toBe(true) // case-insensitive
  })

  it("tiene el permiso exacto → true", () => {
    expect(tienePermiso("supervisor", ["ordenes_compra:ver"], "ordenes_compra", "ver")).toBe(true)
  })

  it("no tiene el permiso → false", () => {
    expect(tienePermiso("usuario", ["ordenes_compra:ver"], "ordenes_compra", "crear")).toBe(false)
  })

  it("readonly con solo ':ver' puede ver pero nada más", () => {
    const p = ["ordenes_compra:ver"]
    expect(tienePermiso("readonly", p, "ordenes_compra", "ver")).toBe(true)
    expect(tienePermiso("readonly", p, "ordenes_compra", "crear")).toBe(false)
    expect(tienePermiso("readonly", p, "ordenes_compra", "aprobar")).toBe(false)
    expect(tienePermiso("readonly", p, "ordenes_compra", "borrar")).toBe(false)
  })

  it("módulo/acción que no forman un par del array → false (no rompe)", () => {
    expect(tienePermiso("usuario", ["ordenes_compra:ver"], "foo", "bar")).toBe(false)
  })
})

// obs. plan-checker #1: cerrar el claim runtime del catálogo (Task 2), no solo con tsc.
describe("esPermisoValido (catálogo)", () => {
  it("el catálogo tiene exactamente 22 claves válidas", () => {
    expect(PERMISOS_VALIDOS.size).toBe(22)
  })
  it("par válido → true", () => {
    expect(esPermisoValido("ordenes_compra:ver")).toBe(true)
  })
  it("proyectos está en el catálogo (ver/crear), para que su ruta pueda gatear por permiso", () => {
    expect(esPermisoValido("proyectos:ver")).toBe(true)
    expect(esPermisoValido("proyectos:crear")).toBe(true)
  })
  it("proyectos no tiene aprobar ni borrar", () => {
    expect(esPermisoValido("proyectos:aprobar")).toBe(false)
    expect(esPermisoValido("proyectos:borrar")).toBe(false)
  })
  it("par no declarado (proveedores no tiene aprobar) → false", () => {
    expect(esPermisoValido("proveedores:aprobar")).toBe(false)
  })
  it("clave malformada / inexistente → false", () => {
    expect(esPermisoValido("foo:bar")).toBe(false)
  })
})
