import { expect, type APIRequestContext, type Page } from "@playwright/test"

// Credenciales del seed (supabase/seed.sql). Son públicas a propósito: el E2E corre contra un
// entorno de prueba efímero. Si algún día alguien las usa contra producción, el problema no es
// que estén acá.
export const USUARIOS = {
  admin: { email: "admin@prueba.test", password: "Semilla.12345" },
  supervisor: { email: "supervisor@prueba.test", password: "Semilla.12345" },
  usuario: { email: "usuario@prueba.test", password: "Semilla.12345" },
  readonly: { email: "readonly@prueba.test", password: "Semilla.12345" },
} as const

export type Rol = keyof typeof USUARIOS

/**
 * Login por API. Deja la cookie de sesión en el contexto, así que las llamadas siguientes van
 * autenticadas sin pasar por el formulario.
 */
export async function loginApi(request: APIRequestContext, rol: Rol = "supervisor") {
  const res = await request.post("/api/auth/login", { data: USUARIOS[rol] })
  expect(res.status(), `login de ${rol}`).toBe(200)
}

/** Login por la UI, para los specs de navegación. */
export async function loginUi(page: Page, rol: Rol = "supervisor") {
  await page.goto("/login")
  await page.locator("#email").fill(USUARIOS[rol].email)
  await page.locator("#password").fill(USUARIOS[rol].password)
  await page.getByRole("button", { name: /iniciar sesión/i }).click()
  await page.waitForURL(/\/dashboard/)
}

/**
 * Hace la llamada y falla con el cuerpo del error, no con "expected 422 to be 200": el circuito
 * devuelve el mensaje del trigger, que es justo lo que uno necesita leer cuando el E2E rompe.
 */
export async function esperarOk(
  promesa: Promise<import("@playwright/test").APIResponse>,
  que: string
) {
  const res = await promesa
  if (res.status() >= 400) {
    throw new Error(`${que} → ${res.status()}: ${await res.text()}`)
  }
  return res.json()
}
