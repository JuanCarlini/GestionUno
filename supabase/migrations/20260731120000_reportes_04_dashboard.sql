-- El dashboard traia las tres tablas completas al navegador y agregaba en JS — con
-- mas de 1000 filas (techo de
-- PostgREST) los contadores y montos quedaban silenciosamente truncados. Igual que los
-- reportes, la agregacion baja a SQL: un solo RPC, un solo round-trip, sin techo.

CREATE OR REPLACE FUNCTION public.rpc_dashboard_resumen()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
SELECT jsonb_build_object(
  'ordenes_compra', (
    SELECT jsonb_build_object(
      'total',      count(*),
      'pendientes', count(*) FILTER (WHERE estado IN ('borrador', 'en_aprobacion')),
      'aprobadas',  count(*) FILTER (WHERE estado = 'aprobado'),
      'recientes',  count(*) FILTER (WHERE created_at >= now() - interval '7 days')
    )
    FROM public.gu_ordenesdecompra
  ),
  'ordenes_pago', (
    SELECT jsonb_build_object(
      'total',      count(*),
      'pendientes', count(*) FILTER (WHERE estado IN ('borrador', 'en_aprobacion')),
      'aprobadas',  count(*) FILTER (WHERE estado = 'aprobado'),
      -- pagado por moneda: sumar ARS y USD en un solo numero no tiene sentido
      'monto_pagado_por_moneda', COALESCE((
        SELECT jsonb_object_agg(moneda::text, monto)
        FROM (
          SELECT moneda, SUM(total_a_pagar) AS monto
          FROM public.gu_ordenesdepago
          WHERE estado = 'pagado'
          GROUP BY moneda
        ) pagos
      ), '{}'::jsonb)
    )
    FROM public.gu_ordenesdepago
  ),
  'proveedores', (
    SELECT jsonb_build_object(
      'total',   count(*),
      'activos', count(*) FILTER (WHERE estado = 'activo'),
      'nuevos',  count(*) FILTER (WHERE created_at >= now() - interval '1 month')
    )
    FROM public.gu_proveedores
  ),
  -- ultimos 5 OC + 5 OP + 3 proveedores, mezclados y recortados a 10, como hacia la app
  'actividad_reciente', COALESCE((
    SELECT jsonb_agg(to_jsonb(a) ORDER BY a.fecha DESC)
    FROM (
      SELECT * FROM (
        (SELECT o.id::text AS id,
                'orden_compra' AS tipo,
                'Nueva orden de compra ' || o.numero_oc AS descripcion,
                o.created_at AS fecha,
                o.estado::text AS estado
         FROM public.gu_ordenesdecompra o
         ORDER BY o.created_at DESC LIMIT 5)
        UNION ALL
        (SELECT op.id::text,
                'orden_pago',
                'Orden de pago ' || op.numero_op || ' - ' || COALESCE(pr.nombre, 'Sin proveedor'),
                op.created_at,
                op.estado::text
         FROM public.gu_ordenesdepago op
         LEFT JOIN public.gu_proveedores pr ON pr.id = op.proveedor_id
         ORDER BY op.created_at DESC LIMIT 5)
        UNION ALL
        (SELECT p.id::text,
                'proveedor',
                'Nuevo proveedor: ' || p.nombre,
                p.created_at,
                p.estado::text
         FROM public.gu_proveedores p
         ORDER BY p.created_at DESC LIMIT 3)
      ) todos
      ORDER BY fecha DESC
      LIMIT 10
    ) a
  ), '[]'::jsonb)
);
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_dashboard_resumen() FROM anon, authenticated, public;
