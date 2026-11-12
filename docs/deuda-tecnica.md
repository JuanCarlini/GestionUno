# Deuda técnica conocida

Lo que está mal a sabiendas, por qué sigue así y qué hace falta para sacarlo. Si algo de acá
se arregla, se borra de este archivo.

## Advisories de dependencias que quedan abiertos

`npm audit` en el CI corre con la vara en `high`, y hoy pasa: no quedan advisories high ni
critical. Quedan **8 moderate**, que el CI deja pasar:

| Paquete | Dónde pega |
|---|---|
| `@typescript-eslint/*` (5 paquetes) | Solo herramienta de desarrollo, no entra al bundle. |
| `minimatch` | Transitiva de la misma herramienta. |
| `exceljs` + `uuid` | Sí entra al runtime: es el export a Excel de los reportes. |

Los de `exceljs` son los únicos que importan de verdad. Salen con el major de `exceljs`, que
cambia la API de escritura de celdas; hay que revisar `src/lib/export/xlsx.ts`. Dependabot ya abre el
PR cuando hay versión.

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
