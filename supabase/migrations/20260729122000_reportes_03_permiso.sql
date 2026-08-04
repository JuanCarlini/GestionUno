-- Reportes pasa a ser un modulo de la matriz RBAC. admin no se toca: entra por el
-- cortocircuito de tienePermiso, y su array vacio es la unica fuente de verdad.
UPDATE public.gu_roles
SET permisos = array_append(permisos, 'reportes:ver')
WHERE nombre IN ('supervisor', 'usuario', 'readonly')
  AND NOT ('reportes:ver' = ANY(permisos));
