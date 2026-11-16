import { describe, it, expect, vi, beforeEach } from "vitest"
import { OrdenCompraRepository } from "@/repositories/orden-compra.repository"
import { ItemPrecioRepository } from "@/repositories/item-precio.repository"
import { ItemService } from "./item.service"
import { OrdenCompraService } from "./orden-compra.service"

vi.mock("@/repositories/orden-compra.repository", () => ({
  OrdenCompraRepository: {
    crearConLineas: vi.fn(),
    findById: vi.fn(),
    deleteById: vi.fn(),
    insertLinea: vi.fn(),
    findLineaById: vi.fn(),
    findLineasByOrdenId: vi.fn(),
    update: vi.fn(),
    updateEstado: vi.fn(),
    updateLinea: vi.fn(),
    deleteLinea: vi.fn(),
    findPagina: vi.fn(),
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

const OC_BORRADOR = { id: 55, proveedor_id: 2, estado: "borrador", created_by: 1 }

// update/delete reciben un actor desde 8ccb575: ademas del permiso por rol, una OC ajena no
// se toca salvo que el actor pueda aprobar. Este bloque mide la guarda de ESTADO, asi que usa
// un actor con puedeAjenas para no mezclar las dos reglas; la guarda de dueno se prueba aparte.
const ACTOR = { id: 1, puedeAjenas: true }

beforeEach(() => {
  vi.clearAllMocks()
  repo.crearConLineas.mockResolvedValue({ id: 55, proveedor_id: 2, estado: "borrador" } as never)
  repo.findById.mockResolvedValue(OC_BORRADOR as never)
  repo.findLineasByOrdenId.mockResolvedValue([])
  repo.insertLinea.mockImplementation(async (l) => l as never)
  itemSvc.getById.mockResolvedValue({ id: 9, nombre: "Cemento" } as never)
})

describe("OrdenCompraService.create", () => {
  it("manda la cabecera sin numero_oc ni estado: los pone la funcion", async () => {
    await OrdenCompraService.create({ proveedor_id: 2, estado: "aprobado" } as never, 7)
    const [cabecera] = repo.crearConLineas.mock.calls[0]
    expect(cabecera).toMatchObject({ proveedor_id: 2, created_by: 7 })
    expect(cabecera).not.toHaveProperty("numero_oc")
  })

  it("arma las lineas antes del alta y las manda sin orden_compra_id", async () => {
    await OrdenCompraService.create(
      {
        proveedor_id: 2,
        lineas: [
          { item_id: 9, cantidad: 10, precio_unitario_neto: 9500 },
          { item_id: 8, cantidad: 1, precio_unitario_neto: 5000, iva_porcentaje: 0 },
        ],
      } as never,
      7
    )

    const [, lineas] = repo.crearConLineas.mock.calls[0]
    expect(lineas).toHaveLength(2)
    // La cabecera todavia no existe cuando se arman: el id lo pone la funcion.
    expect(lineas[0]).not.toHaveProperty("orden_compra_id")
    // Los totales por linea los sigue calculando la app.
    expect(lineas[0]).toMatchObject({ total_neto: 95000, total_con_iva: 114950 })
    expect(lineas[1]).toMatchObject({ total_neto: 5000, total_con_iva: 5000 })
  })

  it("una sola llamada a la base: ni compensacion ni recalculo aparte", async () => {
    await OrdenCompraService.create(
      { proveedor_id: 2, lineas: [{ item_id: 9, cantidad: 1, precio_unitario_neto: 1 }] } as never,
      7
    )
    expect(repo.crearConLineas).toHaveBeenCalledTimes(1)
    // Lo que antes eran insert + insertLineas + update, y un deleteById si algo fallaba.
    expect(repo.update).not.toHaveBeenCalled()
    expect(repo.deleteById).not.toHaveBeenCalled()
  })

  it("si la transaccion falla, el error sube crudo y no se intenta borrar nada", async () => {
    repo.crearConLineas.mockRejectedValue(new Error("trigger"))
    await expect(
      OrdenCompraService.create(
        { proveedor_id: 2, lineas: [{ item_id: 9, cantidad: 1, precio_unitario_neto: 1 }] } as never,
        7
      )
    ).rejects.toThrow("trigger")
    // No hay cabecera huerfana que compensar: la transaccion se cayo entera.
    expect(repo.deleteById).not.toHaveBeenCalled()
  })

  it("sin lineas manda un array vacio", async () => {
    await OrdenCompraService.create({ proveedor_id: 2 } as never, 7)
    expect(repo.crearConLineas.mock.calls[0][1]).toEqual([])
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

  it("no reescribe la cabecera despues de insertar (lo hace el trigger)", async () => {
    precios.findPrecio.mockResolvedValue(100)
    await OrdenCompraService.addLinea(55, { item_id: 9, cantidad: 1 })
    expect(repo.update).not.toHaveBeenCalled()
    expect(repo.findLineasByOrdenId).not.toHaveBeenCalled()
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
      await expect(
        OrdenCompraService.update(55, { proveedor_id: 99 }, ACTOR)
      ).rejects.toMatchObject({ status: 422 })
      expect(repo.update).not.toHaveBeenCalled()
    }
  )

  it.each(["en_aprobacion", "aprobado", "anulado"])(
    "delete de una OC %s devuelve 422",
    async (estado) => {
      repo.findById.mockResolvedValue({ id: 55, proveedor_id: 2, estado } as never)
      await expect(OrdenCompraService.delete(55, ACTOR)).rejects.toMatchObject({ status: 422 })
      expect(repo.deleteById).not.toHaveBeenCalled()
    }
  )

  it("update en borrador sí pasa", async () => {
    repo.findById.mockResolvedValue(OC_BORRADOR as never)
    repo.update.mockResolvedValue({ ...OC_BORRADOR, proveedor_id: 99 } as never)
    await expect(OrdenCompraService.update(55, { proveedor_id: 99 }, ACTOR)).resolves.toBeDefined()
    expect(repo.update).toHaveBeenCalledWith(55, { proveedor_id: 99 })
  })

  it("update/delete en una OC rechazada sí pasan (vuelve a ser editable)", async () => {
    repo.findById.mockResolvedValue({ id: 55, proveedor_id: 2, estado: "rechazado" } as never)
    repo.update.mockResolvedValue({ id: 55 } as never)
    repo.deleteById.mockResolvedValue(true)
    await expect(OrdenCompraService.update(55, { tarea: "x" }, ACTOR)).resolves.toBeDefined()
    await expect(OrdenCompraService.delete(55, ACTOR)).resolves.toBe(true)
  })

  it("update de una OC inexistente devuelve 404", async () => {
    repo.findById.mockResolvedValue(null as never)
    await expect(
      OrdenCompraService.update(404, { tarea: "x" }, ACTOR)
    ).rejects.toMatchObject({ status: 404 })
  })

  // REGRESIÓN: la guarda va en update(), NO en el repositorio. Si se pusiera abajo,
  // rompería estos dos caminos, que tocan la misma tabla a propósito sobre OCs no editables.
  it("cambiarEstado sigue funcionando sobre una OC no editable (usa updateEstado, no update)", async () => {
    repo.findById.mockResolvedValue({ id: 55, proveedor_id: 2, estado: "en_aprobacion" } as never)
    repo.updateEstado.mockResolvedValue({ id: 55, estado: "aprobado" } as never)
    await expect(OrdenCompraService.cambiarEstado(55, "aprobado")).resolves.toBeDefined()
    expect(repo.updateEstado).toHaveBeenCalledWith(55, "aprobado", "en_aprobacion")
  })

})

describe("OrdenCompraService.updateLine / deleteLine", () => {
  beforeEach(() => {
    repo.findLineaById.mockResolvedValue({
      id: 3, orden_compra_id: 55, cantidad: 1, precio_unitario_neto: 100, iva_porcentaje: 21,
    })
    repo.updateLinea.mockImplementation(async (_id, u) => u as never)
    repo.deleteLinea.mockResolvedValue(true)
  })

  it("recalcula los totales de la línea cuando cambia la cantidad", async () => {
    await OrdenCompraService.updateLine(3, { cantidad: 5 })
    expect(repo.updateLinea).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ cantidad: 5, total_neto: 500, total_con_iva: 605 })
    )
  })

  // Los totales de cabecera los recalcula trg_recalc_oc_cabecera en la misma transacción que
  // cambió la línea: la app ya no los lee ni los escribe. Antes eran dos round-trips, y dos
  // ediciones simultáneas se intercalaban entre ellos y dejaban el total viejo.
  it("no reescribe la cabecera tras actualizar la línea (lo hace el trigger)", async () => {
    await OrdenCompraService.updateLine(3, { cantidad: 5 })
    expect(repo.update).not.toHaveBeenCalled()
    expect(repo.findLineasByOrdenId).not.toHaveBeenCalled()
  })

  it("no reescribe la cabecera tras borrar la línea (lo hace el trigger)", async () => {
    await OrdenCompraService.deleteLine(3)
    expect(repo.update).not.toHaveBeenCalled()
    expect(repo.findLineasByOrdenId).not.toHaveBeenCalled()
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
    // El tercer argumento es el estado leído: sin él, dos supervisores simultáneos pisaban
    // el cambio del otro y ganaba el último en escribir.
    expect(repo.updateEstado).toHaveBeenCalledWith(55, "en_aprobacion", "borrador")
  })

  it("409 si otro ya cambió el estado entre la lectura y el update", async () => {
    repo.updateEstado.mockResolvedValue(null)
    await expect(OrdenCompraService.cambiarEstado(55, "en_aprobacion")).rejects.toMatchObject({
      status: 409,
    })
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

// Regla de dueño (commit 8ccb575): además del permiso por rol que ya cortó la ruta, una OC
// ajena no se modifica ni se borra salvo que el actor pueda aprobar. puedeAjenas lo resuelve
// la ruta con usuarioTienePermiso(user, "ordenes_compra", "aprobar"), así que acá se prueba
// la decisión, no cómo se obtiene.
//
// 403 y no 404 a propósito: el usuario tiene ordenes_compra:ver, así que la OC ya la ve en el
// listado; devolver 404 no esconde nada y confunde el diagnóstico.
describe("OrdenCompraService.verificarDueno — solo el creador edita su OC", () => {
  const DUENO = { id: 1, puedeAjenas: false }
  const OTRO = { id: 2, puedeAjenas: false }
  const SUPERVISOR = { id: 9, puedeAjenas: true }

  // OC_BORRADOR tiene created_by: 1.
  it("el dueño puede editar y borrar su OC", async () => {
    repo.update.mockResolvedValue({ ...OC_BORRADOR, tarea: "x" } as never)
    repo.deleteById.mockResolvedValue(true)

    await expect(OrdenCompraService.update(55, { tarea: "x" }, DUENO)).resolves.toBeDefined()
    await expect(OrdenCompraService.delete(55, DUENO)).resolves.toBe(true)
  })

  it("otro usuario recibe 403 al editar, y no se toca la fila", async () => {
    await expect(OrdenCompraService.update(55, { tarea: "x" }, OTRO)).rejects.toMatchObject({
      status: 403,
    })
    expect(repo.update).not.toHaveBeenCalled()
  })

  it("otro usuario recibe 403 al borrar, y no se toca la fila", async () => {
    await expect(OrdenCompraService.delete(55, OTRO)).rejects.toMatchObject({ status: 403 })
    expect(repo.deleteById).not.toHaveBeenCalled()
  })

  it("un supervisor puede editar y borrar OCs ajenas", async () => {
    repo.update.mockResolvedValue({ ...OC_BORRADOR, tarea: "x" } as never)
    repo.deleteById.mockResolvedValue(true)

    await expect(OrdenCompraService.update(55, { tarea: "x" }, SUPERVISOR)).resolves.toBeDefined()
    await expect(OrdenCompraService.delete(55, SUPERVISOR)).resolves.toBe(true)
  })

  it("la guarda de estado corre antes que la de dueño: una OC aprobada da 422 incluso al dueño", async () => {
    repo.findById.mockResolvedValue({ ...OC_BORRADOR, estado: "aprobado" } as never)
    await expect(OrdenCompraService.update(55, { tarea: "x" }, DUENO)).rejects.toMatchObject({
      status: 422,
    })
  })

  // Llamada directa: es la que usan update y delete, y el mensaje viaja al usuario.
  it("verificarDueno deja pasar al dueño y corta al resto con un mensaje explícito", () => {
    const oc = { id: 55, created_by: 1 } as never
    expect(() => OrdenCompraService.verificarDueno(oc, DUENO)).not.toThrow()
    expect(() => OrdenCompraService.verificarDueno(oc, SUPERVISOR)).not.toThrow()
    expect(() => OrdenCompraService.verificarDueno(oc, OTRO)).toThrowError(
      /Solo quien creó la orden de compra/
    )
  })

  // created_by es nullable en gu_ordenesdecompra (OCs anteriores a la regla). Sin dueño
  // conocido, nadie que no pueda aprobar la toca: falla cerrado.
  it("una OC sin created_by solo la toca quien puede aprobar", () => {
    const sinDueno = { id: 55, created_by: null } as never
    expect(() => OrdenCompraService.verificarDueno(sinDueno, DUENO)).toThrowError(/Solo quien creó/)
    expect(() => OrdenCompraService.verificarDueno(sinDueno, SUPERVISOR)).not.toThrow()
  })
})

describe("OrdenCompraService.getPagina — rollup leído de la vista", () => {
  const PAGINA = { page: 1, limit: 25 }

  it("mergea estado_certificacion y monto_pendiente_certificar por id", async () => {
    repo.findPagina.mockResolvedValue({ data: [{ id: 1 }, { id: 2 }], total: 2 } as never)
    repo.findRollupsByIds.mockResolvedValue([
      { orden_compra_id: 1, estado_certificacion: "parcial", monto_pendiente_certificar: 40 },
    ] as never)

    const { data, total } = await OrdenCompraService.getPagina(PAGINA)

    expect(total).toBe(2)
    // El rollup se consulta solo para los ids de ESTA página, no para toda la tabla.
    expect(repo.findRollupsByIds).toHaveBeenCalledWith([1, 2])
    expect(data[0]).toMatchObject({ id: 1, estado_certificacion: "parcial", monto_pendiente_certificar: 40 })
    // sin fila en la vista (OC sin líneas): 'sin'
    expect(data[1]).toMatchObject({ id: 2, estado_certificacion: "sin", monto_pendiente_certificar: 0 })
  })

  // El total viene del count de la consulta sin paginar: una página vacía (filtro que no
  // matchea, o page más allá del final) no significa que la tabla esté vacía.
  it("una página vacía no consulta la vista pero conserva el total", async () => {
    repo.findPagina.mockResolvedValue({ data: [], total: 34 } as never)

    expect(await OrdenCompraService.getPagina({ page: 99, limit: 25 })).toEqual({ data: [], total: 34 })
    expect(repo.findRollupsByIds).not.toHaveBeenCalled()
  })

  it("pasa los filtros y el orden al repositorio tal como llegan", async () => {
    repo.findPagina.mockResolvedValue({ data: [], total: 0 } as never)
    const opts = { filtros: { estado: "aprobado" }, orden: { columna: "fecha_oc", ascending: true } }

    await OrdenCompraService.getPagina(PAGINA, opts)

    expect(repo.findPagina).toHaveBeenCalledWith(PAGINA, opts)
  })
})
