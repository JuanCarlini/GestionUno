import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

// .mts y no .ts: con extensión .ts Vite lo carga como CommonJS y avisa que el archivo usa
// sintaxis ESM. Por eso la raíz se calcula con import.meta.url y no con __dirname.
const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) }

// Dos proyectos porque son dos clases de test con necesidades distintas:
//   logica → services con el repo mockeado y módulos puros. Entorno node, sin DOM: arranca
//            en milisegundos y es el 99% de la suite.
//   ui     → componentes de src/views y src/components. Necesitan jsdom y la transformación
//            de JSX, que en el resto del proyecto la hace Next.
// El alias @ replica el de tsconfig en los dos para resolver los imports del código.
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "logica",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        // El tsconfig dice jsx: "preserve" porque la transformación es de Next, y Vite lee
        // ese valor y deja el JSX sin transformar. Acá se pisa solo para los tests; el
        // tsconfig del proyecto no se toca (cambiarlo rompe el build de Next).
        // Va en `oxc` y no en `esbuild`: Vite 8 transpila con Oxc.
        oxc: {
          jsx: { runtime: "automatic", importSource: "react" },
        },
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./vitest.setup.ui.ts"],
        },
      },
    ],
  },
})
