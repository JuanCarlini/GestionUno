export type SortDirection = "asc" | "desc"

const COLLATOR = new Intl.Collator("es-AR", { numeric: true, sensitivity: "base" })

function isEmpty(valor: unknown): boolean {
  return valor === null || valor === undefined || valor === ""
}

// `get` opcional: permite ordenar por el valor QUE SE MUESTRA (p.ej. la etiqueta de un
// enum) en vez del crudo — sin él, "en_aprobacion" ordena distinto que "Esperando aprobación".
export function sortBy<T extends Record<string, unknown>>(
  items: T[],
  field: string,
  direction: SortDirection,
  get?: (item: T) => unknown
): T[] {
  const factor = direction === "asc" ? 1 : -1

  return [...items].sort((x, y) => {
    const a = get ? get(x) : x[field]
    const b = get ? get(y) : y[field]

    if (isEmpty(a) && isEmpty(b)) return 0
    if (isEmpty(a)) return 1
    if (isEmpty(b)) return -1

    if (typeof a === "number" && typeof b === "number") return (a - b) * factor
    return COLLATOR.compare(String(a), String(b)) * factor
  })
}
