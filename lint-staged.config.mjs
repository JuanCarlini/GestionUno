// Pre-commit (husky): se ejecuta solo sobre los archivos staged, no sobre todo el repo, para
// que commitear siga costando segundos. La verificación completa (lint + tsc + test + build)
// vive en el CI.
export default {
  "*.{ts,tsx}": [
    // --max-warnings=0: un warning nuevo no se cuela "para arreglar después".
    "eslint --max-warnings=0",
    // `related` corre los tests que importan los archivos tocados, directa o indirectamente.
    // passWithNoTests: tocar un archivo sin tests asociados no bloquea el commit.
    "vitest related --run --passWithNoTests",
  ],
}
