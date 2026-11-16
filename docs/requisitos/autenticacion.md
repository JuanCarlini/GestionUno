# Requisitos — Autenticación

Ver [README.md](README.md) para el formato y para `npm run trazabilidad`.

La sesión es un JWT propio, firmado con `JWT_SECRET`, guardado en una cookie. No hay
Supabase Auth: el middleware verifica el token con `jose` y las rutas lo leen con
`jsonwebtoken`.

---

## AUTH-01 — El login no filtra qué emails existen

> Como **responsable del sistema**, quiero que **un atacante no pueda averiguar qué emails
> están registrados probando el login**, para que **no pueda armarse una lista de usuarios
> válidos antes de atacar las contraseñas**.

Si el login respondiera rápido con "usuario inexistente" y lento con "clave incorrecta", la
diferencia de tiempo delataría qué emails existen: bcrypt tarda decenas de milisegundos y se
mide sin esfuerzo. Por eso, con un email que no existe, igual se compara contra un **hash de
relleno**. Los dos caminos tardan lo mismo y responden lo mismo.

El estado del usuario cierra **fail-closed**: si `estado` llega `NULL`, se trata como
inactivo. Un dato faltante nunca habilita el acceso.

### Criterios de aceptación

1. **Un login válido devuelve el usuario y el token, nunca el hash de la clave.**
   `src/lib/auth/auth.service.test.ts` → _"devuelve el usuario y el token, sin el hash de la clave"_

2. **Con un email inexistente se compara igual contra un hash de relleno.**
   `src/lib/auth/auth.service.test.ts` → _"con un email inexistente compara igual contra un hash de relleno"_

3. **Con la clave incorrecta no se emite token.**
   `src/lib/auth/auth.service.test.ts` → _"con la clave incorrecta no emite token"_

4. **Un `estado` NULL cierra en inactivo.**
   `src/lib/auth/auth.service.test.ts` → _"si estado llega NULL cierra en inactivo (fail-closed)"_

5. **Si la base falla, el login devuelve null en vez de propagar el error.** Un stack trace
   en la respuesta del login cuenta más de lo que debería.
   `src/lib/auth/auth.service.test.ts` → _"si la base explota devuelve null en vez de propagar"_

6. **El token lleva el rol en el payload**, que es lo que después resuelve los permisos.
   `src/lib/auth/auth.service.test.ts` → _"firma el token con el rol en el payload"_

7. **Un token válido se verifica y devuelve su payload.**
   `src/lib/auth/auth.service.test.ts` → _"devuelve el payload de un token válido"_

8. **Un token que no verifica devuelve null.**
   `src/lib/auth/auth.service.test.ts` → _"devuelve null si el token no verifica"_

9. **Un usuario inexistente o inactivo no se puede recuperar por id.**
   `src/lib/auth/auth.service.test.ts` → _"devuelve null si no existe o está inactivo"_

---

## AUTH-02 — El login tiene rate limit, y no se evade cambiando de IP ni de mayúsculas

> Como **responsable del sistema**, quiero que **no se puedan probar contraseñas a lo
> bruto**, para que **una clave débil no caiga por fuerza bruta**.

Cinco intentos cada quince minutos. La parte interesante no es el límite sino **contra qué
se cuenta**, porque ahí es donde estos controles se evaden:

- Se cuenta por `ip+email` **y además por email solo**. Con solo `ip+email`, alguien con
  muchas IPs prueba claves contra la misma cuenta sin tocar el límite.
- El email se normaliza a minúsculas: si no, `Juan@` y `juan@` serían dos contadores.
- La IP sale de `x-real-ip`, que lo pone la plataforma y el cliente no puede falsificar. Si
  no está, se usa el **último** salto de `X-Forwarded-For`, no el primero: el primero lo
  elige el cliente.

Un login exitoso limpia el contador, y el chequeo previo no consume intentos — si no, mirar
si estás bloqueado te bloquearía.

### Criterios de aceptación

1. **Se prefiere `x-real-ip`, que el cliente no controla.**
   `src/lib/auth/rate-limit.test.ts` → _"prefiere x-real-ip, que lo setea la plataforma y el cliente no puede falsificar"_

