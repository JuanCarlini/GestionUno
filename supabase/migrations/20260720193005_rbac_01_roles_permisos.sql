-- RBAC Fase 1 — precondición de schema (SCHEMA_HANDOFF.md, milestone RBAC).
-- Agrega la asignación rol->permisos. El catálogo de claves válidas vive en código
-- (src/shared/permissions-catalog.ts): 20 pares `modulo:accion`.
-- Fase 1 NO cambia el enforcement de ninguna ruta: el seed replica 1:1 la autorización actual.

ALTER TABLE gu_roles ADD COLUMN permisos text[] NOT NULL DEFAULT '{}';

-- admin: acceso por SHORT-CIRCUIT en tienePermiso (rolNombre === 'admin' => true).
-- Array vacío A PROPÓSITO: una sola fuente de verdad, sin duplicado stale-able.
UPDATE gu_roles SET permisos = '{}' WHERE nombre = 'admin';

-- supervisor: los 20 pares del catálogo.
UPDATE gu_roles SET permisos = ARRAY[
  'ordenes_compra:ver','ordenes_compra:crear','ordenes_compra:aprobar','ordenes_compra:borrar',
  'certificaciones:ver','certificaciones:crear','certificaciones:aprobar','certificaciones:borrar',
  'facturas:ver','facturas:crear','facturas:aprobar','facturas:borrar',
  'ordenes_pago:ver','ordenes_pago:crear','ordenes_pago:aprobar','ordenes_pago:borrar',
  'proveedores:ver','proveedores:crear',
  'items:ver','items:crear'
] WHERE nombre = 'supervisor';

-- usuario: ver + crear en los 6 módulos (sin aprobar/borrar). 12 pares.
UPDATE gu_roles SET permisos = ARRAY[
  'ordenes_compra:ver','ordenes_compra:crear',
  'certificaciones:ver','certificaciones:crear',
  'facturas:ver','facturas:crear',
  'ordenes_pago:ver','ordenes_pago:crear',
  'proveedores:ver','proveedores:crear',
  'items:ver','items:crear'
] WHERE nombre = 'usuario';

-- readonly: solo ver en los 6 módulos. 6 pares.
UPDATE gu_roles SET permisos = ARRAY[
  'ordenes_compra:ver',
  'certificaciones:ver',
  'facturas:ver',
  'ordenes_pago:ver',
  'proveedores:ver',
  'items:ver'
] WHERE nombre = 'readonly';