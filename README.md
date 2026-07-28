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
```

`JWT_SECRET` debe ser una cadena aleatoria de al menos 32 caracteres.
El esquema de la base de datos está en `supabase/migrations/`, en orden cronológico.

## Uso

```bash
npm run dev      # servidor de desarrollo
npm run build    # compilación de producción
npm start        # servidor de producción
npm run lint     # análisis estático
```

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
