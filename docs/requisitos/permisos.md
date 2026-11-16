# Requisitos — Permisos

Ver [README.md](README.md) para el formato y para `npm run trazabilidad`.

La autorización es por pares **`modulo:accion`** guardados en el rol, no por grupos de rol
hardcodeados. Un rol tiene un array de permisos (`ordenes_compra:crear`, `facturas:ver`, …)
y cada punto de entrada pide el par que necesita.

---

## PERM-01 — Todo lo que escribe está gateado, y eso lo verifica un test estructural

> Como **responsable del sistema**, quiero que **sea imposible agregar una ruta que modifica
> datos sin control de permisos**, para que **un olvido no llegue a producción**.

Esta es la regla que más valor da, y no está escrita como una condición sino como un **test
que escanea el código**: recorre `src/app/api/**/route.ts`, detecta los que exportan
`POST`, `PUT`, `PATCH` o `DELETE`, y exige que referencien un gate
(`requirePermission`, `requireAdmin`, o las route-factories que lo llevan adentro).
Si alguien agrega una ruta mutante sin gate, el CI se pone rojo.

Hay una segunda regla igual para los `GET`, con una diferencia: ahí sí se permite no tener
gate, pero la excepción tiene que estar **firmada en una allowlist** con su motivo. El punto
no es prohibir, es que no sea un olvido — así fue como se coló `GET /api/proyectos` sin gate
mientras los cuatro módulos del circuito sí lo tenían.

Lo mismo del lado de las páginas: toda página del dashboard tiene que tener guarda
server-side. Una guarda solo en el cliente no es una guarda.

El test exige la **llamada** (`requirePermission(`), no la mención. Con el regex a secas, un
archivo que importaba el gate sin invocarlo pasaba; está verificado en negativo saboteando
una ruta a propósito.

### Criterios de aceptación

1. **Toda ruta de API con un método mutante referencia un gate de autorización.**
   `src/app/api/route-authz.test.ts` → _"regla dura de seguridad: toda ruta mutante tiene gate de autorización"_

2. **El escaneo encuentra rutas de verdad.** Sin esto, un error de path dejaría el test en
   verde escaneando una lista vacía.
   `src/app/api/route-authz.test.ts` → _"encontró rutas para escanear"_

3. **Los GET también llevan gate, salvo los firmados en la allowlist con su motivo.**
   `src/app/api/route-authz.test.ts` → _"regla dura de seguridad: los GET llevan gate, o están firmados en la allowlist"_

4. **Toda página del dashboard tiene guarda server-side.**
   `src/app/(dashboard)/page-authz.test.ts` → _"regla dura de seguridad: toda página del dashboard tiene guarda server-side"_

5. **El escaneo de páginas encuentra páginas de verdad.**
   `src/app/(dashboard)/page-authz.test.ts` → _"encontró páginas para escanear"_

6. **Las páginas de administración las cubre el layout, no cada una por su cuenta.**
   `src/app/(dashboard)/page-authz.test.ts` → _"el layout de admin gatea server-side (cubre a las páginas de admin/*)"_

### Límite conocido

La detección es **por archivo, no por método**. Un `route.ts` cuyo `POST` tiene gate y cuyo
`GET` no lo tiene, pasa el test. Cazar eso pide un parser de TypeScript; por ahora la red
atrapa el caso realista —un archivo entero sin gate— y el resto queda en la revisión. Está
anotado en el propio test.

### Fuera de alcance

- El test verifica que **haya** un gate, no que sea **el correcto**. Que una ruta de facturas
  pida `facturas:crear` y no `proyectos:ver` lo cubre la revisión y los tests del servicio.

---

## PERM-02 — Admin pasa siempre, y eso es deliberado

> Como **administrador**, quiero **no poder quedarme afuera de mi propio sistema**, para que
> **un error editando la matriz de permisos no deje a nadie pudiendo arreglarlo**.

El rol admin hace short-circuit: pasa aunque su matriz de permisos esté vacía. Es una
decisión anti auto-lockout, no un descuido. Sin esto, guardar un rol admin sin permisos
dejaría el sistema sin nadie que pueda volver atrás.

El short-circuit es además una optimización: cuando el usuario es admin no se consulta la
matriz, y en el resto de los casos se consulta **una sola vez** por request.

### Criterios de aceptación

1. **Admin pasa con la matriz vacía.**
   `src/shared/permissions.test.ts` → _"admin pasa siempre, aun con permisos vacíos (anti auto-lockout)"_

2. **En el servidor pasa igual, sin permisos explícitos.**
   `src/lib/auth/permissions-server.test.ts` → _"admin pasa aunque no tenga permisos explícitos (short-circuit)"_

3. **En las guardas de página también.**
   `src/lib/auth/permissions-server.test.ts` → _"admin pasa siempre (short-circuit), sin importar la matriz"_

4. **`requirePageAdmin` decide por rol y ni consulta la matriz.**
   `src/lib/auth/permissions-server.test.ts` → _"no consulta la matriz de permisos: la decisión es por rol"_

5. **La matriz se consulta una sola vez por request, y devuelve los permisos resueltos.**
   `src/lib/auth/permissions-server.test.ts` → _"devuelve los permisos del rol, y consulta la matriz UNA sola vez"_

6. **Con los permisos ya resueltos, decidir no vuelve a tocar la base.**
   `src/lib/auth/permissions-server.test.ts` → _"no consulta la base"_

### Fuera de alcance

