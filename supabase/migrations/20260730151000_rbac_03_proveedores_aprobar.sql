-- Suspender/activar/borrar proveedores exigia solo proveedores:crear, que el rol
-- usuario tiene — contradecia la regla declarada
-- ("solo supervisores y administradores"), que la UI gateaba pero la API no.
-- Se agrega proveedores:aprobar al supervisor; admin entra por el cortocircuito de tienePermiso.
UPDATE public.gu_roles
SET permisos = array_append(permisos, 'proveedores:aprobar')
WHERE nombre = 'supervisor'
  AND NOT ('proveedores:aprobar' = ANY(permisos));
