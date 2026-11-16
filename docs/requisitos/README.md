# Requisitos

Qué tiene que hacer el sistema, escrito de forma que no pueda quedar desactualizado en
silencio.

## El formato

Una historia de usuario por regla, con criterios de aceptación numerados y, para cada
criterio, **el test que lo verifica**. Si un criterio no tiene test, no está cerrado.

```markdown
## OC-01 — Solo el creador edita o borra su orden de compra

> Como **usuario de compras**, quiero que **...**, para que **...**.

Contexto: de dónde sale la regla, qué decisión se tomó y por qué.

### Criterios de aceptación

1. **El dueño puede editar y borrar su OC.**
   `src/services/orden-compra.service.test.ts` → _"el dueño puede editar y borrar su OC"_

### Fuera de alcance

- Lo que esta regla explícitamente NO cubre.
```

La cita va con el path del archivo entre backticks, una flecha `→` y el nombre exacto del
test entre comillas, en cursiva.

**Suites parametrizadas.** Algunas reglas se verifican con `it.each`, que arma el nombre de
cada caso en ejecución (`"%s"` con la lista de archivos escaneados) y por lo tanto no tiene
un nombre fijo al que apuntar. Esas se citan por el nombre de su `describe`, que el
verificador también acepta. Es el caso de las dos reglas duras estructurales de
[permisos.md](permisos.md).

## `npm run trazabilidad`

Las citas no son decorativas: `scripts/trazabilidad.mjs` las verifica y **falla** si

- un criterio cita un archivo de test que no existe,
- un criterio cita un test que ese archivo no tiene,
- un criterio no cita ningún test.

Corre en el CI después de los tests. Si alguien renombra un test, el doc deja de compilar
y hay que volver acá a arreglarlo — que es justo el punto. Los nombres de test del proyecto
son frases enteras en castellano, así que renombrar uno es casi siempre señal de que la
regla cambió.

Lo que el script **no** puede hacer es decidir si el test verifica lo que el criterio dice.
Eso lo sostiene quien escribe el doc.

## Los documentos

| Documento | Qué cubre |
|---|---|
| [ordenes-compra.md](ordenes-compra.md) | Propiedad de la OC: quién puede editarla y borrarla |
| [certificaciones.md](certificaciones.md) | La regla del 100% sobre la línea de OC y el grafo de estados |
| [facturas.md](facturas.md) | Imputación a certificaciones y sus dos topes |
| [ordenes-pago.md](ordenes-pago.md) | El gate de cuadratura: facturas = cajas = total a pagar |
| [permisos.md](permisos.md) | La matriz `modulo:accion` y sus dos capas de guarda |
| [autenticacion.md](autenticacion.md) | Login, rate limit y frescura de la sesión |

## Qué NO está acá

Este directorio documenta **reglas de negocio y de seguridad**, no la arquitectura ni las
decisiones de implementación. Esas viven en los comentarios del código, que explican el
porqué de cada decisión en el lugar donde importa.

La deuda técnica conocida está en [../deuda-tecnica.md](../deuda-tecnica.md).
