import { describe, it, expect } from "vitest"
import { PasswordSchema } from "./password-validation"

// CN-010: los 3 puntos de entrada de claves (alta por admin, reset por admin, cambio
// propio) validaban `length >= 6` con la regla duplicada inline en cada ruta. Sin longitud
// máxima tampoco: bcrypt trunca en 72 bytes EN SILENCIO, así que dos claves distintas que
// comparten los primeros 72 bytes son la misma clave para el sistema.
describe("PasswordSchema", () => {
  it("rechaza menos de 12 caracteres", () => {
    expect(PasswordSchema.safeParse("Corta1").success).toBe(false)
    expect(PasswordSchema.safeParse("12345678901").success).toBe(false) // 11
  })

  it("acepta exactamente 12", () => {
    expect(PasswordSchema.safeParse("123456789012").success).toBe(true)
  })

  it("rechaza más de 72 bytes: bcrypt trunca ahí en silencio", () => {
    expect(PasswordSchema.safeParse("a".repeat(73)).success).toBe(false)
    expect(PasswordSchema.safeParse("a".repeat(72)).success).toBe(true)
  })

  it("cuenta BYTES, no caracteres: los acentos y emojis ocupan más de 1", () => {
    // 40 emojis = 160 bytes en UTF-8, pero solo 40 code points. Si midiéramos .length
    // pasaría el límite y bcrypt truncaría igual.
    expect(PasswordSchema.safeParse("😀".repeat(40)).success).toBe(false)
  })

  it("rechaza vacío y no-string", () => {
    expect(PasswordSchema.safeParse("").success).toBe(false)
    expect(PasswordSchema.safeParse(undefined).success).toBe(false)
    expect(PasswordSchema.safeParse(12345678901234).success).toBe(false)
  })

  it("el mensaje de error explica el mínimo", () => {
    const r = PasswordSchema.safeParse("corta")
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toMatch(/12/)
  })
})
