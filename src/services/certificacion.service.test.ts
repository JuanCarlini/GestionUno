import { describe, it, expect, vi, beforeEach } from "vitest"
import { CertificacionRepository } from "@/repositories/certificacion.repository"
import { OrdenCompraRepository } from "@/repositories/orden-compra.repository"
import { CertificacionService } from "./certificacion.service"

vi.mock("@/repositories/certificacion.repository", () => ({
  CertificacionRepository: {
    findPaginaWithRelations: vi.fn(),
    findByIdWithRelations: vi.fn(),
    findLineasByCertId: vi.fn(),
    findLineasDisponibles: vi.fn(),
    findLocRollups: vi.fn(),
    findRollupsByIds: vi.fn(),
    crearConLineas: vi.fn(),
    update: vi.fn(),
    updateEstado: vi.fn(),
    deleteById: vi.fn(),
  },
}))
vi.mock("@/repositories/orden-compra.repository", () => ({
  OrdenCompraRepository: { findById: vi.fn() },
}))

const repo = vi.mocked(CertificacionRepository)
const ocRepo = vi.mocked(OrdenCompraRepository)

const OC_APROBADA = { id: 1, numero_oc: "OC-00001", proveedor_id: 2, estado: "aprobado" }

beforeEach(() => {
  vi.clearAllMocks()
  ocRepo.findById.mockResolvedValue(OC_APROBADA as never)
  repo.crearConLineas.mockResolvedValue({ id: 7, numero_cert: "CE-00001.1" } as never)
  repo.findLineasByCertId.mockResolvedValue([])
})

describe("CertificacionService.create", () => {
  it("hereda el proveedor de la OC, fuerza 'borrador' y no manda numero_cert", async () => {
    await CertificacionService.create({
      orden_compra_id: 1,
      fecha_devengado: "2026-07-08",
      lineas: [{ linea_oc_id: 10, avance_unidades: 60 }],
    })

    const [cabecera] = repo.crearConLineas.mock.calls[0]
    expect(cabecera).toMatchObject({ orden_compra_id: 1, proveedor_id: 2, estado: "borrador" })
    expect(cabecera).not.toHaveProperty("numero_cert")
  })

  it("404 si la OC no existe", async () => {
    ocRepo.findById.mockResolvedValue(null)
    await expect(
      CertificacionService.create({ orden_compra_id: 99, lineas: [{ linea_oc_id: 1, avance_unidades: 1 }] })
    ).rejects.toMatchObject({ status: 404 })
  })

  it.each(["borrador", "en_aprobacion", "rechazado", "anulado"])(
    "422 si la OC está en %s (el trigger fn_cert_oc_aprobada lo garantiza; esto solo pre-valida)",
    async (estado) => {
      ocRepo.findById.mockResolvedValue({ ...OC_APROBADA, estado } as never)
      await expect(
        CertificacionService.create({ orden_compra_id: 1, lineas: [{ linea_oc_id: 1, avance_unidades: 1 }] })
      ).rejects.toMatchObject({ status: 422 })
      expect(repo.crearConLineas).not.toHaveBeenCalled()
    }
  )

  it("las líneas solo llevan linea_oc_id y avance_unidades, sin certificacion_id", async () => {
    await CertificacionService.create({
      orden_compra_id: 1,
      lineas: [{ linea_oc_id: 10, avance_unidades: 60, avance_monto: 999, cantidad: 5 } as never],
    })
    const [, lineas] = repo.crearConLineas.mock.calls[0]
    // avance_monto y el resto los deriva fn_lce_derive; certificacion_id lo pone la función.
    expect(lineas).toEqual([{ linea_oc_id: 10, avance_unidades: 60 }])
  })

  it("una sola llamada: los totales de cabecera los suma la transacción", async () => {
    await CertificacionService.create({
      orden_compra_id: 1,
      lineas: [{ linea_oc_id: 10, avance_unidades: 60 }],
    })
    expect(repo.crearConLineas).toHaveBeenCalledTimes(1)
    // Antes eran insert + insertLineas + update, y un deleteById si el trigger pegaba.
    expect(repo.update).not.toHaveBeenCalled()
  })

  it("si el trigger del 100% rechaza una línea, el error sube crudo y no queda cabecera", async () => {
    const pg = Object.assign(
      new Error("No se puede certificar más del 100% de la línea de OC: cantidad 100, ya certificado 60, se intentó 110"),
      { code: "P0001" }
    )
    repo.crearConLineas.mockRejectedValue(pg)

    await expect(
      CertificacionService.create({ orden_compra_id: 1, lineas: [{ linea_oc_id: 10, avance_unidades: 110 }] })
    ).rejects.toBe(pg) // sin reinterpretar: la ruta lo mapea a 422 con el mensaje de la DB

    // La transacción se cayó entera: no hay nada que compensar.
    expect(repo.deleteById).not.toHaveBeenCalled()
  })

  it("exige al menos una línea (422)", async () => {
    await expect(CertificacionService.create({ orden_compra_id: 1, lineas: [] })).rejects.toMatchObject({
      status: 422,
    })
    expect(repo.crearConLineas).not.toHaveBeenCalled()
  })
})

