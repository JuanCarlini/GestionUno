import { describe, it, expect } from "vitest"
import {
  puedeTransicionar,
  accionRequerida,
  TRANSICIONES_APROBACION,
  TRANSICIONES_FACTURA,
  TRANSICIONES_OP,
} from "./transiciones"

describe("puedeTransicionar", () => {
  it("permite borrador -> en_aprobacion en OC/CE", () => {
    expect(puedeTransicionar(TRANSICIONES_APROBACION, "borrador", "en_aprobacion")).toBe(true)
  })

  it("prohíbe saltar borrador -> aprobado (nada se saltea etapas)", () => {
    expect(puedeTransicionar(TRANSICIONES_APROBACION, "borrador", "aprobado")).toBe(false)
  })

  it("anulado es terminal", () => {
    expect(puedeTransicionar(TRANSICIONES_APROBACION, "anulado", "borrador")).toBe(false)
  })

  it("rechazado vuelve a borrador", () => {
    expect(puedeTransicionar(TRANSICIONES_APROBACION, "rechazado", "borrador")).toBe(true)
  })

  it("FACT finaliza sin aprobación intermedia", () => {
    expect(puedeTransicionar(TRANSICIONES_FACTURA, "borrador", "finalizado")).toBe(true)
  })

  it("OP: aprobado -> pagado", () => {
    expect(puedeTransicionar(TRANSICIONES_OP, "aprobado", "pagado")).toBe(true)
  })

  it("OP: en_aprobacion -> pagado NO (hay que aprobar primero)", () => {
    expect(puedeTransicionar(TRANSICIONES_OP, "en_aprobacion", "pagado")).toBe(false)
  })

  it("OP: pagado es terminal", () => {
    expect(puedeTransicionar(TRANSICIONES_OP, "pagado", "anulado")).toBe(false)
  })
})

describe("accionRequerida (permiso RBAC por destino)", () => {
  it.each(["aprobado", "rechazado", "anulado"])("%s → 'aprobar'", (estado) => {
    expect(accionRequerida(estado)).toBe("aprobar")
  })

  it("en_aprobacion / borrador → 'crear'", () => {
    expect(accionRequerida("en_aprobacion")).toBe("crear")
    expect(accionRequerida("borrador")).toBe("crear")
  })
})
