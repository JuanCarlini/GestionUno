import { describe, it, expect, vi, beforeEach } from "vitest"
import { OrdenCompraRepository } from "@/repositories/orden-compra.repository"
import { ItemPrecioRepository } from "@/repositories/item-precio.repository"
import { ItemService } from "./item.service"
import { OrdenCompraService } from "./orden-compra.service"

vi.mock("@/repositories/orden-compra.repository", () => ({
  OrdenCompraRepository: {
    insert: vi.fn(),
    findById: vi.fn(),
    insertLineas: vi.fn(),
    deleteById: vi.fn(),
    insertLinea: vi.fn(),
    findLineaById: vi.fn(),
    findLineasByOrdenId: vi.fn(),
    update: vi.fn(),
    updateEstado: vi.fn(),
    updateLinea: vi.fn(),
    deleteLinea: vi.fn(),
    findAll: vi.fn(),
    findRollupsByIds: vi.fn(),
  },
}))
vi.mock("@/repositories/item-precio.repository", () => ({
  ItemPrecioRepository: { findPrecio: vi.fn(), upsertPrecio: vi.fn() },
}))
vi.mock("./item.service", () => ({
  ItemService: { getById: vi.fn() },
}))

const repo = vi.mocked(OrdenCompraRepository)
const precios = vi.mocked(ItemPrecioRepository)
const itemSvc = vi.mocked(ItemService)

const OC_BORRADOR = { id: 55, proveedor_id: 2, estado: "borrador" }

beforeEach(() => {
  vi.clearAllMocks()
  repo.insert.mockResolvedValue({ id: 55, proveedor_id: 2, estado: "borrador" } as never)
  repo.findById.mockResolvedValue(OC_BORRADOR as never)
  repo.insertLineas.mockResolvedValue(undefined)
  repo.findLineasByOrdenId.mockResolvedValue([])
  repo.insertLinea.mockImplementation(async (l: never) => l)
  itemSvc.getById.mockResolvedValue({ id: 9, nombre: "Cemento" } as never)
})

describe("OrdenCompraService.create", () => {
  it("fuerza estado 'borrador' y no manda numero_oc (lo genera la DB)", async () => {
    await OrdenCompraService.create({ proveedor_id: 2, estado: "aprobado" } as never)
    const arg = repo.insert.mock.calls[0][0]
    expect(arg).toMatchObject({ estado: "borrador" })
    expect(arg).not.toHaveProperty("numero_oc")
  })

  it("compensa borrando la cabecera si fallan las líneas", async () => {
    repo.insertLineas.mockRejectedValue(new Error("trigger"))
    await expect(
      OrdenCompraService.create({
        proveedor_id: 2,
        lineas: [{ item_id: 9, cantidad: 1, precio_unitario_neto: 1 }],
      } as never)
    ).rejects.toThrow("trigger")
    expect(repo.deleteById).toHaveBeenCalledWith(55)
  })

  it("recalcula los totales de cabecera una sola vez, desde las líneas persistidas", async () => {
    repo.findLineasByOrdenId.mockResolvedValue([
      { total_neto: 95000, total_con_iva: 114950 },
      { total_neto: 5000, total_con_iva: 5000 },
    ] as never)

    await OrdenCompraService.create({
      proveedor_id: 2,
      lineas: [
        { item_id: 9, cantidad: 10, precio_unitario_neto: 9500 },
        { item_id: 8, cantidad: 1, precio_unitario_neto: 5000, iva_porcentaje: 0 },
      ],
    } as never)

    expect(repo.update).toHaveBeenCalledTimes(1)
    expect(repo.update).toHaveBeenCalledWith(55, {
      total_neto: 100000,
      total_iva: 19950,
      total_con_iva: 119950,
    })
  })
})

