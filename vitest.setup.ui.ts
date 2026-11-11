import { afterEach } from "vitest"
import { cleanup } from "@testing-library/react"

// El cleanup automático de testing-library se engancha solo si el runner expone afterEach
// como global, y acá los imports son explícitos. Sin esto, cada render se apila en el mismo
// document y las queries empiezan a encontrar nodos de tests anteriores.
afterEach(cleanup)
