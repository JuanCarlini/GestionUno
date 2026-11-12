import { describe, it, expect } from "vitest"
import { PasswordSchema } from "./password-validation"
import { CambiarActivoSchema } from "./estado-validation"

// Estos mensajes son lo que ve el usuario en el formulario, no detalle interno: viajan tal
// cual en el 400 que arma handleRouteError. zod 4 unificó required_error e invalid_type_error
// en un solo `error`, así que la traducción pudo haber aplanado los dos casos en uno. Acá
// queda fijado que siguen siendo distintos.
function mensajes(schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string }[] } } }, valor: unknown) {
  const r = schema.safeParse(valor)
  return r.success ? [] : (r.error?.issues ?? []).map((i) => i.message)
}

describe("PasswordSchema — qué dice cuando el dato está mal", () => {
  it("si no vino la contraseña, dice que falta", () => {
    expect(mensajes(PasswordSchema, undefined)).toContain("La contraseña es requerida")
  })

  it("si vino algo que no es texto, lo dice distinto", () => {
    const m = mensajes(PasswordSchema, 12345678901234)
    expect(m).toContain("La contraseña debe ser texto")
    // El de "falta" no tiene por qué aparecer: el campo vino, el problema es el tipo.
    expect(m).not.toContain("La contraseña es requerida")
  })

  it("si es corta, dice el mínimo", () => {
    expect(mensajes(PasswordSchema, "corta")).toContain(
      "La contraseña debe tener al menos 12 caracteres"
    )
  })

  it("si pasa los 72 bytes, lo dice (bcrypt trunca ahí)", () => {
    // 73 caracteres ASCII = 73 bytes.
    expect(mensajes(PasswordSchema, "a".repeat(73)).join(" ")).toContain("72 bytes")
  })

  it("una contraseña válida pasa", () => {
    expect(PasswordSchema.safeParse("unaClaveLarga123").success).toBe(true)
  })

  it("cuenta bytes y no caracteres: 72 emojis son muchos más de 72 bytes", () => {
    // Cada emoji ocupa 4 bytes en UTF-8. Si contara caracteres, esto pasaría.
    expect(PasswordSchema.safeParse("🙂".repeat(72)).success).toBe(false)
  })
})

describe("CambiarActivoSchema — qué dice cuando el dato está mal", () => {
  it("si no vino activo, dice qué se esperaba", () => {
    expect(mensajes(CambiarActivoSchema, {})).toContain(
      "Indicá el estado al que querés llevar el recurso"
    )
  })

  it("si activo no es booleano, deja hablar al mensaje por defecto", () => {
    // El código solo pisaba el mensaje de campo faltante: el de tipo equivocado sigue siendo
    // el de zod. Si alguien pone un string en `error`, los dos casos dirían lo mismo y este
    // test lo agarra.
    const m = mensajes(CambiarActivoSchema, { activo: "si" })
    expect(m.length).toBe(1)
    expect(m).not.toContain("Indicá el estado al que querés llevar el recurso")
  })

  it("acepta true y false", () => {
    expect(CambiarActivoSchema.safeParse({ activo: true }).success).toBe(true)
    expect(CambiarActivoSchema.safeParse({ activo: false }).success).toBe(true)
  })
})