describe("CertificacionService.cambiarEstado", () => {
  beforeEach(() => {
    repo.findByIdWithRelations.mockResolvedValue({ id: 7, estado: "borrador", numero_cert: "CE-00001.1" } as never)
  })

  it("rechaza una transición imposible con 409, sin tocar la DB", async () => {
    await expect(CertificacionService.cambiarEstado(7, "aprobado")).rejects.toMatchObject({ status: 409 })
    expect(repo.updateEstado).not.toHaveBeenCalled()
  })

  it("borrador -> en_aprobacion pasa, y manda el estado leído para el update condicional", async () => {
    repo.updateEstado.mockResolvedValue({ id: 7, estado: "en_aprobacion" } as never)
    await CertificacionService.cambiarEstado(7, "en_aprobacion")
    expect(repo.updateEstado).toHaveBeenCalledWith(7, "en_aprobacion", "borrador")
  })

  // Escritura concurrente: dos supervisores sobre la misma CE. El segundo leyó "borrador",
  // validó la transición y cuando fue a escribir el documento ya estaba en otro estado, así
  // que el update condicional no afectó ninguna fila.
  it("409 si otro ya cambió el estado entre la lectura y el update", async () => {
    repo.updateEstado.mockResolvedValue(null)
    await expect(CertificacionService.cambiarEstado(7, "en_aprobacion")).rejects.toMatchObject({
      status: 409,
    })
  })

  it("404 si la certificación no existe", async () => {
    repo.findByIdWithRelations.mockResolvedValue(null)
    await expect(CertificacionService.cambiarEstado(99, "en_aprobacion")).rejects.toMatchObject({ status: 404 })
  })
})

describe("CertificacionService.getLineasDisponibles — saldo leído de v_loc_rollup", () => {
  it("expone el avance y el disponible que publica la vista, por línea de la OC", async () => {
    repo.findLineasDisponibles.mockResolvedValue([
      { id: 10, numero_loc: "OC-00001.1", descripcion: "Hormigón", cantidad: 100, precio_unitario_neto: 5, iva_porcentaje: 21 },
    ] as never)
    repo.findLocRollups.mockResolvedValue([
      { linea_oc_id: 10, unidades_certificadas: 60, unidades_pendientes: 40, monto_pendiente: 200, estado_certificacion: "parcial" },
    ] as never)

    const res = await CertificacionService.getLineasDisponibles(1)

    expect(repo.findLineasDisponibles).toHaveBeenCalledWith(1)
    expect(res[0]).toMatchObject({
      id: 10,
      numero_loc: "OC-00001.1",
      cantidad: 100,
      cantidad_certificada: 60,
      cantidad_disponible: 40,
      estado_certificacion: "parcial",
    })
  })

  it("línea sin fila en la vista: disponible = cantidad total, estado 'sin'", async () => {
    repo.findLineasDisponibles.mockResolvedValue([
      { id: 11, numero_loc: "OC-00002.1", descripcion: "Acero", cantidad: 40, precio_unitario_neto: 2, iva_porcentaje: 21 },
    ] as never)
    repo.findLocRollups.mockResolvedValue([])

    const res = await CertificacionService.getLineasDisponibles(2)

    expect(res[0].cantidad_certificada).toBe(0)
    expect(res[0].cantidad_disponible).toBe(40)
    expect(res[0].estado_certificacion).toBe("sin")
  })

  it("OC sin líneas devuelve [] y no consulta la vista", async () => {
    repo.findLineasDisponibles.mockResolvedValue([])
    expect(await CertificacionService.getLineasDisponibles(3)).toEqual([])
    expect(repo.findLocRollups).not.toHaveBeenCalled()
  })
})

describe("CertificacionService.getAll — rollup de facturación leído de v_cert_rollup", () => {
  it("mergea estado_facturacion y monto_facturado por id", async () => {
    repo.findPaginaWithRelations.mockResolvedValue({ total: 2, data: [
      { id: 1, gu_proveedores: { nombre: "ABC" }, gu_ordenesdecompra: { numero_oc: "OC-00001" } },
      { id: 2, gu_proveedores: { nombre: "XYZ" }, gu_ordenesdecompra: { numero_oc: "OC-00002" } },
    ] } as never)
    repo.findRollupsByIds.mockResolvedValue([
      { certificacion_id: 1, monto_facturado: 500, estado_facturacion: "parcial" },
    ] as never)

    const { data: res } = await CertificacionService.getPagina({ page: 1, limit: 25 })

    expect(repo.findRollupsByIds).toHaveBeenCalledWith([1, 2])
    expect(res[0]).toMatchObject({
      proveedor_nombre: "ABC",
      numero_oc: "OC-00001",
      estado_facturacion: "parcial",
      monto_facturado: 500,
    })
    expect(res[1]).toMatchObject({ estado_facturacion: "sin", monto_facturado: 0 })
  })
})