- No hay forma de restringir a un admin. Si eso hiciera falta, el modelo entero cambia.

---

## PERM-03 — Sin permiso no se entra, y el error dice qué pasó

> Como **usuario**, quiero que **el sistema me diga claramente que no tengo permiso**, en vez
> de **mostrarme una pantalla rota o un error genérico**.

Tres respuestas distintas según el caso, y la diferencia importa:

- **401** cuando no hay sesión. En las rutas de API.
- **403** cuando hay sesión pero el rol no tiene el par `modulo:accion`.
- **Redirección** en las páginas: a `/login` sin sesión, o al fallback (por defecto
  `/dashboard`) si falta el permiso. Una página no devuelve 403: redirige a algo que la
  persona sí pueda ver.

Sin usuario ni siquiera se consulta la matriz: cortar antes ahorra una consulta y evita
filtrar por tiempo de respuesta si un rol existe.

### Criterios de aceptación

1. **Sin usuario, 401, y ni se consultan los permisos.**
   `src/lib/auth/permissions-server.test.ts` → _"401 sin usuario (ni consulta permisos)"_

2. **Con sesión pero sin el par `modulo:accion`, 403.**
   `src/lib/auth/permissions-server.test.ts` → _"403 si el rol no tiene el permiso modulo:accion"_

3. **Con el permiso, pasa.**
   `src/lib/auth/permissions-server.test.ts` → _"pasa si el rol tiene el permiso modulo:accion"_

4. **En las páginas, sin usuario se redirige a `/login`.**
   `src/lib/auth/permissions-server.test.ts` → _"redirige a /login sin usuario"_

5. **Sin el permiso se redirige al fallback declarado.**
   `src/lib/auth/permissions-server.test.ts` → _"redirige al fallback si el rol no tiene el permiso"_

6. **Si no se declara fallback, se redirige a `/dashboard`.**
   `src/lib/auth/permissions-server.test.ts` → _"redirige al default /dashboard si no se pasa fallback"_

7. **Con el permiso, la página devuelve el usuario y no redirige.**
   `src/lib/auth/permissions-server.test.ts` → _"devuelve el usuario si tiene el permiso (y NO redirige)"_

8. **Las rutas de admin devuelven 403 a un rol que no es admin.**
   `src/lib/auth/permissions-server.test.ts` → _"403 si el rol no es admin"_

9. **`readonly` tampoco entra a administración.**
   `src/lib/auth/permissions-server.test.ts` → _"readonly tampoco entra"_

10. **En el camino de error los permisos vuelven en null**, para que nadie los use por
    accidente creyendo que la verificación pasó.
    `src/lib/auth/permissions-server.test.ts` → _"en el camino de error los permisos vienen en null"_

---

## PERM-04 — El catálogo de permisos es cerrado

> Como **administrador**, quiero que **solo se puedan asignar permisos que existen**, para
> que **un typo en la matriz no quede como un permiso que nunca se cumple**.

`esPermisoValido` verifica contra un catálogo fijo de 24 pares. Un permiso mal escrito se
rechaza al guardar el rol, en vez de quedar guardado y no habilitar nada — que es el bug
difícil de encontrar, porque la pantalla muestra el permiso asignado y el sistema lo niega.

Qué acciones tiene cada módulo no es uniforme, y es a propósito: `proyectos` tiene `ver` y
`crear` pero no `aprobar` ni `borrar`, porque un proyecto no se aprueba. `proveedores` sí
tiene `aprobar` pero no `borrar`, porque los proveedores se dan de baja lógica.
`reportes` solo tiene `ver`.

### Criterios de aceptación

1. **El catálogo tiene exactamente 24 claves válidas.**
   `src/shared/permissions.test.ts` → _"el catálogo tiene exactamente estas 24 claves válidas"_

2. **Un par válido se acepta.**
   `src/shared/permissions.test.ts` → _"par válido → true"_

3. **Un par que el módulo no declara se rechaza.**
   `src/shared/permissions.test.ts` → _"par no declarado (reportes solo tiene ver) → false"_

4. **Una clave malformada o inexistente se rechaza sin romper.**
   `src/shared/permissions.test.ts` → _"clave malformada / inexistente → false"_

5. **`proyectos` está en el catálogo con ver y crear**, para que su ruta pueda gatear.
   `src/shared/permissions.test.ts` → _"proyectos está en el catálogo (ver/crear), para que su ruta pueda gatear por permiso"_

6. **`proyectos` no tiene aprobar ni borrar.**
   `src/shared/permissions.test.ts` → _"proyectos no tiene aprobar ni borrar"_

7. **`proveedores` tiene aprobar pero no borrar.**
   `src/shared/permissions.test.ts` → _"proveedores sí tiene aprobar, pero no borrar"_

8. **Tener el permiso exacto alcanza; no tenerlo no.**
   `src/shared/permissions.test.ts` → _"tiene el permiso exacto → true"_

9. **Un rol `readonly` con solo `:ver` puede ver y nada más.**
   `src/shared/permissions.test.ts` → _"readonly con solo ':ver' puede ver pero nada más"_

10. **Un módulo y una acción que por separado existen pero no forman un par del array dan
    false, sin romper.**
    `src/shared/permissions.test.ts` → _"módulo/acción que no forman un par del array → false (no rompe)"_

### Fuera de alcance

- La **propiedad de la fila** —quién creó una OC— no es parte de la matriz: es una regla
  aparte, documentada en [ordenes-compra.md](ordenes-compra.md).
