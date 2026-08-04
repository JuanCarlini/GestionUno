-- Reportes: agregacion del circuito comprado -> certificado -> facturado -> pagado.
-- Agrupa siempre por moneda; sumar monedas distintas daria un total sin sentido.

CREATE OR REPLACE FUNCTION public.rpc_reporte_circuito(
  p_desde        date DEFAULT NULL,
  p_hasta        date DEFAULT NULL,
  p_proveedor_id bigint DEFAULT NULL,
  p_proyecto_id  bigint DEFAULT NULL,
  p_moneda       public.moneda_enum DEFAULT NULL
)
RETURNS TABLE (
  moneda      public.moneda_enum,
  comprado    numeric,
  certificado numeric,
  facturado   numeric,
  pagado      numeric
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
-- la fecha filtra unicamente la OC; las etapas aguas abajo se siguen por la
-- cadena de documentos y sus estados, sin importar cuando ocurrio cada una.
WITH oc_filtradas AS (
  SELECT o.id, o.moneda, o.total_con_iva, o.fecha_oc
  FROM public.gu_ordenesdecompra o
  WHERE o.estado = 'aprobado'
    AND (p_proveedor_id IS NULL OR o.proveedor_id = p_proveedor_id)
    AND (p_proyecto_id  IS NULL OR o.proyecto_id  = p_proyecto_id)
    AND (p_moneda       IS NULL OR o.moneda       = p_moneda)
    AND (p_desde        IS NULL OR o.fecha_oc     >= p_desde)
    AND (p_hasta        IS NULL OR o.fecha_oc     <= p_hasta)
),
comprado AS (
  SELECT f.moneda, SUM(f.total_con_iva) AS monto
  FROM oc_filtradas f
  GROUP BY f.moneda
),
certificado AS (
  SELECT f.moneda, SUM(c.total_con_iva) AS monto
  FROM public.gu_certificaciones c
  JOIN oc_filtradas f ON f.id = c.orden_compra_id
  WHERE c.estado = 'aprobado'
  GROUP BY f.moneda
),
-- se excluyen las imputaciones cruzadas de moneda porque no hay trigger que las
-- impida y sumarlas daria un total sin sentido.
facturado AS (
  SELECT f.moneda, SUM(fc.monto_asignado) AS monto
  FROM public.gu_facturas_certificaciones fc
  JOIN public.gu_facturas fa ON fa.id = fc.factura_id AND fa.estado = 'finalizado'
  JOIN public.gu_certificaciones c ON c.id = fc.certificacion_id AND c.estado = 'aprobado'
  JOIN oc_filtradas f ON f.id = c.orden_compra_id AND f.moneda = fa.moneda
  GROUP BY f.moneda
),
pagos_por_factura AS (
  SELECT lop.factura_id, SUM(lop.monto) AS monto
  FROM public.gu_lineasdeordenesdepago lop
  JOIN public.gu_ordenesdepago op ON op.id = lop.orden_pago_id AND op.estado = 'pagado'
  GROUP BY lop.factura_id
),
-- el pago cubre la factura entera: se reparte entre sus imputaciones en proporcion
-- a monto_asignado, unica forma de atribuirlo a una OC y por lo tanto a un proyecto.

-- se excluyen las imputaciones cruzadas de moneda porque no hay trigger que las
-- impida y sumarlas daria un total sin sentido.
pagado AS (
  SELECT f.moneda,
         SUM(pf.monto * (fc.monto_asignado / NULLIF(fa.total_facturado, 0))) AS monto
  FROM pagos_por_factura pf
  JOIN public.gu_facturas fa ON fa.id = pf.factura_id AND fa.estado = 'finalizado'
  JOIN public.gu_facturas_certificaciones fc ON fc.factura_id = pf.factura_id
  JOIN public.gu_certificaciones c ON c.id = fc.certificacion_id AND c.estado = 'aprobado'
  JOIN oc_filtradas f ON f.id = c.orden_compra_id AND f.moneda = fa.moneda
  GROUP BY f.moneda
)
SELECT m.moneda,
       COALESCE(cp.monto, 0)::numeric AS comprado,
       COALESCE(ce.monto, 0)::numeric AS certificado,
       COALESCE(fa.monto, 0)::numeric AS facturado,
       COALESCE(pg.monto, 0)::numeric AS pagado
FROM (SELECT DISTINCT moneda FROM oc_filtradas) m
LEFT JOIN comprado    cp ON cp.moneda = m.moneda
LEFT JOIN certificado ce ON ce.moneda = m.moneda
LEFT JOIN facturado   fa ON fa.moneda = m.moneda
LEFT JOIN pagado      pg ON pg.moneda = m.moneda
ORDER BY m.moneda;
$$;

-- Serie mensual para el grafico de evolucion. Solo monto: cantidad de documentos va
-- en la tabla, porque un grafico de dos ejes Y inventa correlaciones que no existen.
CREATE OR REPLACE FUNCTION public.rpc_reporte_circuito_mensual(
  p_desde        date DEFAULT NULL,
  p_hasta        date DEFAULT NULL,
  p_proveedor_id bigint DEFAULT NULL,
  p_proyecto_id  bigint DEFAULT NULL,
  p_moneda       public.moneda_enum DEFAULT NULL
)
RETURNS TABLE (
  moneda   public.moneda_enum,
  mes      date,
  comprado numeric,
  pagado   numeric
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
WITH oc_filtradas AS (
  SELECT o.id, o.moneda, o.total_con_iva, o.fecha_oc
  FROM public.gu_ordenesdecompra o
  WHERE o.estado = 'aprobado'
    AND (p_proveedor_id IS NULL OR o.proveedor_id = p_proveedor_id)
    AND (p_proyecto_id  IS NULL OR o.proyecto_id  = p_proyecto_id)
    AND (p_moneda       IS NULL OR o.moneda       = p_moneda)
),
comprado AS (
  SELECT f.moneda, date_trunc('month', f.fecha_oc)::date AS mes, SUM(f.total_con_iva) AS monto
  FROM oc_filtradas f
  WHERE (p_desde IS NULL OR f.fecha_oc >= p_desde)
    AND (p_hasta IS NULL OR f.fecha_oc <= p_hasta)
  GROUP BY 1, 2
),
pagos_por_factura AS (
  SELECT lop.factura_id, date_trunc('month', op.fecha_op)::date AS mes, SUM(lop.monto) AS monto
  FROM public.gu_lineasdeordenesdepago lop
  JOIN public.gu_ordenesdepago op ON op.id = lop.orden_pago_id AND op.estado = 'pagado'
  WHERE (p_desde IS NULL OR op.fecha_op >= p_desde)
    AND (p_hasta IS NULL OR op.fecha_op <= p_hasta)
  GROUP BY 1, 2
),
-- se excluyen las imputaciones cruzadas de moneda porque no hay trigger que las
-- impida y sumarlas daria un total sin sentido.
pagado AS (
  SELECT f.moneda, pf.mes,
         SUM(pf.monto * (fc.monto_asignado / NULLIF(fa.total_facturado, 0))) AS monto
  FROM pagos_por_factura pf
  JOIN public.gu_facturas fa ON fa.id = pf.factura_id AND fa.estado = 'finalizado'
  JOIN public.gu_facturas_certificaciones fc ON fc.factura_id = pf.factura_id
  JOIN public.gu_certificaciones c ON c.id = fc.certificacion_id AND c.estado = 'aprobado'
  JOIN oc_filtradas f ON f.id = c.orden_compra_id AND f.moneda = fa.moneda
  GROUP BY 1, 2
)
SELECT COALESCE(cp.moneda, pg.moneda) AS moneda,
       COALESCE(cp.mes, pg.mes)       AS mes,
       COALESCE(cp.monto, 0)::numeric AS comprado,
       COALESCE(pg.monto, 0)::numeric AS pagado
FROM comprado cp
FULL OUTER JOIN pagado pg ON pg.moneda = cp.moneda AND pg.mes = cp.mes
ORDER BY 1, 2;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_reporte_circuito(date, date, bigint, bigint, public.moneda_enum)
  FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.rpc_reporte_circuito_mensual(date, date, bigint, bigint, public.moneda_enum)
  FROM anon, authenticated, public;
