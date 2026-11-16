import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import Error from "./error"

// Esta pantalla es la que se muestra cuando algo ya falló, y no hay global-error.tsx atrás.
// Si ella misma tira, el usuario no ve nada. Por eso los tests la renderizan SIN provider de
// sesión: es el escenario que la rompería y el que nadie probaría a mano.

const errorDePrueba = Object.assign(new globalThis.Error("se rompió la consulta"), {
  digest: "abc123",
})

describe("pantalla de error del dashboard", () => {
  it("renderiza aunque no haya provider de sesión alrededor", () => {
    // useAuth tira fuera del AuthProvider; useAuthOpcional no. Si alguien vuelve a useAuth,
    // este test falla con el throw del provider.
    expect(() => render(<Error error={errorDePrueba} reset={() => {}} />)).not.toThrow()

    expect(screen.getByText("Algo salió mal")).toBeTruthy()
  })

  it("ofrece reintentar, y el botón llama a reset", () => {
    const reset = vi.fn()
    render(<Error error={errorDePrueba} reset={reset} />)

    const boton = screen.getByRole("button", { name: /reintentar/i })
    boton.click()

    expect(reset).toHaveBeenCalledOnce()
  })

  it("sin sesión no muestra el detalle técnico", () => {
    // El mensaje de una excepción puede traer nombres de tablas o de constraints. Sin saber
    // quién está mirando, no se muestra.
    render(<Error error={errorDePrueba} reset={() => {}} />)

    expect(screen.queryByText(/detalle técnico/i)).toBeNull()
    expect(screen.queryByText(/se rompió la consulta/)).toBeNull()
  })
})
