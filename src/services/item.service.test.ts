import { describe, it, expect, vi, beforeEach } from "vitest"
import { ItemRepository } from "@/repositories/item.repository"
import { ItemService } from "./item.service"

vi.mock("@/repositories/item.repository", () => ({
  ItemRepository: {
    insert: vi.fn(),
    search: vi.fn(),
    findCategoriaValues: vi.fn(),
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
