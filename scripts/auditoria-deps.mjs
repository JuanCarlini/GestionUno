#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { pathToFileURL } from "node:url"

// `npm audit` con la vara en high, pero con una lista de excepciones que hay que justificar.
//
// Por qué no alcanza con `npm audit --audit-level=high` pelado: a veces sale un advisory que
// no tiene a dónde subir —la versión parcheada no existe todavía— y entonces el CI queda rojo
// para siempre. Las dos salidas obvias son malas: bajar la vara a critical tapa TODOS los
// high futuros, incluidos los que sí llegan al runtime, y el ci.yml de este repo ya dice por
// qué eso no se hace; y poner `|| true` convierte el step en decoración.
//
// Entonces: la vara se queda en high y lo que se permite se nombra de a uno, con el motivo
// escrito y una fecha de revisión. Un advisory permitido no desaparece, queda a la vista en
// cada corrida.
//
// Falla si:
//   - aparece un advisory high o critical que no está en PERMITIDOS;
//   - un permitido pasó su fecha de revisión (una excepción sin vencimiento es un `|| true`
//     escrito más largo);
//   - un permitido ya no corresponde a ningún advisory: se arregló solo y hay que sacarlo de
//     la lista, porque una excepción que no excluye nada es ruido que después nadie revisa.
//
// Los advisories en cascada no se listan. Cuando `picomatch` es vulnerable, npm marca también
// a `fdir`, `micromatch`, `chokidar` y todo lo que cuelgue, pero esos entran con un `via` que
// es el NOMBRE del paquete de abajo, no un advisory propio. Acá se miran solo los advisories
// raíz —los que traen su GHSA—, así que permitir el advisory de abajo cubre su cascada sola.

const VARA = new Set(["high", "critical"])

// Vacía a propósito: hoy no hay ningún high ni critical que permitir. Estaba el ReDoS de
// picomatch (GHSA-fc5q-39xc-vjpf), que ya no sale en el audit; el propio script avisa cuando
// un permiso dejó de corresponder a un advisory, y así fue como se sacó.
const PERMITIDOS = []

/** Corre npm audit y devuelve el JSON. El exit code no sirve: da != 0 si hay vulnerabilidades. */
function auditar() {
  // El comando entero como un string y no como ["npm", [args]]: en Windows npm es un .cmd y
  // un .cmd no se puede ejecutar sin shell, y con shell + array de argumentos node avisa que
  // los concatena sin escapar. Acá no hay nada que escapar —el comando es una constante—,
  // así que va de una pieza.
  const r = spawnSync("npm audit --json", {
    encoding: "utf8",
    shell: true,
    maxBuffer: 1 << 26,
  })
  if (!r.stdout) {
    console.error("No se pudo correr npm audit.")
    if (r.stderr) console.error(r.stderr.trim())
    process.exit(1)
  }
  try {
    return JSON.parse(r.stdout)
  } catch {
    console.error("npm audit no devolvió JSON:")
    console.error(r.stdout.slice(0, 500))
    process.exit(1)
  }
}

const GHSA = /(GHSA-[\w-]+)/

/**
 * Los advisories raíz por encima de la vara, uno por GHSA. Un paquete puede aparecer en el
 * `via` de varios otros; interesa el advisory, no cuántas veces se lo nombra.
 */
function advisoriesRaiz(audit) {
  const porGhsa = new Map()
  for (const vuln of Object.values(audit.vulnerabilities ?? {})) {
    for (const via of vuln.via ?? []) {
      // Un `via` string es una cascada: "soy vulnerable porque lo es este otro".
      if (typeof via !== "object" || !VARA.has(via.severity)) continue
      const id = GHSA.exec(via.url ?? "")?.[1] ?? via.url ?? String(via.source)
      if (!porGhsa.has(id)) {
        porGhsa.set(id, { id, paquete: via.name, titulo: via.title, severidad: via.severity })
      }
    }
  }
  return [...porGhsa.values()]
}

function principal() {
  const hoy = new Date().toISOString().slice(0, 10)
  const raiz = advisoriesRaiz(auditar())
  const permitidos = new Map(PERMITIDOS.map((p) => [p.ghsa, p]))
  const problemas = []

  for (const a of raiz) {
    if (permitidos.has(a.id)) continue
    problemas.push(
      `${a.severidad.toUpperCase()} sin permiso: ${a.paquete} — ${a.titulo}\n` +
        `      ${a.id}\n` +
        `      Si no hay versión a la que subir, agregalo a PERMITIDOS en este archivo con el\n` +
        `      motivo y una fecha de revisión. Si la hay, subí la dependencia.`
    )
  }

  const vistos = new Set(raiz.map((a) => a.id))
  for (const p of PERMITIDOS) {
    if (!vistos.has(p.ghsa)) {
      problemas.push(
        `Permiso que ya no hace falta: ${p.ghsa} (${p.paquete}) no aparece en el audit.\n` +
          `      Sacalo de PERMITIDOS: una excepción que no excluye nada es ruido.`
      )
    } else if (p.revisar < hoy) {
      problemas.push(
        `Permiso vencido: ${p.ghsa} (${p.paquete}) había que revisarlo el ${p.revisar}.\n` +
          `      Fijate si ya hay versión parcheada; si sigue sin haberla, corré la fecha a mano\n` +
          `      dejando dicho qué se miró.`
      )
    }
  }

  if (problemas.length === 0) {
    const detalle = PERMITIDOS.map((p) => `${p.ghsa} (${p.paquete}, hasta ${p.revisar})`)
    console.log(
      `Audit OK — sin advisories high ni critical fuera de la lista.` +
        (detalle.length ? `\nPermitidos: ${detalle.join(", ")}` : "")
    )
    return
  }

  console.error(`Audit de dependencias ROTO — ${problemas.length} problema(s):\n`)
  for (const p of problemas) console.error(`  ${p}\n`)
  process.exit(1)
}

// Igual que trazabilidad.mjs: solo corre si se invoca directo, para poder importar las
// funciones desde un test. pathToFileURL y no paths a mano, por el /C:/ de Windows.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal()
}

export { advisoriesRaiz, PERMITIDOS, VARA }
