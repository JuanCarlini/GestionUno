# Requisitos — Órdenes de pago

Ver [README.md](README.md) para el formato y para `npm run trazabilidad`.

Una orden de pago (OP) junta **qué facturas se pagan** y **de qué cajas sale la plata**.
Es el último paso del circuito y el único donde se exige cuadratura exacta.

---

## OP-01 — Una OP no sale de borrador si no cuadra

> Como **tesorero**, quiero que **una orden de pago no pueda mandarse a aprobar si lo que
> sale de las cajas no es exactamente lo que suman las facturas**, para que **no se apruebe
> un pago descuadrado y después haya que buscar la diferencia a mano**.

Tres condiciones, todas en `fn_op_gate` (migración `ccip_04`), todas evaluadas **solo** en
la transición `borrador → en_aprobacion`:

1. Todas las cajas tienen que ser de la moneda de la OP.
2. La suma de las cajas tiene que igualar `total_a_pagar`.
3. La suma de las facturas tiene que igualar `total_a_pagar`.

Es igualdad, no tope: acá no se permite "de menos" como en la imputación de facturas. Una OP
es una instrucción de pago, y una instrucción de pago que no cierra no sirve.

El `total_a_pagar` **no lo escribe la app**: lo mantiene un trigger
(`fn_recalc_op_total`) a partir de las facturas incluidas. Los servicios de agregar y quitar
facturas lo dicen explícitamente en sus tests, porque es el tipo de cosa que alguien
"arregla" agregando un update y rompe la invariante.

Que el gate corra solo al salir de borrador es deliberado: mientras se arma, la OP está
descuadrada casi todo el tiempo, y frenar cada inserción haría imposible cargarla.

### Criterios de aceptación

1. **Mandar a aprobación una OP que cuadra pasa.**
   `src/services/orden-pago.service.test.ts` → _"borrador -> en_aprobacion pasa (el gate Σcajas=Σfacturas=total lo aplica fn_op_gate)"_

2. **Si las sumas no coinciden, el error del gate sube tal cual, con los dos montos.**
   `src/services/orden-pago.service.test.ts` → _"propaga el error del gate (Σ no coincide) sin reinterpretarlo"_

3. **Agregar una factura inserta la línea y no toca `total_a_pagar`: lo recalcula el trigger.**
   `src/services/orden-pago.service.test.ts` → _"inserta la línea y no toca total_a_pagar (lo hace el trigger)"_

4. **Quitar una factura tampoco toca el total.**
   `src/services/orden-pago.service.test.ts` → _"borra la línea y no toca total_a_pagar (lo hace el trigger)"_

5. **Agregar una caja no recalcula nada: el total lo fijan las facturas, las cajas se
   comparan contra él.**
   `src/services/orden-pago.service.test.ts` → _"agrega una caja sin recalcular total (el total lo fijan las facturas)"_

6. **Una factura no finalizada, o de otra moneda, la rechaza el trigger y el error se
   propaga sin reinterpretar.**
   `src/services/orden-pago.service.test.ts` → _"propaga el error del trigger (factura no finalizada / otra moneda) sin reinterpretarlo"_

7. **Fuera de borrador no se agregan cajas: 422.**
   `src/services/orden-pago.service.test.ts` → _"no agrega cajas sobre una OP fuera de borrador (422)"_

8. **Operar sobre una OP que no existe da 404.**
   `src/services/orden-pago.service.test.ts` → _"404 si la OP no existe"_

### Fuera de alcance

- El gate **no** vuelve a correr en `en_aprobacion → aprobado` ni en `aprobado → pagado`. Si
  alguien modificara las líneas después de aprobada, la OP podría pagarse descuadrada; hoy
  lo impide que las rutas de agregar y quitar exijan borrador, no el gate.
- No se verifica que la factura no esté ya incluida en **otra** OP. El rollup de pago existe
  y la pantalla lo muestra, pero no hay una restricción que lo impida en la base.

---

## OP-02 — Pagar exige haber aprobado

> Como **administrador**, quiero que **ninguna orden de pago pase a pagada sin pasar antes
> por aprobada**, para que **la plata no salga sin que alguien la haya autorizado**.

