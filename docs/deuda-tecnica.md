# Deuda técnica conocida

Lo que está mal a sabiendas, por qué sigue así y qué hace falta para sacarlo. Si algo de acá
se arregla, se borra de este archivo.

## Advisories de dependencias que quedan abiertos

El CI corre `npm run auditoria-deps`, con la vara en `high`. El script permite advisories de
a uno, con el motivo escrito y una fecha de revisión, y falla con cualquier otro high o
critical, con un permiso vencido y con un permiso que ya no corresponde a ningún advisory.

### Permitido hoy: `GHSA-fc5q-39xc-vjpf` en `picomatch`, hasta 2027-02-15

ReDoS en extglobs. **No hay versión parcheada**: el rango vulnerable es `*`, incluida la
última publicada (4.0.7), así que no hay a dónde subir. Lo que `npm audit fix --force`
propone es bajar `vitest` 4 a 3.1.4 —un downgrade de major que tampoco arregla nada— o migrar
`tailwindcss` 3 a 4.

Arrastra a 15 paquetes más por cascada (`fdir`, `micromatch`, `anymatch`, `readdirp`,
`chokidar`, `fast-glob`, `tinyglobby`, `sucrase`, `tailwindcss`, `vite`, `vitest` y las
herramientas de eslint). Son todos glob de build corriendo sobre rutas del propio repo, no
sobre input de usuario, y ninguno entra al bundle.

Qué hace falta para sacarlo: que `picomatch` publique una versión parcheada. Ahí se borra la
entrada de `PERMITIDOS` en `scripts/auditoria-deps.mjs` y el propio script avisa si alguien
se olvida, porque falla cuando un permiso ya no corresponde.

### Los moderate, que el CI deja pasar

| Paquete | Dónde pega |
|---|---|
| `@typescript-eslint/*` | Solo herramienta de desarrollo, no entra al bundle. |
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
