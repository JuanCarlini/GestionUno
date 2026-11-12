# Deuda técnica conocida

Lo que está mal a sabiendas, por qué sigue así y qué hace falta para sacarlo. Si algo de acá
se arregla, se borra de este archivo.

## Advisories de dependencias que el CI deja pasar

`npm audit` en el CI corre con la vara en `critical`. Hoy quedan **2 high** y **8 moderate**
que no frenan el push. No es que no importen: es que la única salida es un breaking change y
un CI permanentemente rojo deja de avisar.

### zod < 4.6.6 — GHSA-mrhx-c7xc-m3w5 (high)

> Zod can exhaust memory while validating oversized constrained collections

Arrastra también a `@asteasolutions/zod-to-openapi`, que depende de zod y por eso aparece
como un segundo high.

**Por qué importa acá:** la validación de Zod está justo en el borde de la API, sobre cuerpos
que manda el cliente. Es el lugar exacto donde este advisory se puede explotar.

**Mitigación mientras tanto:** las rutas corren en Vercel, con límite de tamaño de cuerpo y
de tiempo por invocación, así que una petición gigante muere antes por ahí. No reemplaza al
arreglo.

**Qué hace falta para cerrarlo:**

1. `zod@3 → zod@4`. Son 22 archivos con schemas. Los cambios que pegan en este código:
   `z.string().email()` y compañía pasan a `z.email()`; `required_error` / `invalid_type_error`
   pasan al parámetro `error`; `.strict()` cambia de forma; el shape de `ZodError.issues` se
   movió. Los mensajes de error que hoy viajan al formulario salen de ahí, así que hay que
   mirar `src/lib/route/respuesta-error.ts` y los tests de validación.
2. `@asteasolutions/zod-to-openapi@7 → @9`. La v9 **exige** zod 4, así que va en el mismo
   movimiento, no antes. Afecta a `src/lib/openapi/contrato.ts` y a `/api/openapi.json`.
3. Correr la suite entera: la mayoría de los tests de reglas de negocio entran por un schema.

No es un cambio mecánico: conviene hacerlo como una tarea propia, con su rama y su PR.

## El historial de migraciones no refleja lo aplicado

`supabase_migrations.schema_migrations` no tiene registradas 7 de las migraciones del repo:
se aplicaron a mano desde el SQL Editor. Para saber qué hay realmente aplicado en producción
hay que mirar el catálogo (`pg_proc`, `pg_trigger`, `information_schema.columns`), no la tabla
de migraciones ni la carpeta `supabase/migrations/`.

## El esquema base no está en el repo

`supabase/migrations/` arranca en `ccip_01` y da por sentado que ya existen `gu_roles`,
`gu_usuario`, `gu_proveedores`, `gu_proyectos`, `gu_auditoria` y `gu_audit_log`, creadas por
migraciones de julio que nunca entraron al repo. Sobre una base vacía, `ccip_02` falla en su
primer `ALTER TABLE`.

**Consecuencia directa:** el night job (`.github/workflows/nightly.yml`) no puede correr,
porque arma la base de prueba desde cero con `supabase db push`.

**Qué hace falta:** un `pg_dump --schema-only` de producción, recortado a esas tablas, como
migración 0 del repo.
