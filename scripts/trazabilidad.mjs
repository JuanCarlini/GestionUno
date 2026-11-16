#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

// Verifica que docs/requisitos/ no mienta.
//
// Cada criterio de aceptación cita el test que lo verifica, así:
//
//     1. **El dueño puede editar y borrar su OC.**
//        `src/services/orden-compra.service.test.ts` → _"el dueño puede editar y borrar su OC"_
//
// Una cita es una promesa, y una promesa que nadie chequea se vence sola: alguien renombra el
// test, lo borra o mueve el archivo, y el doc sigue diciendo que la regla está cubierta. Este
// script convierte cada cita en algo que se rompe fuerte.
//
// Falla si:
//   - un criterio cita un archivo que no existe;
//   - un criterio cita un test que ese archivo no tiene;
//   - un criterio no cita ningún test (la regla del propio directorio: sin test, no cerrado).
//
// Lo que NO hace: mirar si el test verifica lo que el criterio dice. Eso no lo puede saber una
// máquina. Lo que sí garantiza es que el nombre citado exista, y los nombres acá son frases
// enteras en castellano: renombrar el test obliga a volver al doc.

const CITA = /`([^`]+\.test\.tsx?)`\s*→\s*_"(.+?)"_/g
const INICIO_CRITERIO = /^(\d+)\.\s+\S/
const TITULO_SECCION = /^#{2,3}\s+(.*)$/
const SECCION_CRITERIOS = /criterios de aceptaci/i

/**
 * Los nombres citables de un archivo de test: los `it(...)` y también los `describe(...)`.
 *
 * Los describe entran porque algunas reglas se verifican con `it.each`, que arma el nombre
 * de cada caso en ejecución (`"%s"` con la lista de archivos escaneados) y por lo tanto no
 * tiene un nombre fijo al que apuntar. Esas reglas se citan por su suite. Es el caso de las
 * dos reglas duras estructurales —toda ruta mutante con gate, toda página con guarda—, que
 * son justo las que más importa tener documentadas.
 */
export function nombresCitables(fuente) {
  // Map y no Set porque la CANTIDAD importa: si un nombre aparece dos veces en el archivo,
  // citarlo no identifica a cuál de los dos se refiere el criterio.
  const nombres = new Map()
  const cadena = `("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|\`[^\`$]*\`)`
  const re = new RegExp(
    `\\b(?:it|describe)(?:\\.only|\\.skip|\\.concurrent|\\.fails|\\.sequential)?\\(\\s*${cadena}`,
    "g"
  )
  for (const m of fuente.matchAll(re)) {
    const nombre = m[1].slice(1, -1).replace(/\\(["'`\\])/g, "$1")
    nombres.set(nombre, (nombres.get(nombre) ?? 0) + 1)
  }
  return nombres
}

/**
 * Parte el markdown en criterios, solo dentro de las secciones de criterios de aceptación.
 * Un criterio arranca en "N. " y sigue hasta el próximo criterio o el próximo título.
 */
export function criteriosDe(markdown) {
  const lineas = markdown.split(/\r?\n/)
  const criterios = []
  let dentro = false
  let enBloqueDeCodigo = false
  let actual = null

  const cerrar = () => {
    if (actual) criterios.push(actual)
    actual = null
  }

  lineas.forEach((linea, i) => {
    // Los bloques ``` se saltean enteros. Si no, un ejemplo del formato dentro de un doc se
    // parsearía como si fuera un criterio de verdad —y al revés, un "###" de ejemplo cortaría
    // la sección y dejaría los criterios que siguen sin revisar, en silencio.
    if (/^\s*```/.test(linea)) {
      enBloqueDeCodigo = !enBloqueDeCodigo
      return
    }
    if (enBloqueDeCodigo) return

    const titulo = linea.match(TITULO_SECCION)
    if (titulo) {
      cerrar()
      dentro = SECCION_CRITERIOS.test(titulo[1])
      return
    }
    if (!dentro) return

    const inicio = linea.match(INICIO_CRITERIO)
    if (inicio) {
      cerrar()
      actual = { numero: Number(inicio[1]), linea: i + 1, texto: linea }
      return
    }
    if (actual) actual.texto += "\n" + linea
  })
  cerrar()

  return criterios
}

/** Las citas de un bloque de texto. */
export function citasDe(texto) {
  return [...texto.matchAll(CITA)].map((m) => ({ archivo: m[1], nombre: m[2] }))
}

/**
 * Revisa un directorio de requisitos contra el repositorio.
 * Devuelve { problemas, revisados, citas } — `problemas` vacío es el caso bueno.
 */
export function verificar({ dirDocs, raiz, leer = (p) => fs.readFileSync(p, "utf8"), existe = fs.existsSync }) {
  const problemas = []
  let citasTotales = 0

  const docs = fs
    .readdirSync(dirDocs)
    .filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md")
    .sort()

  // Los archivos de test se leen una vez cada uno, aunque los cite medio directorio.
  const cacheNombres = new Map()
  const nombresDe = (archivo) => {
    if (!cacheNombres.has(archivo)) {
      const abs = path.join(raiz, archivo)
      cacheNombres.set(archivo, existe(abs) ? nombresCitables(leer(abs)) : null)
    }
    return cacheNombres.get(archivo)
  }

  for (const doc of docs) {
    const markdown = leer(path.join(dirDocs, doc))
    const criterios = criteriosDe(markdown)

    if (criterios.length === 0) {
      problemas.push({ doc, tipo: "sin-criterios", detalle: "no tiene criterios de aceptación numerados" })
      continue
    }

    for (const criterio of criterios) {
      const citas = citasDe(criterio.texto)

      if (citas.length === 0) {
        problemas.push({
          doc,
          linea: criterio.linea,
          tipo: "sin-test",
          detalle: `el criterio ${criterio.numero} no cita ningún test`,
        })
        continue
      }

      for (const cita of citas) {
        citasTotales++
        const nombres = nombresDe(cita.archivo)

        if (nombres === null) {
          problemas.push({
            doc,
            linea: criterio.linea,
            tipo: "archivo-inexistente",
            detalle: `el criterio ${criterio.numero} cita ${cita.archivo}, que no existe`,
          })
          continue
        }

        if (!nombres.has(cita.nombre)) {
          problemas.push({
            doc,
            linea: criterio.linea,
            tipo: "test-inexistente",
            detalle: `el criterio ${criterio.numero} cita el test "${cita.nombre}", que ${cita.archivo} no tiene`,
            // Sin esto hay que abrir el archivo y comparar a ojo cuál era el nombre parecido.
            sugerencia: masParecido(cita.nombre, nombres),
          })
          continue
        }

        // Un nombre repetido dentro del archivo hace que la cita no identifique nada: quien
        // la sigue encuentra dos tests y no sabe cuál verifica el criterio. Se arregla
        // renombrando uno de los dos, que además es lo que conviene para leer la salida
        // de vitest.
        if (nombres.get(cita.nombre) > 1) {
          problemas.push({
            doc,
            linea: criterio.linea,
            tipo: "cita-ambigua",
            detalle: `el criterio ${criterio.numero} cita "${cita.nombre}", que aparece ${nombres.get(cita.nombre)} veces en ${cita.archivo}`,
          })
        }
      }
    }
  }

  return { problemas, revisados: docs, citas: citasTotales }
}

/**
 * El nombre existente que más se parece, para cuando alguien renombró un test.
 * `nombres` es el Map de nombresCitables; se recorren sus claves.
 */
export function masParecido(buscado, nombres) {
  const palabras = (s) => new Set(s.toLowerCase().split(/\W+/).filter((w) => w.length > 3))
  const objetivo = palabras(buscado)
  if (objetivo.size === 0) return null

  let mejor = null
  let mejorPuntaje = 0
  for (const nombre of nombres.keys()) {
    const otras = palabras(nombre)
    const comunes = [...objetivo].filter((w) => otras.has(w)).length
    const puntaje = comunes / Math.max(objetivo.size, otras.size || 1)
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje
      mejor = nombre
    }
  }
  // Por debajo de la mitad de las palabras, sugerir confunde más de lo que ayuda.
  return mejorPuntaje >= 0.5 ? mejor : null
}

// ------------------------------------------------------------------ CLI

function principal() {
  const raiz = process.cwd()
  const dirDocs = path.join(raiz, "docs", "requisitos")

  if (!fs.existsSync(dirDocs)) {
    console.error(`No encontré ${dirDocs}`)
    process.exit(1)
  }

  const { problemas, revisados, citas } = verificar({ dirDocs, raiz })

  if (problemas.length === 0) {
    console.log(`Trazabilidad OK — ${revisados.length} documento(s), ${citas} cita(s) verificada(s).`)
    return
  }

  console.error(`Trazabilidad ROTA — ${problemas.length} problema(s):\n`)
  for (const p of problemas) {
    console.error(`  docs/requisitos/${p.doc}${p.linea ? `:${p.linea}` : ""}`)
    console.error(`    ${p.detalle}`)
    if (p.sugerencia) console.error(`    ¿quisiste decir "${p.sugerencia}"?`)
    console.error("")
  }
  process.exit(1)
}

// Solo corre si se invoca directo, para poder importar las funciones desde el test.
// Se compara con pathToFileURL y no con paths a mano: en Windows import.meta.url trae
// /C:/... y cualquier normalización artesanal termina fallando en una de las dos puntas.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}
