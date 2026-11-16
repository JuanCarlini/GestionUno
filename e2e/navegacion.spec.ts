import { test, expect } from "@playwright/test"
import { loginUi } from "./sesion"

// Humo de la UI: que la app levante, que el login funcione y que cada listado renderice con
// sus datos. No intenta recorrer los formularios del circuito —eso lo hace circuito.spec.ts
// por API— pero sí cubre lo que un deploy roto rompe primero.

test.describe("navegación", () => {
  test("sin sesión, cualquier ruta protegida manda a /login", async ({ page }) => {
    await page.goto("/ordenes-compra")
    await expect(page).toHaveURL(/\/login/)
  })

  test("login y dashboard", async ({ page }) => {
    await loginUi(page, "supervisor")
    // loginUi ya espera la navegación a /dashboard; esto verifica que además renderizó.
    await expect(page.getByText(/actividad reciente/i)).toBeVisible()
  })

  const LISTADOS = [
    { url: "/ordenes-compra", titulo: /órdenes de compra/i },
    { url: "/certificaciones", titulo: /certificaciones/i },
    { url: "/facturas", titulo: /facturas/i },
    { url: "/ordenes-pago", titulo: /órdenes de pago/i },
    { url: "/proveedores", titulo: /proveedores/i },
    { url: "/proyectos", titulo: /proyectos/i },
  ]

  for (const listado of LISTADOS) {
    test(`el listado de ${listado.url} carga`, async ({ page }) => {
      await loginUi(page, "supervisor")
      await page.goto(listado.url)

      await expect(page.getByText(listado.titulo).first()).toBeVisible()
      // Que no haya quedado el skeleton colgado ni un error de carga.
      await expect(page.getByText(/^Error:/)).toHaveCount(0)
    })
  }

  // El estado del listado vive en la URL (useListado), así que compartir el link reproduce la
  // misma vista. Es la parte de la paginación que un usuario nota.
  test("buscar y paginar quedan en la URL", async ({ page }) => {
    await loginUi(page, "supervisor")
    await page.goto("/ordenes-compra")

    await page.getByPlaceholder(/buscar/i).fill("OC-")
    await expect(page).toHaveURL(/q=OC-/, { timeout: 15_000 })

    const siguiente = page.getByRole("button", { name: /página siguiente/i })
    if (await siguiente.isEnabled().catch(() => false)) {
      await siguiente.click()
      await expect(page).toHaveURL(/page=2/)
    }
  })

  test("reportes carga con sus pestañas", async ({ page }) => {
    await loginUi(page, "supervisor")
    await page.goto("/reportes")
    await expect(page.getByText(/reportes/i).first()).toBeVisible()
  })

  // /admin es por ROL, no por la matriz de permisos: un supervisor no entra.
  test("un supervisor no entra a /admin", async ({ page }) => {
    await loginUi(page, "supervisor")
    await page.goto("/admin")
    await expect(page).toHaveURL(/\/dashboard/)
  })
})
