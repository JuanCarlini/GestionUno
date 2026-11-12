import { defineConfig, devices } from "@playwright/test"

// Punta a punta contra una app YA DESPLEGADA (o una levantada aparte), no contra el código:
// el circuito vive tanto en la app como en los triggers de la base, así que la única prueba
// que vale algo es la que atraviesa las dos.
//
// E2E_BASE_URL apunta al entorno de PRUEBA. Nunca a producción: el circuito escribe.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000"

export default defineConfig({
  testDir: "./e2e",
  // Los specs comparten una base sembrada y el circuito es una cadena de estados: en paralelo
  // se pisan entre ellos (y el gate del 100% de una línea es global, no por test).
  fullyParallel: false,
  workers: 1,
  // En CI un retry tapa flakiness real; acá preferimos que se vea.
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
