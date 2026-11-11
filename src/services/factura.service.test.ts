import { describe, it, expect, vi, beforeEach } from "vitest"
import { FacturaRepository } from "@/repositories/factura.repository"
import { FacturaService } from "./factura.service"

vi.mock("@/repositories/factura.repository", () => ({
  FacturaRepository: {
    findAllWithProveedor: vi.fn(),
    findByIdWithProveedor: vi.fn(),
    findById: vi.fn(),
    findLineasByFacturaId: vi.fn(),
    findImputaciones: vi.fn(),
    findCertificacionesAprobadas: vi.fn(),
    findRollupsByIds: vi.fn(),
    insert: vi.fn(),
    insertLineas: vi.fn(),
    insertImputaciones: vi.fn(),
    deleteImputacion: vi.fn(),
    update: vi.fn(),
    updateEstado: vi.fn(),
    deleteById: vi.fn(),
  },
}))

const repo = vi.mocked(FacturaRepository)

// Orden de llamadas al crear: registra en qué orden se tocó el repo, para probar que las
// líneas se insertan ANTES que las imputaciones (fn_check_imputacion compara Σimput contra
// Σtotal_con_iva de las LFACT: si las imputaciones van primero, la suma de líneas es 0).
let orden: string[]

beforeEach(() => {
  vi.clearAllMocks()
  orden = []
  repo.insert.mockImplementation(async () => { orden.push("insert"); return { id: 1, numero_factura: "FACT-00001" } as never })
  repo.insertLineas.mockImplementation(async () => { orden.push("insertLineas") })
  repo.insertImputaciones.mockImplementation(async () => { orden.push("insertImputaciones") })
  repo.update.mockImplementation(async () => { orden.push("update"); return { id: 1 } as never })
  repo.findLineasByFacturaId.mockResolvedValue([])
})

describe("FacturaService.create", () => {
  it("no manda numero_factura y fuerza estado 'borrador'", async () => {
    await FacturaService.create({
      proveedor_id: 2, fecha_emision: "2026-07-08", moneda: "ARS",
      lineas: [{ descripcion: "x", cantidad: 1, precio_unitario: 100, iva_porcentaje: 21 }],
    })
    const arg = repo.insert.mock.calls[0][0]
    expect(arg).toMatchObject({ estado: "borrador" })
    expect(arg).not.toHaveProperty("numero_factura")
  })

  it("calcula los totales de cada línea (no los acepta del cliente)", async () => {
    await FacturaService.create({
      proveedor_id: 2, fecha_emision: "2026-07-08", moneda: "ARS",
      lineas: [{ descripcion: "x", cantidad: 10, precio_unitario: 100, iva_porcentaje: 21, total_neto: 999, total_con_iva: 999 } as never],
    })
    expect(repo.insertLineas).toHaveBeenCalledWith([
      expect.objectContaining({ factura_id: 1, descripcion: "x", total_neto: 1000, total_con_iva: 1210 }),
    ])
  })

  it("total_facturado = total_con_iva de las líneas", async () => {
    repo.findLineasByFacturaId.mockResolvedValue([{ total_neto: 1000, total_con_iva: 1210 }] as never)
    await FacturaService.create({
      proveedor_id: 2, fecha_emision: "2026-07-08", moneda: "ARS",
      lineas: [{ descripcion: "x", cantidad: 10, precio_unitario: 100, iva_porcentaje: 21 }],
    })
    expect(repo.update).toHaveBeenCalledWith(1, {
      total_neto: 1000, total_iva: 210, total_con_iva: 1210, total_facturado: 1210,
    })
  })

  it("inserta las LÍNEAS antes que las IMPUTACIONES (el trigger compara contra Σlfact)", async () => {
    await FacturaService.create({
      proveedor_id: 2, fecha_emision: "2026-07-08", moneda: "ARS",
      lineas: [{ descripcion: "x", cantidad: 10, precio_unitario: 100, iva_porcentaje: 21 }],
      imputaciones: [{ certificacion_id: 3, monto_asignado: 500 }],
    })
    expect(orden.indexOf("insertLineas")).toBeLessThan(orden.indexOf("insertImputaciones"))
    expect(repo.insertImputaciones).toHaveBeenCalledWith([
      { factura_id: 1, certificacion_id: 3, monto_asignado: 500 },
    ])
  })

  it("compensa borrando la factura si el trigger rechaza la imputación", async () => {
    const pg = Object.assign(new Error("Solo se pueden imputar certificaciones aprobadas"), { code: "P0001" })
    repo.insertImputaciones.mockRejectedValue(pg)
    await expect(
      FacturaService.create({
        proveedor_id: 2, fecha_emision: "2026-07-08", moneda: "ARS",
        lineas: [{ descripcion: "x", cantidad: 1, precio_unitario: 100, iva_porcentaje: 21 }],
        imputaciones: [{ certificacion_id: 3, monto_asignado: 500 }],
      })
    ).rejects.toBe(pg)
    expect(repo.deleteById).toHaveBeenCalledWith(1)
  })

  it("exige al menos una línea (422)", async () => {
    await expect(
      FacturaService.create({ proveedor_id: 2, fecha_emision: "2026-07-08", moneda: "ARS", lineas: [] })
    ).rejects.toMatchObject({ status: 422 })
    expect(repo.insert).not.toHaveBeenCalled()
  })
})

