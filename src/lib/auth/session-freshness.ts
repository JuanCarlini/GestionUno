/**
 * Invalida sesiones al cambiar la credencial sin columna `token_version`: compara el `iat`
 * del JWT contra `updated_at` de gu_usuario. Cualquier update de la fila corta las sesiones.
 */

// `iat` se trunca a segundos, así que puede quedar hasta 1s por detrás de un `updated_at`
// del mismo instante. Sin este margen, un login simultáneo a un update se auto-invalidaría.
const TOLERANCIA_MS = 1000

export function tokenQuedoObsoleto(
  iatSegundos: number | undefined,
  updatedAt: string | null | undefined
): boolean {
  // Fail-closed: jsonwebtoken siempre emite `iat`. Un token sin él está armado a mano, y
  // omitirlo sería exactamente la forma de esquivar este chequeo.
  if (iatSegundos === undefined || iatSegundos === null) return true

  if (!updatedAt) return false // sin dato no se puede decidir: no invalidar

  const actualizado = Date.parse(updatedAt)
  if (Number.isNaN(actualizado)) return false // dato corrupto: no romper el login

  return actualizado > iatSegundos * 1000 + TOLERANCIA_MS
}
