import { defineConfig } from "vitest/config"
import path from "node:path"

// Tests de lógica (services con el repo mockeado + módulos puros). Entorno node,
// sin DOM. El alias @ replica el de tsconfig para resolver los imports del código.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
