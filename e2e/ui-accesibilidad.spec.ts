import { test, expect, type Page } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"
import { loginUi } from "./sesion"

// Barrido de accesibilidad con axe sobre las pantallas principales.
//
// EL NOMBRE DEL ARCHIVO ES A PROPÓSITO: Playwright corre los specs en orden alfabético y acá
// van con workers: 1. "ui-" lo deja después de circuito.spec.ts, que es el que crea las OC,
// certificaciones, facturas y órdenes de pago. Si corriera antes, escanearía esos listados
// vacíos y se perdería justo lo más denso: las filas con sus botones de ícono y sus chips de
// estado. Si alguna vez se renombra, hay que mantener esa propiedad.
//
// Qué falla el test: las violaciones de impacto serious y critical sobre las reglas WCAG 2.1
// A y AA. Las moderate y minor se listan en la salida pero no frenan nada: son cosas como el
// orden de los encabezados, que vale arreglar pero no a costa de tener un job que nadie mira
// porque siempre está rojo.

const REGLAS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]
const FRENAN = ["serious", "critical"]

/** Escanea la página abierta y devuelve el detalle legible de lo que encontró. */
async function escanear(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(REGLAS).analyze()

  const detalle = (v: (typeof violations)[number]) =>
    [
      `  [${v.impact}] ${v.id}: ${v.help}`,
      `    ${v.helpUrl}`,
      // Los selectores concretos: sin esto hay que adivinar qué nodo lo rompió.
      ...v.nodes.slice(0, 5).map((n) => `    → ${n.target.join(" ")}`),
      v.nodes.length > 5 ? `    → …y ${v.nodes.length - 5} nodos más` : "",
    ]
      .filter(Boolean)
      .join("\n")

  return {
    graves: violations.filter((v) => FRENAN.includes(v.impact ?? "")),
    leves: violations.filter((v) => !FRENAN.includes(v.impact ?? "")),
    detalle,
  }
}

async function verificar(page: Page, donde: string) {
  const { graves, leves, detalle } = await escanear(page)

  if (leves.length > 0) {
    console.log(`\n${donde} — ${leves.length} violación(es) leve(s), no frenan:\n${leves.map(detalle).join("\n")}`)
  }

  expect(
    graves,
    graves.length === 0
      ? ""
      : `${donde} — ${graves.length} violación(es) de accesibilidad:\n${graves.map(detalle).join("\n")}`
  ).toHaveLength(0)
}

test.describe("accesibilidad", () => {
  test("el login, que es la única pantalla sin sesión", async ({ page }) => {
    await page.goto("/login")
    await verificar(page, "/login")
  })

  // Pantallas con sesión de supervisor: listados, alta y el dashboard.
  const CON_SESION = [
    "/dashboard",
    "/ordenes-compra",
    "/ordenes-compra/nueva",
    "/certificaciones",
    "/facturas",
    "/ordenes-pago",
    "/proveedores",
    "/proveedores/nuevo",
    "/proyectos",
    "/reportes",
  ]

  for (const ruta of CON_SESION) {
    test(`${ruta}`, async ({ page }) => {
      await loginUi(page, "supervisor")
      await page.goto(ruta)
      // El skeleton tiene su propio árbol: escanear mientras carga mide la pantalla
      // equivocada. Se espera a que el status de carga se vaya.
      await expect(page.getByRole("status", { name: /^Cargando/ })).toHaveCount(0, {
        timeout: 15_000,
      })
      await verificar(page, ruta)
    })
  }

  test("la pantalla de 404", async ({ page }) => {
    await loginUi(page, "supervisor")
    await page.goto("/ordenes-compra/00000000-0000-0000-0000-000000000000")
    await expect(page.getByText(/no existe|no encontrad/i).first()).toBeVisible()
    await verificar(page, "404")
  })

  test("las pantallas de administración", async ({ page }) => {
    await loginUi(page, "admin")
    await page.goto("/admin/usuarios")
    await verificar(page, "/admin/usuarios")
  })

  // El menú es lo que más se usa y lo que peor se navega sin landmark: va aparte del barrido
  // para que, si rompe, el nombre del test lo diga sin tener que leer el detalle de axe.
  test("el menú se anuncia como navegación y dice cuál es la página actual", async ({ page }) => {
    await loginUi(page, "supervisor")
    await page.goto("/facturas")

    const menu = page.getByRole("navigation", { name: "Navegación principal" })
    await expect(menu).toBeVisible()
    await expect(menu.getByRole("link", { name: "Facturas" })).toHaveAttribute(
      "aria-current",
      "page"
    )
  })
})