El grafo de la OP es `borrador → en_aprobacion → aprobado → pagado`, y `pagado` es terminal.
A diferencia de OC y CE, acá hay un estado más después de la aprobación, y es el que
representa que la plata efectivamente salió.

### Criterios de aceptación

1. **De aprobado se puede pasar a pagado.**
   `src/services/transiciones.test.ts` → _"OP: aprobado -> pagado"_

2. **De en_aprobacion no se puede pagar directo.**
   `src/services/transiciones.test.ts` → _"OP: en_aprobacion -> pagado NO (hay que aprobar primero)"_

3. **El servicio también lo corta, con 409 y el motivo.**
   `src/services/orden-pago.service.test.ts` → _"no permite pagar directo desde en_aprobacion (409: falta aprobar)"_

4. **Aprobado a pagado pasa por el servicio.**
   `src/services/orden-pago.service.test.ts` → _"aprobado -> pagado pasa"_

5. **Pagado es terminal: una OP pagada no vuelve atrás.**
   `src/services/transiciones.test.ts` → _"OP: pagado es terminal"_

6. **Si otro cambió el estado en el medio, sale 409.**
   `src/services/orden-pago.service.test.ts` → _"409 si otro ya cambió el estado entre la lectura y el update"_

### Fuera de alcance

- Marcar una OP como pagada **no** mueve plata en ningún lado: es un registro, no una
  integración bancaria.

---

## OP-03 — El alta no acepta estado ni número del cliente

> Como **administrador**, quiero que **una orden de pago nazca siempre en borrador**, para
> que **nadie pueda crear una ya aprobada mandando el campo en el body**.

Es la contraparte del hallazgo S2: el cliente no elige el estado de nada. El `numero_op` lo
asigna `fn_num_op` y el `total_a_pagar` nace en 0, porque todavía no hay facturas.

### Criterios de aceptación

1. **La OP nace en borrador, sin número y con total 0.**
   `src/services/orden-pago.service.test.ts` → _"estado inicial 'borrador' (ya no 'pendiente'), sin numero_op, total_a_pagar 0"_

2. **Un estado mandado en el body se ignora.**
   `src/services/orden-pago.service.test.ts` → _"ignora un estado mandado por el cliente (S2)"_

3. **El detalle trae el proveedor, las facturas y las cajas.**
   `src/services/orden-pago.service.test.ts` → _"trae la OP con proveedor aplanado + facturas + cajas"_

---

## OP-04 — Las cajas no se borran ni cambian de moneda

> Como **tesorero**, quiero que **una caja que ya se usó en órdenes de pago no desaparezca
> ni cambie de moneda**, para que **las órdenes viejas sigan diciendo de dónde salió la
> plata**.

Borrar una caja es una **baja lógica**: `is_active = false`. Hay líneas de OP apuntándola, y
un borrado físico dejaría órdenes de pago históricas sin explicación.

La moneda es inmutable por la misma razón: el gate de OP-01 compara la moneda de cada caja
contra la de la OP. Cambiarla después reescribiría el significado de cada OP que la usó.

### Criterios de aceptación

1. **Borrar una caja la desactiva, no la elimina.**
   `src/services/caja.service.test.ts` → _"no borra: marca is_active=false (hay líneas de OP apuntando)"_

2. **No se puede cambiar la moneda de una caja ya creada.**
   `src/services/caja.service.test.ts` → _"no deja cambiar la moneda de una caja ya creada"_

3. **Nombre y entidad sí se pueden corregir.**
   `src/services/caja.service.test.ts` → _"deja cambiar nombre y entidad"_

4. **Una caja nace activa y el cliente no elige ese estado.**
   `src/services/caja.service.test.ts` → _"fuerza is_active=true; el cliente no elige el estado (S2)"_

5. **Borrar una caja que no existe da 404.**
   `src/services/caja.service.test.ts` → _"404 si la caja no existe"_

### Fuera de alcance

- No hay saldo por caja: una caja es una etiqueta de origen de fondos, no una cuenta con
  movimientos. Nada impide que una OP saque de una caja más de lo que "tiene".
