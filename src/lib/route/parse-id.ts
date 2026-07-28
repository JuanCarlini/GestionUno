import { HttpError } from "./http-error"

// Frontera string→number de las rutas [id]. Las PK son BIGINT: entero positivo o nada.
// Único lugar donde se convierte; no hay `Number(id)` sueltos ni `id: string` en el dominio.
export function parseId(raw: string | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) throw new HttpError(400, `ID inválido: ${raw ?? "(vacío)"}`)
  const n = Number(raw)
  if (!Number.isSafeInteger(n) || n <= 0) throw new HttpError(400, `ID inválido: ${raw}`)
  return n
}
