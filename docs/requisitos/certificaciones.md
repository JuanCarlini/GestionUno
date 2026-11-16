# Requisitos — Certificaciones

Ver [README.md](README.md) para el formato y para `npm run trazabilidad`.

Una certificación (CE) declara **cuánto se ejecutó** de las líneas de una orden de compra.
Es el paso que convierte una OC aprobada en algo facturable.

---

## CE-01 — No se puede certificar más del 100% de una línea de OC

> Como **jefe de obra**, quiero que **el sistema me frene si intento certificar más
> unidades de las que la orden de compra contrató**, para que **no terminemos pagando más
> de lo que se compró**.

Es la regla dura del circuito. Vive en un trigger de Postgres
(`fn_check_avance_100`, migración `ccip_04`), no en la app, por una razón concreta: la
verificación y el `INSERT` tienen que pasar en la misma transacción, con un `FOR UPDATE`
sobre la línea de OC. Si se hiciera en JavaScript, dos certificaciones simultáneas sobre la
misma línea leerían el mismo acumulado y las dos pasarían.

El acumulado suma las certificaciones en **cualquier estado menos `anulado` y `rechazado`**.
O sea que una certificación en borrador ya reserva unidades: el criterio es que si alguien
está cargando una certificación, esas unidades no están disponibles para otro.

La app **no reimplementa** la regla: deja que el trigger la aplique y propaga el mensaje
(`P0001` → 422) sin reinterpretarlo. Así hay un solo lugar donde la regla vive.

### Criterios de aceptación

1. **El alta entera es una sola transacción: si una línea viola el 100%, no queda cabecera
   huérfana.**
   `src/services/certificacion.service.test.ts` → _"si el trigger del 100% rechaza una línea, el error sube crudo y no queda cabecera"_

2. **Una certificación necesita al menos una línea.**
   `src/services/certificacion.service.test.ts` → _"exige al menos una línea (422)"_

3. **Las líneas se mandan sin `certificacion_id`: lo asigna la transacción.** El cliente no
   puede apuntar una línea a otra certificación.
   `src/services/certificacion.service.test.ts` → _"las líneas solo llevan linea_oc_id y avance_unidades, sin certificacion_id"_

4. **La pantalla de alta muestra, por línea de OC, cuánto se certificó y cuánto queda.**
   `src/services/certificacion.service.test.ts` → _"expone el avance y el disponible que publica la vista, por línea de la OC"_

5. **Una línea sin certificar todavía muestra su cantidad entera como disponible.**
   `src/services/certificacion.service.test.ts` → _"línea sin fila en la vista: disponible = cantidad total, estado 'sin'"_

6. **Una OC sin líneas no ofrece nada que certificar.**
   `src/services/certificacion.service.test.ts` → _"OC sin líneas devuelve [] y no consulta la vista"_

7. **Certificar contra una OC que no existe da 404.**
   `src/services/certificacion.service.test.ts` → _"404 si la OC no existe"_

### Desfasaje conocido entre la pantalla y el trigger

El "disponible" que muestra la pantalla sale de la vista `v_loc_rollup`, que **solo cuenta
certificaciones aprobadas** (`WHERE c.estado = 'aprobado'`). El trigger, en cambio, cuenta
todas menos las anuladas y rechazadas.

La consecuencia práctica: si hay una certificación en borrador o en aprobación sobre una
línea, **la pantalla ofrece más saldo del que el trigger va a aceptar**. El usuario carga la
cantidad que la pantalla le ofrece y recibe un 422 del trigger.

No es un bug de seguridad —la regla dura se aplica igual— pero sí una mala experiencia, y
las dos definiciones de "disponible" deberían ser la misma. Arreglarlo es cambiar el `WHERE`
de la vista para que excluya `anulado` y `rechazado` en vez de exigir `aprobado`, lo que
cambia también lo que informan los reportes de pendiente de certificar. Queda anotado, no
resuelto.

### Fuera de alcance

- El redondeo de los montos. La regla es sobre **unidades** (`avance_unidades`), no sobre
  importes: certificar el 100% de las unidades da exactamente el monto de la línea.
- La regla **no** mira el total de la OC, línea por línea nada más. Una OC puede quedar
  certificada al 100% en una línea y al 0% en otra.

---

## CE-02 — Las certificaciones recorren un grafo de estados, sin atajos

> Como **supervisor**, quiero que **una certificación no pueda saltar de borrador a
> aprobada**, para que **nada se apruebe sin que alguien lo mire**.

