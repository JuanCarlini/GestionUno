-- Reportes: pendiente de certificar, deuda con antiguedad, circuito por
-- proveedor y ejecucion por proyecto. Agrupan siempre por moneda.

-- OC aprobadas con saldo sin certificar: comprado que todavia no se recibio.
CREATE OR REPLACE FUNCTION public.rpc_reporte_pendiente_certificar(
  p_desde        date DEFAULT NULL,
  p_hasta        date DEFAULT NULL,
  p_proveedor_id bigint DEFAULT NULL,
  p_proyecto_id  bigint DEFAULT NULL,
  p_moneda       public.moneda_enum DEFAULT NULL
)
RETURNS TABLE (
  orden_compra_id bigint,
  numero_oc       varchar,
  proveedor       text,
  proyecto        text,
  fecha_oc        date,
  moneda          public.moneda_enum,
  total_oc        numeric,
  pendiente       numeric,
  dias            integer
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
-- v_oc_rollup suma en neto (sin iva) y total_con_iva es bruto: restar uno de otro
-- infla el pendiente. Se certifica desde gu_certificaciones, que ya esta en bruto.
WITH certificado AS (
  SELECT c.orden_compra_id, SUM(c.total_con_iva) AS monto
  FROM public.gu_certificaciones c
  WHERE c.estado = 'aprobado'
  GROUP BY c.orden_compra_id
)
SELECT o.id,
       o.numero_oc,
       pr.nombre::text,
       COALESCE(py.nombre, 'Sin proyecto')::text,
       o.fecha_oc,
       o.moneda,
       o.total_con_iva,
       o.total_con_iva - COALESCE(ce.monto, 0),
       (current_date - o.fecha_oc)::integer
FROM public.gu_ordenesdecompra o
LEFT JOIN certificado ce ON ce.orden_compra_id = o.id
JOIN public.gu_proveedores pr ON pr.id = o.proveedor_id
LEFT JOIN public.gu_proyectos py ON py.id = o.proyecto_id
WHERE o.estado = 'aprobado'
  AND o.total_con_iva - COALESCE(ce.monto, 0) > 0
  AND (p_desde        IS NULL OR o.fecha_oc     >= p_desde)
  AND (p_hasta        IS NULL OR o.fecha_oc     <= p_hasta)
  AND (p_proveedor_id IS NULL OR o.proveedor_id  = p_proveedor_id)
  AND (p_proyecto_id  IS NULL OR o.proyecto_id   = p_proyecto_id)
  AND (p_moneda       IS NULL OR o.moneda        = p_moneda)
ORDER BY o.total_con_iva - COALESCE(ce.monto, 0) DESC;
$$;

-- Facturas finalizadas con saldo impago, con tramo de antiguedad desde la emision.
CREATE OR REPLACE FUNCTION public.rpc_reporte_deuda(
  p_desde        date DEFAULT NULL,
  p_hasta        date DEFAULT NULL,
  p_proveedor_id bigint DEFAULT NULL,
  p_proyecto_id  bigint DEFAULT NULL,
  p_moneda       public.moneda_enum DEFAULT NULL
)
RETURNS TABLE (
  factura_id      bigint,
  numero_factura  varchar,
  proveedor       text,
  fecha_emision   date,
  moneda          public.moneda_enum,
  total_facturado numeric,
  pagado          numeric,
  saldo           numeric,
  dias            integer,
  tramo           text
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
SELECT f.id,
       f.numero_factura,
       pr.nombre::text,
       f.fecha_emision,
       f.moneda,
       f.total_facturado,
       r.monto_pagado,
       f.total_facturado - r.monto_pagado,
       (current_date - f.fecha_emision)::integer,
       CASE
         WHEN current_date - f.fecha_emision <= 30 THEN '0-30'
         WHEN current_date - f.fecha_emision <= 60 THEN '31-60'
         WHEN current_date - f.fecha_emision <= 90 THEN '61-90'
         ELSE '+90'
       END::text
FROM public.gu_facturas f
JOIN public.v_factura_rollup r ON r.factura_id = f.id
JOIN public.gu_proveedores pr ON pr.id = f.proveedor_id
WHERE f.estado = 'finalizado'
  -- total_facturado en cero quedaria como deuda perpetua de saldo nulo
  AND f.total_facturado > 0
  AND f.total_facturado - r.monto_pagado > 0
  AND (p_desde        IS NULL OR f.fecha_emision >= p_desde)
  AND (p_hasta        IS NULL OR f.fecha_emision <= p_hasta)
  AND (p_proveedor_id IS NULL OR f.proveedor_id   = p_proveedor_id)
  AND (p_moneda       IS NULL OR f.moneda         = p_moneda)
  AND (p_proyecto_id  IS NULL OR EXISTS (
        SELECT 1
        FROM public.gu_facturas_certificaciones fc
        JOIN public.gu_certificaciones c ON c.id = fc.certificacion_id
        JOIN public.gu_ordenesdecompra o ON o.id = c.orden_compra_id
        WHERE fc.factura_id = f.id AND o.proyecto_id = p_proyecto_id))
ORDER BY (current_date - f.fecha_emision) DESC;
$$;

-- El circuito completo abierto por proveedor y moneda, mas la deuda viva.
CREATE OR REPLACE FUNCTION public.rpc_reporte_proveedores(
  p_desde        date DEFAULT NULL,
  p_hasta        date DEFAULT NULL,
  p_proveedor_id bigint DEFAULT NULL,
  p_proyecto_id  bigint DEFAULT NULL,
  p_moneda       public.moneda_enum DEFAULT NULL
)
RETURNS TABLE (
  proveedor_id bigint,
  proveedor    text,
  estado       text,
  moneda       public.moneda_enum,
  comprado     numeric,
  certificado  numeric,
  facturado    numeric,
  pagado       numeric,
  deuda        numeric,
  cantidad_oc  integer
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
WITH oc_filtradas AS (
  SELECT o.id, o.proveedor_id, o.moneda, o.total_con_iva
  FROM public.gu_ordenesdecompra o
  WHERE o.estado = 'aprobado'
    AND (p_desde        IS NULL OR o.fecha_oc     >= p_desde)
    AND (p_hasta        IS NULL OR o.fecha_oc     <= p_hasta)
    AND (p_proveedor_id IS NULL OR o.proveedor_id  = p_proveedor_id)
    AND (p_proyecto_id  IS NULL OR o.proyecto_id   = p_proyecto_id)
    AND (p_moneda       IS NULL OR o.moneda        = p_moneda)
),
comprado AS (
  SELECT f.proveedor_id, f.moneda, SUM(f.total_con_iva) AS monto, COUNT(*)::integer AS cant
  FROM oc_filtradas f
  GROUP BY 1, 2
),
certificado AS (
  SELECT f.proveedor_id, f.moneda, SUM(c.total_con_iva) AS monto
  FROM public.gu_certificaciones c
  JOIN oc_filtradas f ON f.id = c.orden_compra_id
  WHERE c.estado = 'aprobado'
  GROUP BY 1, 2
),
-- Se excluyen las imputaciones de moneda cruzada: ningun trigger las impide y
-- sumarlas bajo la moneda de la OC daria un total sin sentido.
facturado AS (
  SELECT f.proveedor_id, f.moneda, SUM(fc.monto_asignado) AS monto
  FROM public.gu_facturas_certificaciones fc
  JOIN public.gu_facturas fa ON fa.id = fc.factura_id AND fa.estado = 'finalizado'
  JOIN public.gu_certificaciones c ON c.id = fc.certificacion_id AND c.estado = 'aprobado'
  JOIN oc_filtradas f ON f.id = c.orden_compra_id AND f.moneda = fa.moneda
  GROUP BY 1, 2
),
pagos_por_factura AS (
  SELECT lop.factura_id, SUM(lop.monto) AS monto
  FROM public.gu_lineasdeordenesdepago lop
  JOIN public.gu_ordenesdepago op ON op.id = lop.orden_pago_id AND op.estado = 'pagado'
  GROUP BY 1
),
-- El denominador es total_facturado, no la suma de imputaciones: una factura
-- imputada en parte debe prorratear de menos, nunca el pago completo.
pagado AS (
  SELECT f.proveedor_id, f.moneda,
         SUM(pf.monto * (fc.monto_asignado / NULLIF(fa.total_facturado, 0))) AS monto
  FROM pagos_por_factura pf
  JOIN public.gu_facturas fa ON fa.id = pf.factura_id AND fa.estado = 'finalizado'
  JOIN public.gu_facturas_certificaciones fc ON fc.factura_id = pf.factura_id
  JOIN public.gu_certificaciones c ON c.id = fc.certificacion_id AND c.estado = 'aprobado'
  JOIN oc_filtradas f ON f.id = c.orden_compra_id AND f.moneda = fa.moneda
  GROUP BY 1, 2
)
SELECT cp.proveedor_id,
       pr.nombre::text,
       pr.estado::text,
       cp.moneda,
       cp.monto::numeric,
       COALESCE(ce.monto, 0)::numeric,
       COALESCE(fa.monto, 0)::numeric,
       COALESCE(pg.monto, 0)::numeric,
       (COALESCE(fa.monto, 0) - COALESCE(pg.monto, 0))::numeric,
       cp.cant
FROM comprado cp
JOIN public.gu_proveedores pr ON pr.id = cp.proveedor_id
LEFT JOIN certificado ce ON ce.proveedor_id = cp.proveedor_id AND ce.moneda = cp.moneda
LEFT JOIN facturado   fa ON fa.proveedor_id = cp.proveedor_id AND fa.moneda = cp.moneda
LEFT JOIN pagado      pg ON pg.proveedor_id = cp.proveedor_id AND pg.moneda = cp.moneda
ORDER BY cp.monto DESC;
$$;

-- Ejecucion por proyecto y tarea. Las OC sin proyecto se agrupan bajo 'Sin proyecto':
-- descartarlas rompe la suma contra el total general y nadie entiende por que.
CREATE OR REPLACE FUNCTION public.rpc_reporte_proyectos(
  p_desde        date DEFAULT NULL,
  p_hasta        date DEFAULT NULL,
  p_proveedor_id bigint DEFAULT NULL,
  p_proyecto_id  bigint DEFAULT NULL,
  p_moneda       public.moneda_enum DEFAULT NULL
)
RETURNS TABLE (
  proyecto_id bigint,
  proyecto    text,
  tarea       text,
  moneda      public.moneda_enum,
  comprado    numeric,
  certificado numeric,
  pendiente   numeric
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
-- v_oc_rollup suma en neto (sin iva) y total_con_iva es bruto: restar uno de otro
-- infla el pendiente. Se certifica desde gu_certificaciones, que ya esta en bruto.
WITH oc_filtradas AS (
  SELECT o.id, o.proyecto_id, o.tarea, o.moneda, o.total_con_iva
  FROM public.gu_ordenesdecompra o
  WHERE o.estado = 'aprobado'
    AND (p_desde        IS NULL OR o.fecha_oc     >= p_desde)
    AND (p_hasta        IS NULL OR o.fecha_oc     <= p_hasta)
    AND (p_proveedor_id IS NULL OR o.proveedor_id  = p_proveedor_id)
    AND (p_proyecto_id  IS NULL OR o.proyecto_id   = p_proyecto_id)
    AND (p_moneda       IS NULL OR o.moneda        = p_moneda)
),
certificado AS (
  SELECT c.orden_compra_id, SUM(c.total_con_iva) AS monto
  FROM public.gu_certificaciones c
  WHERE c.estado = 'aprobado'
  GROUP BY c.orden_compra_id
)
SELECT f.proyecto_id,
       COALESCE(py.nombre, 'Sin proyecto')::text,
       COALESCE(f.tarea, 'Sin tarea')::text,
       f.moneda,
       SUM(f.total_con_iva)::numeric,
       SUM(COALESCE(ce.monto, 0))::numeric,
       SUM(f.total_con_iva - COALESCE(ce.monto, 0))::numeric
FROM oc_filtradas f
LEFT JOIN certificado ce ON ce.orden_compra_id = f.id
LEFT JOIN public.gu_proyectos py ON py.id = f.proyecto_id
GROUP BY f.proyecto_id, py.nombre, f.tarea, f.moneda
ORDER BY 5 DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_reporte_pendiente_certificar(date, date, bigint, bigint, public.moneda_enum)
  FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.rpc_reporte_deuda(date, date, bigint, bigint, public.moneda_enum)
  FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.rpc_reporte_proveedores(date, date, bigint, bigint, public.moneda_enum)
  FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.rpc_reporte_proyectos(date, date, bigint, bigint, public.moneda_enum)
  FROM anon, authenticated, public;
