import { describe, it, expect, vi, beforeEach } from "vitest"
import { OrdenPagoRepository } from "@/repositories/orden-pago.repository"
import { OrdenPagoService } from "./orden-pago.service"

vi.mock("@/repositories/orden-pago.repository", () => ({
  OrdenPagoRepository: {
    findAllWithProveedor: vi.fn(),
    findByIdWithProveedor: vi.fn(),
    findById: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    updateEstado: vi.fn(),
    delete: vi.fn(),
    findLineasFactura: vi.fn(),
    insertLineaFactura: vi.fn(),
    deleteLineaFactura: vi.fn(),
    findLineasCaja: vi.fn(),
    insertLineaCaja: vi.fn(),
    deleteLineaCaja: vi.fn(),
  },
}))

const repo = vi.mocked(OrdenPagoRepository)
const OP_BORRADOR = { id: 1, estado: "borrador", moneda: "ARS", numero_op: "OP-00001" }

beforeEach(() => {
  vi.clearAllMocks()
  repo.insert.mockResolvedValue({ id: 1, numero_op: "OP-00001", estado: "borrador" } as never)
  repo.findById.mockResolvedValue(OP_BORRADOR as never)
  repo.findLineasFactura.mockResolvedValue([])
})

describe("OrdenPagoService.create", () => {
  it("estado inicial 'borrador' (ya no 'pendiente'), sin numero_op, total_a_pagar 0", async () => {
    await OrdenPagoService.create({ proveedor_id: 2, fecha_op: "2026-07-08", moneda: "ARS" })
    const arg = repo.insert.mock.calls[0][0]
    expect(arg).toMatchObject({ estado: "borrador", total_a_pagar: 0 })
    expect(arg).not.toHaveProperty("numero_op")
  })

  it("ignora un estado mandado por el cliente (S2)", async () => {
    await OrdenPagoService.create({ proveedor_id: 2, moneda: "ARS", estado: "pagado" } as never)
    expect(repo.insert).toHaveBeenCalledWith(expect.objectContaining({ estado: "borrador" }))
  })
})

describe("OrdenPagoService.agregarFactura", () => {
  it("inserta la línea y recalcula total_a_pagar = Σ de las líneas de factura", async () => {
    repo.insertLineaFactura.mockResolvedValue({ id: 9 } as never)
    repo.findLineasFactura.mockResolvedValue([{ monto: 300000 }, { monto: 270000 }] as never)

    await OrdenPagoService.agregarFactura(1, { factura_id: 9, monto: 270000 })

    expect(repo.insertLineaFactura).toHaveBeenCalledWith({ orden_pago_id: 1, factura_id: 9, monto: 270000 })
    expect(repo.update).toHaveBeenCalledWith(1, { total_a_pagar: 570000 })
  })

  it("404 si la OP no existe", async () => {
    repo.findById.mockResolvedValue(null)
    await expect(OrdenPagoService.agregarFactura(9, { factura_id: 1, monto: 1 })).rejects.toMatchObject({ status: 404 })
  })

  it.each(["en_aprobacion", "aprobado", "pagado"])(
    "422 si la OP está en %s (las facturas solo se tocan en borrador)",
    async (estado) => {
      repo.findById.mockResolvedValue({ ...OP_BORRADOR, estado } as never)
      await expect(OrdenPagoService.agregarFactura(1, { factura_id: 1, monto: 1 })).rejects.toMatchObject({ status: 422 })
      expect(repo.insertLineaFactura).not.toHaveBeenCalled()
    }
  )

  it("propaga el error del trigger (factura no finalizada / otra moneda) sin reinterpretarlo", async () => {
    const pg = Object.assign(new Error("Solo se pueden pagar facturas finalizadas (la factura 9 está en estado \"borrador\")"), { code: "P0001" })
    repo.insertLineaFactura.mockRejectedValue(pg)
    await expect(OrdenPagoService.agregarFactura(1, { factura_id: 9, monto: 1 })).rejects.toBe(pg)
    expect(repo.update).not.toHaveBeenCalled() // no recalcula si la línea no entró
  })
})