El grafo es compartido con las órdenes de compra: `borrador → en_aprobacion → aprobado`,
con `rechazado` volviendo a `borrador` y `anulado` como terminal. Vive en
`src/services/transiciones.ts`, en un solo lugar para los cuatro documentos del circuito,
porque cada uno tiene su propio grafo pero las reglas de forma son las mismas.

El cambio de estado es un **update condicional**: se manda el estado que se leyó, y si entre
la lectura y la escritura otro lo cambió, el update no afecta ninguna fila y sale 409. Sin
esto, dos supervisores aprobando a la vez pisarían uno al otro en silencio.

### Criterios de aceptación

1. **Borrador puede mandarse a aprobación.**
   `src/services/transiciones.test.ts` → _"permite borrador -> en_aprobacion en OC/CE"_

2. **No se puede saltar de borrador a aprobado.**
   `src/services/transiciones.test.ts` → _"prohíbe saltar borrador -> aprobado (nada se saltea etapas)"_

3. **Una certificación rechazada vuelve a borrador para corregirse.**
   `src/services/transiciones.test.ts` → _"rechazado vuelve a borrador"_

4. **Anulado es terminal: de ahí no se sale.**
   `src/services/transiciones.test.ts` → _"anulado es terminal"_

5. **Una transición imposible se rechaza con 409 sin tocar la base.**
   `src/services/certificacion.service.test.ts` → _"rechaza una transición imposible con 409, sin tocar la DB"_

6. **Una transición válida manda el estado leído, para que el update sea condicional.**
   `src/services/certificacion.service.test.ts` → _"borrador -> en_aprobacion pasa, y manda el estado leído para el update condicional"_

7. **Si otro cambió el estado en el medio, sale 409 y no se pisa.**
   `src/services/certificacion.service.test.ts` → _"409 si otro ya cambió el estado entre la lectura y el update"_

8. **Cambiar el estado de una certificación inexistente da 404.**
   `src/services/certificacion.service.test.ts` → _"404 si la certificación no existe"_

9. **Qué permiso hace falta depende del estado destino, no del documento.** Llevar algo a
   `aprobado`, `rechazado`, `anulado` o `pagado` exige `aprobar`; mandarlo a aprobación o
   devolverlo a borrador alcanza con `crear`.
   `src/services/transiciones.test.ts` → _"en_aprobacion / borrador → 'crear'"_

### Fuera de alcance

- **Quién** puede aprobar está en [permisos.md](permisos.md); acá solo se define qué
  transiciones existen y qué acción exige cada una.
- La certificación no exige que la OC esté aprobada en este grafo: eso lo aplica un trigger
  aparte (`fn_cert_oc_aprobada`).

---

## CE-03 — Los totales los calcula la base, no el cliente

> Como **administrador**, quiero que **los totales de una certificación salgan de sus
> líneas**, para que **nadie pueda mandar un total que no se corresponda con lo certificado**.

El cliente manda líneas; los totales de cabecera los suma la transacción de alta y los
mantiene un trigger (`fn_recalc_cert_cabecera`). El `numero_cert` tampoco lo elige el
cliente: lo asigna `fn_num_cert`, lo que evita huecos y duplicados en la numeración.

### Criterios de aceptación

1. **El alta no acepta ni el número ni el estado del cliente: fuerza borrador.**
   `src/services/certificacion.service.test.ts` → _"hereda el proveedor de la OC, fuerza 'borrador' y no manda numero_cert"_

2. **Los totales de cabecera los suma la transacción, en una sola llamada.**
   `src/services/certificacion.service.test.ts` → _"una sola llamada: los totales de cabecera los suma la transacción"_

3. **El total de la certificación sale del avance de cada línea con su IVA.**
   `src/services/totales.test.ts` → _"suma avance_monto y aplica el IVA de cada línea"_

4. **Los `numeric` de Postgres llegan como string y se toleran.** Sumarlos como texto daría
   concatenación en vez de suma.
   `src/services/totales.test.ts` → _"tolera los numeric que llegan como string"_

5. **El estado de facturación de cada certificación sale de un rollup, no de un campo.**
   `src/services/certificacion.service.test.ts` → _"mergea estado_facturacion y monto_facturado por id"_

### Fuera de alcance

- El cálculo del IVA por línea es de la línea de OC, no de la certificación: la
  certificación hereda el porcentaje.