describe("OrdenCompraService.addLinea — precio por proveedor (alta al vuelo)", () => {
  it("hereda el precio del proveedor cuando la UI no manda precio", async () => {
    precios.findPrecio.mockResolvedValue(9200)

    await OrdenCompraService.addLinea(55, { item_id: 9, cantidad: 10 })

    expect(precios.findPrecio).toHaveBeenCalledWith(9, 2) // (item, proveedor de la OC)
    expect(precios.upsertPrecio).not.toHaveBeenCalled() // heredado: no se reescribe
    expect(repo.insertLinea).toHaveBeenCalledWith(
      expect.objectContaining({ precio_unitario_neto: 9200, total_neto: 92000, total_con_iva: 111320 })
    )
  })

  it("si la UI manda precio, lo guarda en la lista de precios del proveedor", async () => {
    await OrdenCompraService.addLinea(55, { item_id: 9, cantidad: 10, precio_unitario_neto: 9900 })

    expect(precios.upsertPrecio).toHaveBeenCalledWith(9, 2, 9900)
    expect(precios.findPrecio).not.toHaveBeenCalled()
  })

  it("sin precio en la puente y sin precio en el body -> 422", async () => {
    precios.findPrecio.mockResolvedValue(null)
    await expect(OrdenCompraService.addLinea(55, { item_id: 9, cantidad: 10 })).rejects.toMatchObject({
      status: 422,
    })
  })

  it("usa el nombre del item como descripción y IVA 21 por defecto", async () => {
    precios.findPrecio.mockResolvedValue(10)
    const linea: any = await OrdenCompraService.addLinea(55, { item_id: 9, cantidad: 4 })
    expect(linea).toMatchObject({ descripcion: "Cemento", iva_porcentaje: 21, total_con_iva: 48.4 })
  })

  it("404 si el item no existe", async () => {
    itemSvc.getById.mockResolvedValue(null)
    await expect(
      OrdenCompraService.addLinea(55, { item_id: 99, cantidad: 1, precio_unitario_neto: 1 })
    ).rejects.toMatchObject({ status: 404 })
  })

  it("recalcula la cabecera después de insertar", async () => {
    precios.findPrecio.mockResolvedValue(100)
    repo.findLineasByOrdenId.mockResolvedValue([{ total_neto: 100, total_con_iva: 121 }] as never)
    await OrdenCompraService.addLinea(55, { item_id: 9, cantidad: 1 })
    expect(repo.update).toHaveBeenCalledWith(55, { total_neto: 100, total_iva: 21, total_con_iva: 121 })
  })
})

describe("Guarda: las líneas solo se tocan con la OC editable", () => {
  it.each(["en_aprobacion", "aprobado", "anulado"])(
    "addLinea en una OC %s devuelve 422",
    async (estado) => {
      repo.findById.mockResolvedValue({ id: 55, proveedor_id: 2, estado } as never)
      await expect(
        OrdenCompraService.addLinea(55, { item_id: 9, cantidad: 1, precio_unitario_neto: 1 })
      ).rejects.toMatchObject({ status: 422 })
      expect(repo.insertLinea).not.toHaveBeenCalled()
    }
  )

  it("una OC rechazada vuelve a ser editable", async () => {
    repo.findById.mockResolvedValue({ id: 55, proveedor_id: 2, estado: "rechazado" } as never)
    precios.findPrecio.mockResolvedValue(10)
    await expect(OrdenCompraService.addLinea(55, { item_id: 9, cantidad: 1 })).resolves.toBeDefined()
  })

  it("updateLine en una OC aprobada devuelve 422 (rompería el rollup del 100%)", async () => {
    repo.findLineaById.mockResolvedValue({ id: 3, orden_compra_id: 55, cantidad: 1, precio_unitario_neto: 100, iva_porcentaje: 21 })
    repo.findById.mockResolvedValue({ id: 55, proveedor_id: 2, estado: "aprobado" } as never)
    await expect(OrdenCompraService.updateLine(3, { cantidad: 5 })).rejects.toMatchObject({ status: 422 })
    expect(repo.updateLinea).not.toHaveBeenCalled()
  })
})