describe("OrdenPagoService.quitarFactura", () => {
  it("borra la línea y recalcula total_a_pagar", async () => {
    repo.deleteLineaFactura.mockResolvedValue(true)
    repo.findLineasFactura.mockResolvedValue([{ monto: 300000 }] as never)
    await OrdenPagoService.quitarFactura(1, 9)
    expect(repo.deleteLineaFactura).toHaveBeenCalledWith(1, 9)
    expect(repo.update).toHaveBeenCalledWith(1, { total_a_pagar: 300000 })
  })
})

describe("OrdenPagoService.agregarCaja / quitarCaja", () => {
  it("agrega una caja sin recalcular total (el total lo fijan las facturas)", async () => {
    repo.insertLineaCaja.mockResolvedValue({ id: 5 } as never)
    await OrdenPagoService.agregarCaja(1, { caja_id: 3, monto: 300000 })
    expect(repo.insertLineaCaja).toHaveBeenCalledWith({ orden_pago_id: 1, caja_id: 3, monto: 300000 })
    expect(repo.update).not.toHaveBeenCalled() // fn_op_gate valida Σcajas=total al mandar a aprobar
  })

  it("no agrega cajas sobre una OP fuera de borrador (422)", async () => {
    repo.findById.mockResolvedValue({ ...OP_BORRADOR, estado: "aprobado" } as never)
    await expect(OrdenPagoService.agregarCaja(1, { caja_id: 3, monto: 1 })).rejects.toMatchObject({ status: 422 })
  })
})

describe("OrdenPagoService.cambiarEstado", () => {
  it("borrador -> en_aprobacion pasa (el gate Σcajas=Σfacturas=total lo aplica fn_op_gate)", async () => {
    repo.updateEstado.mockResolvedValue({ id: 1, estado: "en_aprobacion" } as never)
    await OrdenPagoService.cambiarEstado(1, "en_aprobacion")
    expect(repo.updateEstado).toHaveBeenCalledWith(1, "en_aprobacion")
  })

  it("no permite pagar directo desde en_aprobacion (409: falta aprobar)", async () => {
    repo.findById.mockResolvedValue({ ...OP_BORRADOR, estado: "en_aprobacion" } as never)
    await expect(OrdenPagoService.cambiarEstado(1, "pagado")).rejects.toMatchObject({ status: 409 })
  })

  it("aprobado -> pagado pasa", async () => {
    repo.findById.mockResolvedValue({ ...OP_BORRADOR, estado: "aprobado" } as never)
    repo.updateEstado.mockResolvedValue({ id: 1, estado: "pagado" } as never)
    await OrdenPagoService.cambiarEstado(1, "pagado")
    expect(repo.updateEstado).toHaveBeenCalledWith(1, "pagado")
  })

  it("propaga el error del gate (Σ no coincide) sin reinterpretarlo", async () => {
    const pg = Object.assign(new Error("El total de las cajas (100) debe igualar el total a pagar (570000)"), { code: "P0001" })
    repo.updateEstado.mockRejectedValue(pg)
    await expect(OrdenPagoService.cambiarEstado(1, "en_aprobacion")).rejects.toBe(pg)
  })

  it("404 si la OP no existe", async () => {
    repo.findById.mockResolvedValue(null)
    await expect(OrdenPagoService.cambiarEstado(9, "en_aprobacion")).rejects.toMatchObject({ status: 404 })
  })
})

describe("OrdenPagoService.getById — ensamblado", () => {
  it("trae la OP con proveedor aplanado + facturas + cajas", async () => {
    repo.findByIdWithProveedor.mockResolvedValue({ id: 1, gu_proveedores: { nombre: "ABC" } } as never)
    repo.findLineasFactura.mockResolvedValue([{ factura_id: 9, monto: 570000, gu_facturas: { numero_factura: "FACT-00001" } }] as never)
    repo.findLineasCaja.mockResolvedValue([{ caja_id: 3, monto: 570000, gu_cajas: { nombre: "Galicia" } }] as never)

    const res: any = await OrdenPagoService.getById(1)

    expect(res.proveedor_nombre).toBe("ABC")
    expect(res.facturas).toHaveLength(1)
    expect(res.cajas).toHaveLength(1)
  })
})
