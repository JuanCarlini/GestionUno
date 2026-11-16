import { describe, it, expect, beforeEach, afterEach } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { nombresCitables, criteriosDe, citasDe, verificar, masParecido } from "./trazabilidad.mjs"

// El verificador es el que sostiene la promesa de docs/requisitos: si él se equivoca, los
// docs pueden mentir sin que nadie se entere. Por eso va sobre archivos de verdad en un
// directorio temporal y no sobre strings: la mitad de los errores posibles son de fs.

describe("nombresCitables", () => {
  it("encuentra los it con comillas dobles, simples y backticks", () => {
    const nombres = nombresCitables(`
      it("con dobles", () => {})
      it('con simples', () => {})
      it(\`con backticks\`, () => {})
    `)
    expect([...nombres].sort()).toEqual(["con backticks", "con dobles", "con simples"])
  })

  it("encuentra los it.only, it.skip y it.concurrent", () => {
    const nombres = nombresCitables(`
      it.only("enfocado", () => {})
      it.skip("salteado", () => {})
      it.concurrent("en paralelo", () => {})
    `)
    expect(nombres.size).toBe(3)
    expect(nombres.has("salteado")).toBe(true)
  })

  it("desescapa las comillas de adentro del nombre", () => {
    const nombres = nombresCitables(`it("devuelve \\"null\\" si no existe", () => {})`)
    expect(nombres.has('devuelve "null" si no existe')).toBe(true)
  })

  it("toma también el nombre del describe, para poder citar una suite entera", () => {
    const nombres = nombresCitables(`
      describe("un grupo", () => {
        it("un test", () => {})
      })
    `)
    expect([...nombres].sort()).toEqual(["un grupo", "un test"])
  })

  it("el template de un it.each no es citable, pero su describe sí", () => {
    // El "%s" se expande en ejecución con cada caso: no hay un nombre fijo al que apuntar.
    // Por eso las reglas verificadas con it.each se citan por la suite que las contiene.
    const nombres = nombresCitables(`
      describe("toda ruta mutante tiene gate", () => {
        it.each(ARCHIVOS)("%s", () => {})
      })
    `)
    expect([...nombres]).toEqual(["toda ruta mutante tiene gate"])
  })
})

describe("criteriosDe", () => {
  const doc = `# Requisitos — Algo

## X-01 — Una regla

1. Esto de acá arriba NO es un criterio: está fuera de la sección.

### Criterios de aceptación

1. **Primero.**
   \`a.test.ts\` → _"uno"\_

2. **Segundo**, que sigue
   en otra línea.
   \`a.test.ts\` → _"dos"\_

### Fuera de alcance

1. Esto tampoco es un criterio.
`

  it("solo toma los de la sección de criterios de aceptación", () => {
    const criterios = criteriosDe(doc)
    expect(criterios.map((c) => c.numero)).toEqual([1, 2])
  })

  it("un criterio se lleva sus líneas de continuación", () => {
    const [, segundo] = criteriosDe(doc)
    expect(segundo.texto).toContain("en otra línea")
    expect(segundo.texto).toContain("dos")
  })

  it("marca la línea donde arranca, para poder ir directo", () => {
    const [primero] = criteriosDe(doc)
    expect(doc.split("\n")[primero.linea - 1]).toContain("Primero")
  })
})

describe("citasDe", () => {
  it("saca archivo y nombre", () => {
    const citas = citasDe('   `src/a/b.test.ts` → _"el dueño puede editar"_')
    expect(citas).toEqual([{ archivo: "src/a/b.test.ts", nombre: "el dueño puede editar" }])
  })

  it("acepta .tsx y varias citas en el mismo criterio", () => {
    const citas = citasDe('`a.test.ts` → _"uno"_ y también `b.test.tsx` → _"dos"_')
    expect(citas.map((c) => c.archivo)).toEqual(["a.test.ts", "b.test.tsx"])
  })

  it("no confunde un backtick suelto con una cita", () => {
    expect(citasDe("usa `formatCurrency` para el importe")).toEqual([])
  })
})

describe("masParecido", () => {
  it("sugiere el nombre que comparte casi todas las palabras", () => {
    const nombres = new Set(["el dueño puede editar y borrar su orden", "cualquier otra cosa"])
    expect(masParecido("el dueño puede editar y borrar su OC", nombres)).toBe(
      "el dueño puede editar y borrar su orden"
    )
  })

  it("no sugiere nada si no se parece a ninguno", () => {
    expect(masParecido("algo completamente distinto", new Set(["el dueño puede editar"]))).toBeNull()
  })
})

