// Nunca se agrega a través de monedas: cada pestaña parte las filas por moneda y
// recién ahí reduce. Este helper es esa partición, escrita una sola vez.
export function porMoneda<T extends { moneda?: unknown }>(filas: T[]): Array<[string, T[]]> {
  return [...new Set(filas.map((f) => String(f.moneda)))].map((moneda) => [
    moneda,
    filas.filter((f) => String(f.moneda) === moneda),
  ])
}
