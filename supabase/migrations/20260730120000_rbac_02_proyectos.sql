-- El catalogo declaraba el modulo proyectos desde el principio, pero ningun rol lo
-- tenia asignado: la seccion era invisible salvo para admin, que entra por cortocircuito.
-- readonly solo consulta; supervisor y usuario tambien dan de alta y editan.

UPDATE public.gu_roles
SET permisos = permisos || ARRAY['proyectos:ver']
WHERE nombre = 'readonly'
  AND NOT ('proyectos:ver' = ANY(permisos));

UPDATE public.gu_roles
SET permisos = permisos || ARRAY['proyectos:ver','proyectos:crear']
WHERE nombre IN ('supervisor', 'usuario')
  AND NOT ('proyectos:ver' = ANY(permisos));
