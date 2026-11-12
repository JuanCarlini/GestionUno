# Gestión Uno

ERP de control de compras y pagos para constructoras y desarrolladoras inmobiliarias.
Implementa el circuito Orden de Compra → Certificación → Factura → Orden de Pago, con
control de acceso por roles y permisos, y auditoría de operaciones.

## Stack

Next.js 15 (App Router) · React 18 · TypeScript 5 · Tailwind CSS 3.4 + shadcn/ui ·
PostgreSQL (Supabase) · autenticación JWT propia (jsonwebtoken + bcryptjs) ·
validación con Zod.

## Requisitos

Node.js 18.18 o superior y npm.

## Instalación

```bash
npm install
```

Crear un archivo `.env.local` en la raíz con las siguientes variables:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET
UPSTASH_REDIS_REST_URL      # opcional en desarrollo, necesario en producción
UPSTASH_REDIS_REST_TOKEN    # opcional en desarrollo, necesario en producción
```

`JWT_SECRET` debe ser una cadena aleatoria de al menos 32 caracteres.

Las dos de `UPSTASH_` son el contador de intentos de login. Sin ellas la app arranca igual,
pero el contador queda en memoria y en Vercel cada lambda tiene el suyo: el límite real pasa
de "5 intentos cada 15 minutos" a "5 por instancia". Cuando faltan, queda un warning en el log
al primer login. En producción tienen que estar.

El esquema de la base de datos está en `supabase/migrations/`, en orden cronológico.

El contrato de la API se sirve en `GET /api/openapi.json` (solo admin) y se genera desde los
mismos schemas Zod que validan en el borde, así que no se desactualiza. Un test falla si una
ruta de `src/app/api` no está descrita.

## Uso

```bash
npm run dev      # servidor de desarrollo
npm run build    # compilación de producción
npm start        # servidor de producción
npm run lint     # análisis estático
npm test         # suite de vitest (lógica + componentes)
npm run test:watch
npm run test:e2e # Playwright, contra una app levantada (ver abajo)
```

## Verificación por fases

| Cuándo | Qué corre | Dónde |
|---|---|---|
| Al commitear | eslint y los tests de lo que tocaste | husky + lint-staged |
| En cada push | lint, tipos, tests, audit y build | `.github/workflows/ci.yml` |
| Cada noche | el circuito de punta a punta contra una base sembrada | `.github/workflows/nightly.yml` |
| Cada 15 min | `GET /api/health` en producción | `.github/workflows/monitor.yml` |

Los specs de Playwright están en `e2e/`: `circuito.spec.ts` recorre OC → certificación →
factura → orden de pago por API (las reglas viven en los services y en los triggers, no en los
formularios) y `navegacion.spec.ts` cubre el humo de la UI.

Para correrlos a mano contra un entorno de prueba:

```bash
psql "$E2E_DB_URL" -f supabase/seed.sql   # usuarios y datos de prueba
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

`supabase/seed.sql` crea un usuario por rol con una contraseña pública y aborta si la base
tiene documentos: **no correrlo nunca contra producción**.

## Estructura

```
src/
├── app/            Rutas de la aplicación (App Router): páginas y endpoints HTTP
├── services/       Reglas de negocio por dominio
├── repositories/   Acceso a datos: única capa que consulta la base
├── models/         Tipos y enumeraciones del dominio
├── views/          Pantallas de cada módulo
├── components/     Componentes reutilizables y primitivas de interfaz
├── hooks/          Hooks de React para consumo de datos
├── lib/            Infraestructura de servidor: autenticación, auditoría, base de datos
└── shared/         Validaciones y utilidades compartidas
```
