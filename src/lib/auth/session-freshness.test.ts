import { describe, it, expect } from "vitest"
import { tokenQuedoObsoleto } from "./session-freshness"

// CN-009: el JWT es stateless y changePassword/resetPassword solo pisaban password_hash.
// Un token emitido ANTES del cambio seguía siendo válido los 7 días completos, así que la
// remediación estándar ante una cuenta comprometida —"cambiale la contraseña"— NO expulsaba
// al atacante.
//
// La invalidación se resuelve comparando el `iat` del token (que jsonwebtoken ya pone)
// contra el `updated_at` de la fila: cero columnas nuevas, cero migración.
describe("tokenQuedoObsoleto", () => {
  const iat = 1_700_000_000 // segundos Unix
  const enISO = (seg: number) => new Date(seg * 1000).toISOString()

  it("el usuario cambió su clave DESPUÉS de emitirse el token → obsoleto", () => {
    expect(tokenQuedoObsoleto(iat, enISO(iat + 60))).toBe(true)
  })

  it("el token se emitió después del último cambio → sigue vigente", () => {
    expect(tokenQuedoObsoleto(iat, enISO(iat - 60))).toBe(false)
  })

  it("tolera 1 segundo: `iat` se trunca a segundos y podría quedar por detrás", () => {
    // Sin margen, un login en el mismo segundo que un update se auto-invalidaría.
    expect(tokenQuedoObsoleto(iat, enISO(iat) )).toBe(false)
    expect(tokenQuedoObsoleto(iat, new Date(iat * 1000 + 999).toISOString())).toBe(false)
    // Pasado el margen, sí invalida.
    expect(tokenQuedoObsoleto(iat, new Date(iat * 1000 + 2000).toISOString())).toBe(true)
  })

  it("sin updated_at no invalida: no hay información para decidir", () => {
    expect(tokenQuedoObsoleto(iat, null)).toBe(false)
    expect(tokenQuedoObsoleto(iat, undefined)).toBe(false)
  })

  it("FAIL-CLOSED: un token sin `iat` se considera obsoleto", () => {
    // jsonwebtoken siempre pone iat. Un token sin él está forjado a mano, y omitirlo
    // sería justamente la forma de evadir este chequeo.
    expect(tokenQuedoObsoleto(undefined, enISO(iat))).toBe(true)
  })

  it("una fecha inválida no invalida (no rompe el login por un dato corrupto)", () => {
    expect(tokenQuedoObsoleto(iat, "no-es-una-fecha")).toBe(false)
  })
})
