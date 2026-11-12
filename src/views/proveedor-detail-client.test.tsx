import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"

// La regla que fija este test: un 404 de la API es "el documento no existe" y va a la pantalla
// de not-found; cualquier otro error es "no se pudo cargar" y se queda en la tarjeta de error.
// Antes los dos terminaban en el mismo cartel, que mentía sobre un 500.
//
// Y la trampa que cubre: notFound() tiene que llamarse durante el render. Si alguien lo mueve
// adentro del efecto, el throw cae fuera de React, no lo agarra el límite de not-found y la
// pantalla queda colgada. Acá eso se ve como "notFound no fue llamado".
const notFound = vi.fn()
vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
  useParams: () => ({ id: "prov-1" }),
}))

vi.mock("@/views/proveedor-details", () => ({
  ProveedorDetails: ({ proveedor }: { proveedor: { nombre: string } }) => (
    <div>{proveedor.nombre}</div>
  ),
}))

import { ProveedorDetailClient } from "./proveedor-detail-client"

function respuesta(status: number, body: unknown = {}) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
}

describe("ProveedorDetailClient — qué pantalla corresponde a cada respuesta", () => {
  beforeEach(() => {
    notFound.mockClear()
  })

  it("un 404 manda a la pantalla de not-found", async () => {
    vi.stubGlobal("fetch", respuesta(404))

    render(<ProveedorDetailClient />)

    await waitFor(() => expect(notFound).toHaveBeenCalled())
  })

  it("un 500 no es un 404: se queda en la tarjeta de error", async () => {
    vi.stubGlobal("fetch", respuesta(500))

    render(<ProveedorDetailClient />)

    await waitFor(() => expect(screen.getByText(/Error:/)).toBeTruthy())
    expect(notFound).not.toHaveBeenCalled()
  })

  it("un 200 muestra el proveedor y no toca not-found", async () => {
    vi.stubGlobal("fetch", respuesta(200, { id: "prov-1", nombre: "Hormigonera del Sur" }))

    render(<ProveedorDetailClient />)

    await waitFor(() => expect(screen.getByText("Hormigonera del Sur")).toBeTruthy())
    expect(notFound).not.toHaveBeenCalled()
  })

  it("mientras carga muestra el skeleton del documento, no un spinner suelto", () => {
    // Una promesa que no resuelve: el componente se queda en el estado de carga.
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})))

    render(<ProveedorDetailClient />)

    expect(screen.getByRole("status").getAttribute("aria-label")).toBe("Cargando el documento")
  })
})
