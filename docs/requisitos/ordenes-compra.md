# Requisitos — Órdenes de compra

Formato: una historia de usuario por regla, con criterios de aceptación numerados y, para
cada criterio, el test que lo verifica. Si un criterio no tiene test, no está cerrado.

La Fase 5 del plan de mejora completa este directorio con el resto de los módulos y agrega
`npm run trazabilidad`, que falla si un criterio apunta a un test que no existe.

---

## OC-01 — Solo el creador edita o borra su orden de compra

> Como **usuario de compras**, quiero que **mis órdenes de compra solo las pueda editar o
> borrar yo**, para que **nadie cambie el proveedor o las cantidades de una orden que yo
> cargué sin que quede claro quién fue**.

> Como **supervisor**, quiero **poder corregir órdenes de otros**, para que **un error de
> carga no quede bloqueado esperando a que vuelva quien la creó**.

**Reemplaza una exclusión de la spec original.** La spec de permisos de `Software-Compras`
dejaba "permisos por fila" explícitamente fuera de alcance: el RBAC era por
`modulo:accion` y nada más. Esta regla es la primera excepción y entró con el commit
`8ccb575`. Convive con la matriz, no la reemplaza: el permiso `ordenes_compra:crear` sigue
siendo necesario para llegar a la ruta, y esta regla se evalúa después.

El dueño es `gu_ordenesdecompra.created_by`, que sale del JWT en el alta y nunca del body.
`puedeAjenas` lo resuelve la ruta con `usuarioTienePermiso(user, "ordenes_compra", "aprobar")`,
el mismo permiso que habilita aprobar y anular.

### Criterios de aceptación

1. **El dueño puede editar y borrar su OC.**
   `src/services/orden-compra.service.test.ts` → _"el dueño puede editar y borrar su OC"_

2. **Otro usuario que no puede aprobar recibe 403 al editar, y la fila no se toca.**
   `src/services/orden-compra.service.test.ts` → _"otro usuario recibe 403 al editar, y no se toca la fila"_

3. **Otro usuario que no puede aprobar recibe 403 al borrar, y la fila no se toca.**
   `src/services/orden-compra.service.test.ts` → _"otro usuario recibe 403 al borrar, y no se toca la fila"_

4. **Quien tiene `ordenes_compra:aprobar` puede editar y borrar OCs ajenas.**
   `src/services/orden-compra.service.test.ts` → _"un supervisor puede editar y borrar OCs ajenas"_

5. **La guarda de estado tiene precedencia: una OC no editable devuelve 422 incluso a su dueño.**
   `src/services/orden-compra.service.test.ts` → _"la guarda de estado corre antes que la de dueño: una OC aprobada da 422 incluso al dueño"_

6. **El error es 403 y trae un mensaje que dice por qué.** No es 404: el usuario tiene
   `ordenes_compra:ver`, así que la OC ya la ve en el listado y esconder su existencia no
   protege nada.
   `src/services/orden-compra.service.test.ts` → _"verificarDueno deja pasar al dueño y corta al resto con un mensaje explícito"_

7. **Una OC sin `created_by` (anterior a la regla) solo la toca quien puede aprobar.**
   La columna es nullable, así que sin dueño conocido la regla falla cerrado.
   `src/services/orden-compra.service.test.ts` → _"una OC sin created_by solo la toca quien puede aprobar"_

### Fuera de alcance

- La regla **no** se aplica a certificaciones, facturas ni órdenes de pago: ahí sigue
  valiendo solo la matriz de permisos.
- La regla **no** está respaldada por RLS en la base. La app entra con la service key, así
  que el único control es `OrdenCompraService.verificarDueno`. Si alguna vez se expone la
  base a `authenticated`, esto hay que replicarlo como política.
