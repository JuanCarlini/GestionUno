import { describe, it, expect, vi, beforeEach } from "vitest"
import { getCurrentUser } from "@/lib/auth/auth.cookies"
import { RolRepository } from "@/repositories/rol.repository"
import { requireAuth, requireAdmin, requirePermission, requirePagePermission, requirePageAdmin } from "./permissions-server"
import { redirect } from "next/navigation"

// Enforcement RBAC (S1): la barrera de autorización de toda ruta mutante. Antes sin un
// solo test. Se mockea la frontera (cookie + repo de permisos) y se ejerce la decisión real.
vi.mock("@/lib/auth/auth.cookies", () => ({ getCurrentUser: vi.fn() }))
vi.mock("@/repositories/rol.repository", () => ({
  RolRepository: { findPermisosByNombre: vi.fn() },
}))
// redirect() corta el flujo (como en runtime, donde tira NEXT_REDIRECT).
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("REDIRECT") }) }))

const getUser = vi.mocked(getCurrentUser)
const rolRepo = vi.mocked(RolRepository)
const redirectMock = vi.mocked(redirect)

// getCurrentUser devuelve el usuario "crudo"; getAuthenticatedUser lee rol_nombre.
const comoRol = (rol_nombre: string, id = 1) =>
  getUser.mockResolvedValue({ id, email: "a@b.com", nombre: "A", rol_nombre } as any)

beforeEach(() => vi.clearAllMocks())

describe("requireAuth", () => {
  it("401 sin usuario", async () => {
    getUser.mockResolvedValue(null as any)
    const { error, user } = await requireAuth()
    expect(user).toBeNull()
    expect(error?.status).toBe(401)
  })

  it("pasa con usuario autenticado", async () => {
    comoRol("usuario")
    const { error, user } = await requireAuth()
    expect(error).toBeNull()
    expect(user?.rol).toBe("usuario")
  })
})

describe("requireAdmin", () => {
  it("401 sin usuario", async () => {
    getUser.mockResolvedValue(null as any)
    expect((await requireAdmin()).error?.status).toBe(401)
  })

  it("403 si el rol no es admin", async () => {
    comoRol("supervisor")
    const { error, user } = await requireAdmin()
    expect(user).toBeNull()
    expect(error?.status).toBe(403)
  })

  it("pasa si es admin", async () => {
    comoRol("admin")
    expect((await requireAdmin()).error).toBeNull()
  })
})

describe("requirePermission", () => {
  it("401 sin usuario (ni consulta permisos)", async () => {
    getUser.mockResolvedValue(null as any)
    expect((await requirePermission("ordenes_compra", "crear")).error?.status).toBe(401)
    expect(rolRepo.findPermisosByNombre).not.toHaveBeenCalled()
  })

  it("admin pasa aunque no tenga permisos explícitos (short-circuit)", async () => {
    comoRol("admin")
    rolRepo.findPermisosByNombre.mockResolvedValue([])
    expect((await requirePermission("ordenes_compra", "crear")).error).toBeNull()
  })

  it("403 si el rol no tiene el permiso modulo:accion", async () => {
    comoRol("usuario")
    rolRepo.findPermisosByNombre.mockResolvedValue([])
    expect((await requirePermission("ordenes_compra", "crear")).error?.status).toBe(403)
  })

  it("pasa si el rol tiene el permiso modulo:accion", async () => {
    comoRol("usuario")
    rolRepo.findPermisosByNombre.mockResolvedValue(["ordenes_compra:crear"])
    expect((await requirePermission("ordenes_compra", "crear")).error).toBeNull()
  })
})

describe("requirePagePermission (guarda de página)", () => {
  it("redirige a /login sin usuario", async () => {
    getUser.mockResolvedValue(null as any)
    await expect(requirePagePermission("certificaciones", "ver")).rejects.toThrow()
    expect(redirectMock).toHaveBeenCalledWith("/login")
  })

  it("redirige al fallback si el rol no tiene el permiso", async () => {
    comoRol("usuario")
    rolRepo.findPermisosByNombre.mockResolvedValue([])
    await expect(
      requirePagePermission("certificaciones", "crear", "/certificaciones")
    ).rejects.toThrow()
    expect(redirectMock).toHaveBeenCalledWith("/certificaciones")
  })

  it("redirige al default /dashboard si no se pasa fallback", async () => {
    comoRol("readonly")
    rolRepo.findPermisosByNombre.mockResolvedValue([])
    await expect(requirePagePermission("facturas", "crear")).rejects.toThrow()
    expect(redirectMock).toHaveBeenCalledWith("/dashboard")
  })

  it("devuelve el usuario si tiene el permiso (y NO redirige)", async () => {
    comoRol("usuario")
    rolRepo.findPermisosByNombre.mockResolvedValue(["certificaciones:crear"])
    const { user } = await requirePagePermission("certificaciones", "crear")
    expect(user.rol).toBe("usuario")
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it("admin pasa siempre (short-circuit), sin importar la matriz", async () => {
    comoRol("admin")
    rolRepo.findPermisosByNombre.mockResolvedValue([])
    const { user } = await requirePagePermission("facturas", "aprobar")
    expect(user.rol).toBe("admin")
    expect(redirectMock).not.toHaveBeenCalled()
  })
})

// Guarda de PÁGINA por rol admin: el equivalente de requireAdmin (API) para Server
// Components. Antes /admin/* solo tenía un guard en useEffect (client), que esconde la UI
// después de hidratar pero no bloquea el acceso por URL directa.
describe("requirePageAdmin", () => {
  it("redirige a /login si no hay usuario", async () => {
    getUser.mockResolvedValue(null as any)
    await expect(requirePageAdmin()).rejects.toThrow()
    expect(redirectMock).toHaveBeenCalledWith("/login")
  })

  it("redirige al fallback si el rol no es admin", async () => {
    comoRol("supervisor")
    await expect(requirePageAdmin("/dashboard")).rejects.toThrow()
    expect(redirectMock).toHaveBeenCalledWith("/dashboard")
  })

  it("readonly tampoco entra", async () => {
    comoRol("readonly")
    await expect(requirePageAdmin()).rejects.toThrow()
    expect(redirectMock).toHaveBeenCalledWith("/dashboard")
  })

  it("devuelve el usuario si es admin (y NO redirige)", async () => {
    comoRol("admin")
    const { user } = await requirePageAdmin()
    expect(user.rol).toBe("admin")
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it("no consulta la matriz de permisos: la decisión es por rol", async () => {
    comoRol("admin")
    await requirePageAdmin()
    expect(rolRepo.findPermisosByNombre).not.toHaveBeenCalled()
  })
})
