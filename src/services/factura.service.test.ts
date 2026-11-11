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
    crearConLineas: vi.fn(),
    insertImputaciones: vi.fn(),
    deleteImputacion: vi.fn(),
    update: vi.fn(),
    updateEstado: vi.fn(),
    deleteById: vi.fn(),
  },
}))

const repo = vi.mocked(FacturaRepository)

// El orden líneas -> totales -> imputaciones ahora lo garantiza fn_crear_factura adentro de
// la transacción (fn_check_imputacion compara contra la suma de las LFACT, que recién existe
// después de insertarlas). Lo que se prueba acá es que el service le pase las tres cosas en
// una sola llamada y que los totales por línea los calcule la app.
beforeEach(() => {
  vi.clearAllMocks()
  repo.crearConLineas.mockResolvedValue({ id: 1, numero_factura: "FACT-00001" } as never)
  repo.findLineasByFacturaId.mockResolvedValue([])
})

describe("FacturaService.create", () => {
  it("no manda numero_factura y fuerza estado 'borrador'", async () => {
    await FacturaService.create({
      proveedor_id: 2, fecha_emision: "2026-07-08", moneda: "ARS",
      lineas: [{ descripcion: "x", cantidad: 1, precio_unitario: 100, iva_porcentaje: 21 }],
    })
    const [cabecera] = repo.crearConLineas.mock.calls[0]
    expect(cabecera).toMatchObject({ estado: "borrador" })
    expect(cabecera).not.toHaveProperty("numero_factura")
  })

  it("calcula los totales de cada línea (no los acepta del cliente)", async () => {
    await FacturaService.create({
      proveedor_id: 2, fecha_emision: "2026-07-08", moneda: "ARS",
      lineas: [{ descripcion: "x", cantidad: 10, precio_unitario: 100, iva_porcentaje: 21, total_neto: 999, total_con_iva: 999 } as never],
    })
    const [, lineas] = repo.crearConLineas.mock.calls[0]
    expect(lineas).toEqual([
      expect.objectContaining({ descripcion: "x", total_neto: 1000, total_con_iva: 1210 }),
    ])
    // Sin factura_id: lo asigna la función con el id de la cabecera.
    expect(lineas[0]).not.toHaveProperty("factura_id")
  })

  it("manda cabecera, líneas e imputaciones en una sola llamada", async () => {
    await FacturaService.create({
      proveedor_id: 2, fecha_emision: "2026-07-08", moneda: "ARS",
      lineas: [{ descripcion: "x", cantidad: 10, precio_unitario: 100, iva_porcentaje: 21 }],
      imputaciones: [{ certificacion_id: 3, monto_asignado: 500 }],
    })
    expect(repo.crearConLineas).toHaveBeenCalledTimes(1)
    const [, , imputaciones] = repo.crearConLineas.mock.calls[0]
    expect(imputaciones).toEqual([{ certificacion_id: 3, monto_asignado: 500 }])
    // Los totales los calcula la transacción, no un update aparte.
    expect(repo.update).not.toHaveBeenCalled()
  })

  it("si el trigger rechaza la imputación, el error sube crudo y no se borra nada", async () => {
    const pg = Object.assign(new Error("Solo se pueden imputar certificaciones aprobadas"), { code: "P0001" })
    repo.crearConLineas.mockRejectedValue(pg)
    await expect(
      FacturaService.create({
        proveedor_id: 2, fecha_emision: "2026-07-08", moneda: "ARS",
        lineas: [{ descripcion: "x", cantidad: 1, precio_unitario: 100, iva_porcentaje: 21 }],
        imputaciones: [{ certificacion_id: 3, monto_asignado: 500 }],
      })
    ).rejects.toBe(pg)
    // Antes la factura quedaba creada y habia que compensar; ahora no existe.
    expect(repo.deleteById).not.toHaveBeenCalled()
  })

  it("sin imputaciones manda un array vacío", async () => {
    await FacturaService.create({
      proveedor_id: 2, fecha_emision: "2026-07-08", moneda: "ARS",
      lineas: [{ descripcion: "x", cantidad: 1, precio_unitario: 100, iva_porcentaje: 21 }],
    })
    expect(repo.crearConLineas.mock.calls[0][2]).toEqual([])
  })

  it("exige al menos una línea (422)", async () => {
    await expect(
      FacturaService.create({ proveedor_id: 2, fecha_emision: "2026-07-08", moneda: "ARS", lineas: [] })
    ).rejects.toMatchObject({ status: 422 })
    expect(repo.crearConLineas).not.toHaveBeenCalled()
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