2. **Sin `x-real-ip` se usa el último salto del XFF, no el primero.**
   `src/lib/auth/rate-limit.test.ts` → _"sin x-real-ip usa el ÚLTIMO salto del XFF, no el primero"_

3. **Un XFF falsificado con un solo valor no rompe el cálculo.**
   `src/lib/auth/rate-limit.test.ts` → _"un XFF falsificado con un solo valor no se puede distinguir, pero no rompe"_

4. **Sin ningún header, la IP es `unknown` y se sigue contando.**
   `src/lib/auth/rate-limit.test.ts` → _"sin ningún header devuelve 'unknown'"_

5. **Hay una clave por email además de la de ip+email.**
   `src/lib/auth/rate-limit.test.ts` → _"devuelve una clave por EMAIL además de la de ip+email"_

6. **El email se normaliza a minúsculas.**
   `src/lib/auth/rate-limit.test.ts` → _"normaliza el email a minúsculas para que no se evada cambiando el case"_

7. **Pasan cinco intentos y el sexto se bloquea.**
   `src/lib/auth/rate-limit.test.ts` → _"deja pasar los primeros 5 intentos y bloquea el 6º"_

8. **Un login exitoso limpia el contador.**
   `src/lib/auth/rate-limit.test.ts` → _"un login exitoso limpia el contador"_

9. **A los quince minutos el bloqueo se levanta solo.**
   `src/lib/auth/rate-limit.test.ts` → _"la ventana expira: pasados 15 min el bloqueo se levanta"_

10. **Contadores de distintas claves no se afectan entre sí.**
    `src/lib/auth/rate-limit.test.ts` → _"claves distintas (otro IP/email) no se afectan entre sí"_

11. **El backend de Upstash usa la misma ventana que el respaldo en memoria.**
    `src/lib/auth/rate-limit.test.ts` → _"usa una ventana fija de 5 intentos / 15 minutos, la misma que tenía en memoria"_

12. **Sin intentos disponibles bloquea y calcula el `Retry-After` desde el reset.**
    `src/lib/auth/rate-limit.test.ts` → _"sin intentos disponibles bloquea y calcula el Retry-After desde el reset"_

13. **Consultar si estás bloqueado no consume un intento.**
    `src/lib/auth/rate-limit.test.ts` → _"el chequeo NO consume intentos"_

14. **El fallo consume un intento y el éxito limpia la clave.**
    `src/lib/auth/rate-limit.test.ts` → _"el fallo consume un intento y el login exitoso limpia la clave"_

### Fuera de alcance

- El respaldo en memoria solo sirve en una instancia: en Vercel, cada función tiene su
  propio proceso. Por eso existe el backend de Upstash, que es el que vale en producción.

---

## AUTH-03 — Cambiar la clave invalida las sesiones viejas

> Como **usuario**, quiero que **al cambiar mi contraseña se cierren las sesiones abiertas
> con la anterior**, para que **cambiarla sirva de algo si alguien me la había sacado**.

Un JWT no se puede revocar: una vez firmado, vale hasta que expira. La forma de invalidarlo
sin una lista negra es comparar el `iat` del token contra el `updated_at` del usuario, que se
mueve en cada cambio de clave. Si el token se emitió antes del último cambio, está obsoleto.

Dos detalles que parecen menores y no lo son:

- **Tolerancia de un segundo**: `iat` se trunca a segundos, así que un token emitido en el
  mismo instante del cambio puede quedar un poco por detrás y se invalidaría solo.
- **Fail-closed con `iat` faltante**: un token sin `iat` se considera obsoleto. No se puede
  decidir, y ante la duda se cierra.

Pero si falta `updated_at` **no** se invalida: ahí no hay información sobre la clave, y
cerrar por eso dejaría afuera a usuarios que nunca la cambiaron.

### Criterios de aceptación

1. **Un token emitido antes del último cambio de clave queda obsoleto.**
   `src/lib/auth/session-freshness.test.ts` → _"el usuario cambió su clave DESPUÉS de emitirse el token → obsoleto"_

2. **Un token emitido después sigue vigente.**
   `src/lib/auth/session-freshness.test.ts` → _"el token se emitió después del último cambio → sigue vigente"_

