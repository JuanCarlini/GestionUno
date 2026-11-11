import { describe, it, expect } from "vitest"
import { totalesDeLinea, totalesDeCabecera, totalesDeCertificacion } from "./totales"

describe("totalesDeLinea", () => {
  it("calcula neto y con IVA", () => {
    expect(totalesDeLinea(10, 9500, 21)).toEqual({ total_neto: 95000, total_con_iva: 114950 })
  })

  it("IVA 0 deja neto = con IVA", () => {
    expect(totalesDeLinea(3, 100, 0)).toEqual({ total_neto: 300, total_con_iva: 300 })
  })

  it("redondea a 2 decimales (evita 0.30000000000000004)", () => {
    expect(totalesDeLinea(3, 0.1, 0).total_neto).toBe(0.3)
  })
})

describe("totalesDeCabecera", () => {
  it("suma líneas y deriva el IVA como con_iva - neto", () => {
    // línea 1: 95000 neto + 21% = 114950 (IVA 19950). línea 2: exenta.
    expect(
      totalesDeCabecera([
        { total_neto: 95000, total_con_iva: 114950 },
        { total_neto: 5000, total_con_iva: 5000 },
      ])
    ).toEqual({ total_neto: 100000, total_iva: 19950, total_con_iva: 119950 })
  })

  it("sin líneas devuelve ceros", () => {
    expect(totalesDeCabecera([])).toEqual({ total_neto: 0, total_iva: 0, total_con_iva: 0 })
  })

  it("tolera los numeric de Postgres que llegan como string", () => {
    expect(
      totalesDeCabecera([{ total_neto: "1000.00", total_con_iva: "1210.00" } as never])
    ).toEqual({ total_neto: 1000, total_iva: 210, total_con_iva: 1210 })
  })
})

// Las líneas de certificación son la excepción: avance_monto y iva_porcentaje los DERIVA
// el trigger fn_lce_derive (avance_unidades × precio de la LOC). Lo que la DB no hace es
// sumar la cabecera de la CE, que además solo tiene total_neto y total_con_iva (sin total_iva).
describe("totalesDeCertificacion", () => {
  it("suma avance_monto y aplica el IVA de cada línea", () => {
    expect(
      totalesDeCertificacion([
        { avance_monto: 570000, iva_porcentaje: 21 },
        { avance_monto: 30000, iva_porcentaje: 0 },
      ])
    ).toEqual({ total_neto: 600000, total_con_iva: 719700 })
  })

  it("sin líneas devuelve ceros", () => {
    expect(totalesDeCertificacion([])).toEqual({ total_neto: 0, total_con_iva: 0 })
  })

  it("tolera los numeric que llegan como string", () => {
    expect(
      totalesDeCertificacion([{ avance_monto: "100.00", iva_porcentaje: "21" } as never])
    ).toEqual({ total_neto: 100, total_con_iva: 121 })
  })
})
