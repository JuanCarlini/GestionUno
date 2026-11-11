import { describe, it, expect } from "vitest"
import { CreateProyectoSchema } from "./proyecto-validation"

describe("CreateProyectoSchema", () => {
  it("exige nombre", () => {
    expect(CreateProyectoSchema.safeParse({}).success).toBe(false)
    expect(CreateProyectoSchema.safeParse({ nombre: "" }).success).toBe(false)
  })

  it("acepta el proyecto con los campos opcionales", () => {
    const r = CreateProyectoSchema.safeParse({
      nombre: "Obra Norte",
      codigo: "ON-1",
      fecha_inicio: "2026-01-01",
    })
    expect(r.success).toBe(true)
  })

  it("descarta campos no whitelisteados (S4: estado/id no se pueden forzar)", () => {
    const r = CreateProyectoSchema.parse({
      nombre: "Obra Sur",
      estado: "completado",
      id: 999,
      created_at: "2020-01-01",
    })
    expect(r).toEqual({ nombre: "Obra Sur" })
    expect("estado" in r).toBe(false)
    expect("id" in r).toBe(false)
  })
})