3. **Se tolera un segundo de diferencia, por el truncado de `iat`.**
   `src/lib/auth/session-freshness.test.ts` → _"tolera 1 segundo: `iat` se trunca a segundos y podría quedar por detrás"_

4. **Un token sin `iat` se considera obsoleto.**
   `src/lib/auth/session-freshness.test.ts` → _"FAIL-CLOSED: un token sin `iat` se considera obsoleto"_

5. **Sin `updated_at` no se invalida: no hay con qué decidir.**
   `src/lib/auth/session-freshness.test.ts` → _"sin updated_at no invalida: no hay información para decidir"_

6. **Una fecha corrupta no rompe el login.**
   `src/lib/auth/session-freshness.test.ts` → _"una fecha inválida no invalida (no rompe el login por un dato corrupto)"_

7. **`getUserById` trae `updated_at`, que es lo que hace funcionar todo esto.**
   `src/lib/auth/auth.service.test.ts` → _"trae updated_at, que es lo que invalida las sesiones viejas"_

8. **Cambiar la clave hashea con el costo configurado y mueve `updated_at`.**
   `src/lib/auth/auth.service.test.ts` → _"hashea con BCRYPT_ROUNDS y delega el update (que mueve updated_at)"_

9. **Si la clave actual no coincide, no se toca la fila.**
   `src/lib/auth/auth.service.test.ts` → _"rechaza si la clave actual no coincide y no toca la fila"_

10. **Un update fallido devuelve false, no un éxito silencioso.**
    `src/lib/auth/auth.service.test.ts` → _"devuelve false si el update falla"_

11. **Cambiar la clave de un usuario inexistente devuelve false.**
    `src/lib/auth/auth.service.test.ts` → _"devuelve false si el usuario no existe"_

12. **Después de cambiarla se emite un token nuevo**, para no dejar al usuario afuera de su
    propia sesión por el cambio que acaba de hacer.
    `src/lib/auth/auth.service.test.ts` → _"emitirToken firma con los datos del usuario (clave recién cambiada)"_

---

## AUTH-04 — El secreto del JWT se valida al arrancar

> Como **responsable del sistema**, quiero que **la app no arranque con un `JWT_SECRET`
> débil o de ejemplo**, para que **nadie pueda firmarse un token de admin**.

Toda la autorización cuelga de la firma del token: con el secreto, cualquiera emite un token
con `rol: admin`. Por eso se valida al leerlo y se **falla al arrancar**, no en el primer
login.

Se rechaza un secreto vacío, uno de menos de 32 caracteres, uno que contenga una palabra de
placeholder, y uno que contenga el nombre del proyecto. Esa última regla no es teórica: es el
caso real que se encontró y se rotó.

### Criterios de aceptación

1. **Sin la variable definida, falla.**
   `src/lib/auth/jwt-secret.test.ts` → _"falla si la variable no está definida"_

2. **Vacía, falla.**
   `src/lib/auth/jwt-secret.test.ts` → _"falla si está vacía"_

3. **Con menos de 32 caracteres, falla.**
   `src/lib/auth/jwt-secret.test.ts` → _"falla si tiene menos de 32 caracteres"_

4. **Con una palabra de placeholder, falla.**
   `src/lib/auth/jwt-secret.test.ts` → _"falla si contiene una palabra de placeholder"_

5. **Con el nombre del proyecto adentro, falla.**
   `src/lib/auth/jwt-secret.test.ts` → _"falla si contiene el nombre del proyecto (el caso real que se rotó)"_

6. **Un secreto aleatorio en base64url se acepta.**
   `src/lib/auth/jwt-secret.test.ts` → _"acepta un secreto aleatorio en base64url"_

7. **Uno en hex también**, aunque su alfabeto sea chico: 64 caracteres hex son 256 bits
   reales de entropía.
   `src/lib/auth/jwt-secret.test.ts` → _"acepta un secreto en hex (alfabeto chico pero 256 bits reales)"_

### Fuera de alcance

- La validación mira la **forma** del secreto, no si se filtró. Rotarlo cuando eso pasa es
  una tarea de operación, no algo que el código pueda detectar.
