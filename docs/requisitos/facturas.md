# Requisitos — Facturas

Ver [README.md](README.md) para el formato y para `npm run trazabilidad`.

Una factura (FACT) es lo que el proveedor cobra. Para que valga algo tiene que estar
**imputada** a certificaciones: decir contra qué trabajo ya aprobado se cobra.

---

## FACT-01 — Solo se imputan certificaciones aprobadas, y nunca por más que la factura

> Como **administrador**, quiero que **una factura solo pueda imputarse contra trabajo que
> ya fue aprobado, y nunca por más de lo que la propia factura dice**, para que **no se
> pague algo que nadie revisó ni se infle la imputación por encima del comprobante**.

Dos topes, los dos en el mismo trigger (`fn_check_imputacion`, migración `ccip_04`):

1. La certificación tiene que estar en `aprobado`. Una en borrador o en aprobación no
   alcanza: lo que todavía se está revisando no se paga.
2. La suma imputada no puede superar la suma de las líneas de la factura.

El trigger toma un `FOR UPDATE` sobre la factura antes de leer el acumulado. No es
decorativo: sin eso, dos imputaciones simultáneas sobre la misma factura leían el mismo
total y las dos pasaban el tope. El comentario en la migración lo dice con todas las letras.

La app propaga el error del trigger (`P0001` → 422) tal cual, sin traducirlo: el mensaje
trae los dos montos, que es lo que alguien necesita leer para entender qué pasó.

### Criterios de aceptación

1. **Si el trigger rechaza una imputación, el alta entera se cae y no queda nada a medias.**
   `src/services/factura.service.test.ts` → _"si el trigger rechaza la imputación, el error sube crudo y no se borra nada"_

2. **Cabecera, líneas e imputaciones van en una sola llamada transaccional.**
   `src/services/factura.service.test.ts` → _"manda cabecera, líneas e imputaciones en una sola llamada"_

3. **Se puede dar de alta una factura sin imputar todavía.** La imputación puede venir
   después, mientras siga en borrador.
   `src/services/factura.service.test.ts` → _"sin imputaciones manda un array vacío"_

4. **Se pueden agregar imputaciones a una factura en borrador.**
   `src/services/factura.service.test.ts` → _"agrega imputaciones a una factura en borrador"_

5. **Se puede desimputar una certificación mientras la factura siga en borrador.**
   `src/services/factura.service.test.ts` → _"desimputa una certificación de una factura en borrador"_

6. **Una factura finalizada ya no se imputa: 422.** Lo que se cerró no se toca.
   `src/services/factura.service.test.ts` → _"no imputa sobre una factura finalizada (422)"_

7. **Una factura necesita al menos una línea.**
   `src/services/factura.service.test.ts` → _"exige al menos una línea (422)"_

### Fuera de alcance

- El tope es sobre el **total con IVA** de las líneas de factura, no sobre el neto.
- La regla **no** verifica que la certificación imputada pertenezca al mismo proveedor que
  la factura. Hoy nada lo impide en la base; la pantalla solo ofrece las del proveedor, pero
  la API aceptaría una imputación cruzada. Es un hueco conocido.

---

## FACT-02 — Una factura no se finaliza sin imputar

> Como **administrador**, quiero que **no se pueda finalizar una factura que no está
> imputada a ninguna certificación**, para que **no quede habilitada para pago una factura
> que no se corresponde con ningún trabajo aprobado**.

Finalizar es lo que habilita a incluir la factura en una orden de pago. Esta validación
**sí** vive en la app (`FacturaService.cambiarEstado`) y no en un trigger, y eso es una
excepción al criterio general del circuito: es la pre-validación del gap #5. El motivo es
que el trigger no tiene cómo distinguir "todavía no imputaste" de "no vas a imputar", y el
422 de la app llega con un mensaje que el formulario puede mostrar en el lugar correcto.

Anular no exige nada: una factura cargada por error se anula aunque esté vacía.

### Criterios de aceptación

1. **Finalizar sin imputaciones da 422.**
   `src/services/factura.service.test.ts` → _"no finaliza una factura sin imputaciones (422 — gap #5, pre-validación de app)"_

2. **Con al menos una imputación, finaliza.**
   `src/services/factura.service.test.ts` → _"finaliza con al menos una imputación"_

3. **Anular no exige imputaciones.**
   `src/services/factura.service.test.ts` → _"borrador -> anulado no exige imputaciones"_

4. **La factura no tiene aprobación intermedia: va de borrador a finalizada.** A diferencia
   de OC y CE, acá no hay paso por `en_aprobacion`.
   `src/services/transiciones.test.ts` → _"FACT finaliza sin aprobación intermedia"_

5. **Pedir una transición que en facturas no existe da 409.**
   `src/services/factura.service.test.ts` → _"rechaza una transición imposible con 409 (borrador -> aprobado no existe en FACT)"_

6. **Si otro cambió el estado en el medio, sale 409.**
   `src/services/factura.service.test.ts` → _"409 si otro ya cambió el estado entre la lectura y el update"_

7. **Cambiar el estado de una factura inexistente da 404.**
   `src/services/factura.service.test.ts` → _"404 si la factura no existe"_

### Fuera de alcance

- Que la suma imputada **iguale** el total de la factura no se exige: se permite imputar de
  menos. El tope es un máximo, no una igualdad. La cuadratura exacta se exige recién en la
  orden de pago (ver [ordenes-pago.md](ordenes-pago.md)).

---

## FACT-03 — Los importes los calcula el sistema

> Como **administrador**, quiero que **los totales de la factura salgan de sus líneas**,
> para que **el total no pueda diferir de lo que la factura detalla**.

El cliente manda cantidad, precio e IVA por línea; los totales de línea y de cabecera los
calcula el sistema. El `numero_factura` lo asigna un trigger (`fn_num_fact`).

### Criterios de aceptación

1. **El alta fuerza borrador y no acepta el número del cliente.**
   `src/services/factura.service.test.ts` → _"no manda numero_factura y fuerza estado 'borrador'"_

2. **Los totales de cada línea los calcula el servicio, no se aceptan del cliente.**
   `src/services/factura.service.test.ts` → _"calcula los totales de cada línea (no los acepta del cliente)"_

3. **El neto y el total con IVA salen de cantidad, precio e IVA.**
   `src/services/totales.test.ts` → _"calcula neto y con IVA"_

4. **Con IVA 0, el neto y el total con IVA coinciden.**
   `src/services/totales.test.ts` → _"IVA 0 deja neto = con IVA"_

5. **Los importes se redondean a 2 decimales.** Sin esto, la aritmética de punto flotante
   deja totales como 0.30000000000000004.
   `src/services/totales.test.ts` → _"redondea a 2 decimales (evita 0.30000000000000004)"_

6. **El IVA de la cabecera se deriva como total con IVA menos neto**, no se vuelve a
   calcular: así la cabecera siempre cierra con la suma de las líneas.
   `src/services/totales.test.ts` → _"suma líneas y deriva el IVA como con_iva - neto"_

7. **El detalle de una factura trae sus líneas, sus imputaciones y si ya está paga.**
   `src/services/factura.service.test.ts` → _"aplana proveedor, trae líneas + imputaciones + rollup de pago"_

8. **Pedir una factura que no existe devuelve null, no un error.**
   `src/services/factura.service.test.ts` → _"null si no existe"_

### Fuera de alcance

- El comprobante en PDF (Supabase Storage) no es parte de estas reglas: es un adjunto, y su
  ausencia no bloquea ninguna transición.