// Las LÍNEAS ya estaban protegidas (arriba) por getEditable + el trigger trg_loc_oc_editable.
// La CABECERA no tenía ninguna guarda: cualquiera con `ordenes_compra:crear` podía reasignar
// una OC ya APROBADA a otro proveedor, o cambiarle la moneda, arrastrando las certificaciones
// y facturas que cuelgan de ella. Es justo el control que el producto existe para hacer
// cumplir ("nada se salta etapas"), y no hay trigger que lo cubra en la DB.
describe("Guarda: la cabecera solo se modifica con la OC editable", () => {
  it.each(["en_aprobacion", "aprobado", "anulado"])(
    "update de cabecera en una OC %s devuelve 422",
    async (estado) => {
      repo.findById.mockResolvedValue({ id: 55, proveedor_id: 2, estado } as never)
      await expect(OrdenCompraService.update(55, { proveedor_id: 99 })).rejects.toMatchObject({ status: 422 })
      expect(repo.update).not.toHaveBeenCalled()
    }
  )

  it.each(["en_aprobacion", "aprobado", "anulado"])(
    "delete de una OC %s devuelve 422",
    async (estado) => {
      repo.findById.mockResolvedValue({ id: 55, proveedor_id: 2, estado } as never)
      await expect(OrdenCompraService.delete(55)).rejects.toMatchObject({ status: 422 })
      expect(repo.deleteById).not.toHaveBeenCalled()
    }
  )

  it("update en borrador sí pasa", async () => {
    repo.findById.mockResolvedValue(OC_BORRADOR as never)
    repo.update.mockResolvedValue({ ...OC_BORRADOR, proveedor_id: 99 } as never)
    await expect(OrdenCompraService.update(55, { proveedor_id: 99 })).resolves.toBeDefined()
    expect(repo.update).toHaveBeenCalledWith(55, { proveedor_id: 99 })
  })

  it("update/delete en una OC rechazada sí pasan (vuelve a ser editable)", async () => {
    repo.findById.mockResolvedValue({ id: 55, proveedor_id: 2, estado: "rechazado" } as never)
    repo.update.mockResolvedValue({ id: 55 } as never)
    repo.deleteById.mockResolvedValue(true)
    await expect(OrdenCompraService.update(55, { tarea: "x" })).resolves.toBeDefined()
    await expect(OrdenCompraService.delete(55)).resolves.toBe(true)
  })

  it("update de una OC inexistente devuelve 404", async () => {
    repo.findById.mockResolvedValue(null as never)
    await expect(OrdenCompraService.update(404, { tarea: "x" })).rejects.toMatchObject({ status: 404 })
  })

  // REGRESIÓN: la guarda va en update(), NO en el repositorio. Si se pusiera abajo,
  // rompería estos dos caminos, que tocan la misma tabla a propósito sobre OCs no editables.
  it("cambiarEstado sigue funcionando sobre una OC no editable (usa updateEstado, no update)", async () => {
    repo.findById.mockResolvedValue({ id: 55, proveedor_id: 2, estado: "en_aprobacion" } as never)
    repo.updateEstado.mockResolvedValue({ id: 55, estado: "aprobado" } as never)
    await expect(OrdenCompraService.cambiarEstado(55, "aprobado")).resolves.toBeDefined()
    expect(repo.updateEstado).toHaveBeenCalledWith(55, "aprobado")
  })

  it("recalcularCabecera sigue funcionando sobre una OC no editable (va directo al repo)", async () => {
    repo.findById.mockResolvedValue({ id: 55, proveedor_id: 2, estado: "aprobado" } as never)
    repo.findLineasByOrdenId.mockResolvedValue([{ total_neto: 100, total_con_iva: 121 }] as never)
    await expect(OrdenCompraService.recalcularCabecera(55)).resolves.toBeUndefined()
    expect(repo.update).toHaveBeenCalled()
  })
})