describe("verificar — sobre archivos de verdad", () => {
  let raiz
  let dirDocs

  const escribir = (rel, contenido) => {
    const abs = path.join(raiz, rel)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, contenido)
  }

  const docCon = (criterios) => `## X-01 — Regla\n\n### Criterios de aceptación\n\n${criterios}\n`

  beforeEach(() => {
    raiz = fs.mkdtempSync(path.join(os.tmpdir(), "traza-"))
    dirDocs = path.join(raiz, "docs", "requisitos")
    fs.mkdirSync(dirDocs, { recursive: true })
    escribir("src/cosa.test.ts", `it("el test que existe", () => {})`)
  })

  afterEach(() => {
    fs.rmSync(raiz, { recursive: true, force: true })
  })

  it("no se queja cuando todas las citas apuntan a tests que existen", () => {
    escribir(
      "docs/requisitos/x.md",
      docCon('1. **Algo.**\n   `src/cosa.test.ts` → _"el test que existe"_')
    )

    const { problemas, citas } = verificar({ dirDocs, raiz })
    expect(problemas).toEqual([])
    expect(citas).toBe(1)
  })

  it("agarra un archivo de test que no existe", () => {
    escribir(
      "docs/requisitos/x.md",
      docCon('1. **Algo.**\n   `src/fantasma.test.ts` → _"lo que sea"_')
    )

    const { problemas } = verificar({ dirDocs, raiz })
    expect(problemas).toHaveLength(1)
    expect(problemas[0].tipo).toBe("archivo-inexistente")
  })

  it("agarra un test renombrado, y dice cuál es el parecido", () => {
    // El caso real: alguien mejora el nombre del test y el doc queda apuntando al viejo.
    escribir(
      "docs/requisitos/x.md",
      docCon('1. **Algo.**\n   `src/cosa.test.ts` → _"el test que ya no existe"_')
    )

    const { problemas } = verificar({ dirDocs, raiz })
    expect(problemas).toHaveLength(1)
    expect(problemas[0].tipo).toBe("test-inexistente")
    expect(problemas[0].sugerencia).toBe("el test que existe")
  })

  it("agarra un criterio sin ningún test citado", () => {
    escribir("docs/requisitos/x.md", docCon("1. **Algo que nadie verifica.**"))

    const { problemas } = verificar({ dirDocs, raiz })
    expect(problemas).toHaveLength(1)
    expect(problemas[0].tipo).toBe("sin-test")
  })

  it("agarra un documento sin criterios numerados", () => {
    escribir("docs/requisitos/x.md", "## X-01 — Regla\n\nProsa y nada más.\n")

    const { problemas } = verificar({ dirDocs, raiz })
    expect(problemas).toHaveLength(1)
    expect(problemas[0].tipo).toBe("sin-criterios")
  })

  it("saltea el README, que explica el formato y no tiene criterios", () => {
    escribir("docs/requisitos/README.md", "# Cómo se escribe esto\n\n1. Primero esto.\n")
    escribir(
      "docs/requisitos/x.md",
      docCon('1. **Algo.**\n   `src/cosa.test.ts` → _"el test que existe"_')
    )

    expect(verificar({ dirDocs, raiz }).problemas).toEqual([])
  })

  it("revisa todos los documentos, no solo el primero", () => {
    escribir("docs/requisitos/a.md", docCon('1. **A.**\n   `src/fantasma.test.ts` → _"x"_'))
    escribir("docs/requisitos/b.md", docCon('1. **B.**\n   `src/fantasma.test.ts` → _"y"_'))

    const { problemas, revisados } = verificar({ dirDocs, raiz })
    expect(revisados).toEqual(["a.md", "b.md"])
    expect(problemas).toHaveLength(2)
  })

  it("lee cada archivo de test una sola vez aunque lo cite medio directorio", () => {
    let lecturasDeTest = 0
    const leer = (p) => {
      if (p.endsWith(".test.ts")) lecturasDeTest++
      return fs.readFileSync(p, "utf8")
    }
    escribir("docs/requisitos/a.md", docCon('1. **A.**\n   `src/cosa.test.ts` → _"el test que existe"_'))
    escribir("docs/requisitos/b.md", docCon('1. **B.**\n   `src/cosa.test.ts` → _"el test que existe"_'))

    verificar({ dirDocs, raiz, leer })
    expect(lecturasDeTest).toBe(1)
  })
})
