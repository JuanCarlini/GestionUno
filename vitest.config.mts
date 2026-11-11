import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

// Tests de lógica (services con el repo mockeado + módulos puros). Entorno node, sin DOM.
// El alias @ replica el de tsconfig para resolver los imports del código.
//
// .mts y no .ts: con extensión .ts Vite lo carga como CommonJS y avisa que el archivo usa
// sintaxis ESM. Por eso la raíz se calcula con import.meta.url y no con __dirname.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
