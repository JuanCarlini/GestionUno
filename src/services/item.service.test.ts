import { describe, it, expect, vi, beforeEach } from "vitest"
import { ItemRepository } from "@/repositories/item.repository"
import { ItemService } from "./item.service"

vi.mock("@/repositories/item.repository", () => ({
  ItemRepository: {
    insert: vi.fn(),
    search: vi.fn(),
    findCategoriaValues: vi.fn(),
    setActive: vi.fn(),
    existsInLineasOC: vi.fn(),
  },
}))

const repo = vi.mocked(ItemRepository)

beforeEach(() => {
  vi.clearAllMocks()
  repo.insert.mockResolvedValue({ id: 1 } as never)
  repo.search.mockResolvedValue([])
})

describe("ItemService.create", () => {
  it("fuerza is_active y toma created_by del server, no del cliente (S2)", async () => {
    await ItemService.create({ codigo: "COD-0009", nombre: "Cal" } as never, 7)
    expect(repo.insert).toHaveBeenCalledWith({
      codigo: "COD-0009",
      nombre: "Cal",
      is_active: true,
      created_by: 7,
    })
  })

})

// ItemRepository.search arma un filtro `.or(nombre.ilike.%q%,codigo.ilike.%q%,...)`.
// En PostgREST la coma TERMINA el valor: una coma en `q` inyecta una condición OR extra.
// Los paréntesis cierran el grupo. Los comodines de LIKE (% _) no son un vector: solo
// ensanchan el match, así que se dejan pasar.
describe("ItemService.search — saneado del filtro PostgREST", () => {
  it("pasa una búsqueda normal tal cual", async () => {
    await ItemService.search("cemento")
    expect(repo.search).toHaveBeenCalledWith("cemento")
  })

  it("neutraliza la coma, que inyectaría una condición OR extra", async () => {
    await ItemService.search("x,is_active.eq.false")
    expect(repo.search).toHaveBeenCalledWith("x is_active.eq.false")
  })

  it("neutraliza paréntesis, comillas y backslash", async () => {
    await ItemService.search('a(b)"c\\d')
    expect(repo.search).toHaveBeenCalledWith("a b c d")
  })

  it("deja pasar los comodines de LIKE (no son un vector de inyección)", async () => {
    await ItemService.search("cem%")
    expect(repo.search).toHaveBeenCalledWith("cem%")
  })

  it("query vacío tras sanear devuelve [] sin pegarle al repo", async () => {
    const res = await ItemService.search(",,,")
    expect(res).toEqual([])
    expect(repo.search).not.toHaveBeenCalled()
  })
})

describe("ItemService.getCategorias", () => {
  it("deduplica, saca vacíos y ordena", async () => {
    repo.findCategoriaValues.mockResolvedValue(["Servicios", null, "Materiales", "Servicios", ""])
    expect(await ItemService.getCategorias()).toEqual(["Materiales", "Servicios"])
  })
})

// Un solo método para los dos sentidos, que consumen PATCH /items/[id]/estado y el DELETE del
// recurso. La regla de "en uso" está acá a propósito: en la ruta, cada camino tenía que
// acordarse de chequearla (y el DELETE era el único que lo hacía).
describe("ItemService.setActivo", () => {
  it("desactiva un item que no está en uso", async () => {
    repo.existsInLineasOC.mockResolvedValue(false)
    repo.setActive.mockResolvedValue({ id: 5, is_active: false } as never)

    expect(await ItemService.setActivo(5, false)).toMatchObject({ is_active: false })
    expect(repo.setActive).toHaveBeenCalledWith(5, false)
  })

  it("409 si el item está usado en alguna línea de OC, y no lo toca", async () => {
    repo.existsInLineasOC.mockResolvedValue(true)

    await expect(ItemService.setActivo(5, false)).rejects.toMatchObject({ status: 409 })
    expect(repo.setActive).not.toHaveBeenCalled()
  })

  // Reactivar nunca se bloquea: el chequeo es solo para el sentido que saca el item del
  // catálogo. Un item en uso que está inactivo tiene que poder volver.
  it("activar no consulta el uso y siempre pasa", async () => {
    repo.setActive.mockResolvedValue({ id: 5, is_active: true } as never)

    expect(await ItemService.setActivo(5, true)).toMatchObject({ is_active: true })
    expect(repo.existsInLineasOC).not.toHaveBeenCalled()
  })

  it("null si el id no existe", async () => {
    repo.existsInLineasOC.mockResolvedValue(false)
    repo.setActive.mockResolvedValue(null)
    expect(await ItemService.setActivo(999, false)).toBeNull()
  })
})