describe("FacturaService.cambiarEstado", () => {
  beforeEach(() => {
    repo.findById.mockResolvedValue({ id: 1, estado: "borrador", numero_factura: "FACT-00001" } as never)
  })

  it("no finaliza una factura sin imputaciones (422 — gap #5, pre-validación de app)", async () => {
    repo.findImputaciones.mockResolvedValue([])
    await expect(FacturaService.cambiarEstado(1, "finalizado")).rejects.toMatchObject({ status: 422 })
    expect(repo.updateEstado).not.toHaveBeenCalled()
  })

  it("finaliza con al menos una imputación", async () => {
    repo.findImputaciones.mockResolvedValue([{ certificacion_id: 3, monto_asignado: 500 }] as never)
    repo.updateEstado.mockResolvedValue({ id: 1, estado: "finalizado" } as never)
    await FacturaService.cambiarEstado(1, "finalizado")
    expect(repo.updateEstado).toHaveBeenCalledWith(1, "finalizado")
  })

  it("borrador -> anulado no exige imputaciones", async () => {
    repo.updateEstado.mockResolvedValue({ id: 1, estado: "anulado" } as never)
    await FacturaService.cambiarEstado(1, "anulado")
    expect(repo.findImputaciones).not.toHaveBeenCalled()
    expect(repo.updateEstado).toHaveBeenCalledWith(1, "anulado")
  })

  it("rechaza una transición imposible con 409 (borrador -> aprobado no existe en FACT)", async () => {
    await expect(FacturaService.cambiarEstado(1, "aprobado" as never)).rejects.toMatchObject({ status: 409 })
  })

  it("404 si la factura no existe", async () => {
    repo.findById.mockResolvedValue(null)
    await expect(FacturaService.cambiarEstado(9, "finalizado")).rejects.toMatchObject({ status: 404 })
  })
})

describe("FacturaService.imputar / desimputar (solo en borrador)", () => {
  it("agrega imputaciones a una factura en borrador", async () => {
    repo.findById.mockResolvedValue({ id: 1, estado: "borrador" } as never)
    await FacturaService.imputar(1, [{ certificacion_id: 3, monto_asignado: 200 }])
    expect(repo.insertImputaciones).toHaveBeenCalledWith([{ factura_id: 1, certificacion_id: 3, monto_asignado: 200 }])
  })

  it("no imputa sobre una factura finalizada (422)", async () => {
    repo.findById.mockResolvedValue({ id: 1, estado: "finalizado" } as never)
    await expect(FacturaService.imputar(1, [{ certificacion_id: 3, monto_asignado: 200 }])).rejects.toMatchObject({ status: 422 })
    expect(repo.insertImputaciones).not.toHaveBeenCalled()
  })

  it("desimputa una certificación de una factura en borrador", async () => {
    repo.findById.mockResolvedValue({ id: 1, estado: "borrador" } as never)
    repo.deleteImputacion.mockResolvedValue(true)
    await FacturaService.desimputar(1, 3)
    expect(repo.deleteImputacion).toHaveBeenCalledWith(1, 3)
  })
})

describe("FacturaService.getById — ensamblado", () => {
  it("aplana proveedor, trae líneas + imputaciones + rollup de pago", async () => {
    repo.findByIdWithProveedor.mockResolvedValue({ id: 1, gu_proveedores: { nombre: "Prov", cuit: "20-1" } } as never)
    repo.findLineasByFacturaId.mockResolvedValue([{ id: 9 }] as never)
    repo.findImputaciones.mockResolvedValue([{ certificacion_id: 5, monto_asignado: 300, gu_certificaciones: { numero_cert: "CE-00001.1" } }] as never)
    repo.findRollupsByIds.mockResolvedValue([{ factura_id: 1, monto_pagado: 0, estado_pago: "sin" }] as never)

    const res: any = await FacturaService.getById(1)

    expect(res.proveedor_nombre).toBe("Prov")
    expect(res.lineas).toHaveLength(1)
    expect(res.imputaciones[0]).toMatchObject({ certificacion_id: 5, monto_asignado: 300 })
    expect(res.estado_pago).toBe("sin")
  })

  it("null si no existe", async () => {
    repo.findByIdWithProveedor.mockResolvedValue(null)
    expect(await FacturaService.getById(9)).toBeNull()
  })
})