describe("OrdenCompraService.updateLine / deleteLine — recálculo de cabecera", () => {
  beforeEach(() => {
    repo.findLineaById.mockResolvedValue({
      id: 3, orden_compra_id: 55, cantidad: 1, precio_unitario_neto: 100, iva_porcentaje: 21,
    })
    repo.updateLinea.mockImplementation(async (_id: number, u: never) => u)
    repo.deleteLinea.mockResolvedValue(true)
  })

  it("recalcula los totales de la línea cuando cambia la cantidad", async () => {
    await OrdenCompraService.updateLine(3, { cantidad: 5 })
    expect(repo.updateLinea).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ cantidad: 5, total_neto: 500, total_con_iva: 605 })
    )
  })

  it("recalcula la cabecera tras actualizar la línea", async () => {
    repo.findLineasByOrdenId.mockResolvedValue([{ total_neto: 500, total_con_iva: 605 }] as never)
    await OrdenCompraService.updateLine(3, { cantidad: 5 })
    expect(repo.update).toHaveBeenCalledWith(55, { total_neto: 500, total_iva: 105, total_con_iva: 605 })
  })

  it("recalcula la cabecera tras borrar la línea", async () => {
    repo.findLineasByOrdenId.mockResolvedValue([])
    await OrdenCompraService.deleteLine(3)
    expect(repo.update).toHaveBeenCalledWith(55, { total_neto: 0, total_iva: 0, total_con_iva: 0 })
  })

  it("404 si la línea no existe", async () => {
    repo.findLineaById.mockResolvedValue(null)
    await expect(OrdenCompraService.updateLine(999, { cantidad: 1 })).rejects.toMatchObject({ status: 404 })
  })
})

describe("OrdenCompraService.cambiarEstado", () => {
  it("rechaza una transición imposible con 409, sin tocar la DB", async () => {
    await expect(OrdenCompraService.cambiarEstado(55, "aprobado")).rejects.toMatchObject({ status: 409 })
    expect(repo.updateEstado).not.toHaveBeenCalled()
  })

  it("deja pasar borrador -> en_aprobacion (el gate de >=1 línea lo aplica el trigger)", async () => {
    repo.updateEstado.mockResolvedValue({ id: 55, estado: "en_aprobacion" } as never)
    await OrdenCompraService.cambiarEstado(55, "en_aprobacion")
    expect(repo.updateEstado).toHaveBeenCalledWith(55, "en_aprobacion")
  })

  it("propaga el error del trigger sin reinterpretarlo (la ruta lo hace 422)", async () => {
    const pg = Object.assign(new Error("La OC debe tener al menos una línea para mandarse a aprobar"), {
      code: "P0001",
    })
    repo.updateEstado.mockRejectedValue(pg)
    await expect(OrdenCompraService.cambiarEstado(55, "en_aprobacion")).rejects.toBe(pg)
  })

  it("404 si la OC no existe", async () => {
    repo.findById.mockResolvedValue(null)
    await expect(OrdenCompraService.cambiarEstado(999, "en_aprobacion")).rejects.toMatchObject({ status: 404 })
  })
})

describe("OrdenCompraService.getAll — rollup leído de la vista", () => {
  it("mergea estado_certificacion y monto_pendiente_certificar por id", async () => {
    repo.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }] as never)
    repo.findRollupsByIds.mockResolvedValue([
      { orden_compra_id: 1, estado_certificacion: "parcial", monto_pendiente_certificar: 40 },
    ] as never)

    const res: any[] = await OrdenCompraService.getAll()

    expect(repo.findRollupsByIds).toHaveBeenCalledWith([1, 2])
    expect(res[0]).toMatchObject({ id: 1, estado_certificacion: "parcial", monto_pendiente_certificar: 40 })
    // sin fila en la vista (OC sin líneas): 'sin'
    expect(res[1]).toMatchObject({ id: 2, estado_certificacion: "sin", monto_pendiente_certificar: 0 })
  })

  it("sin OCs no consulta la vista", async () => {
    repo.findAll.mockResolvedValue([] as never)
    expect(await OrdenCompraService.getAll()).toEqual([])
    expect(repo.findRollupsByIds).not.toHaveBeenCalled()
  })
})
