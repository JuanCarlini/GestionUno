-- ROLLUP por línea de OC (certificación) — solo cuenta certs aprobadas
CREATE VIEW public.v_loc_rollup WITH (security_invoker = true) AS
SELECT loc.id AS linea_oc_id, loc.orden_compra_id, loc.cantidad,
  COALESCE(cert.unidades,0) AS unidades_certificadas,
  loc.cantidad - COALESCE(cert.unidades,0) AS unidades_pendientes,
  (loc.cantidad - COALESCE(cert.unidades,0)) * loc.precio_unitario_neto AS monto_pendiente,
  CASE WHEN COALESCE(cert.unidades,0) = 0 THEN 'sin'
       WHEN COALESCE(cert.unidades,0) >= loc.cantidad THEN 'total'
       ELSE 'parcial' END::public.estado_rollup AS estado_certificacion
FROM public.gu_lineasdeordenesdecompra loc
LEFT JOIN (
  SELECT lce.linea_oc_id, SUM(lce.avance_unidades) AS unidades
  FROM public.gu_lineasdecertificacion lce
  JOIN public.gu_certificaciones c ON c.id = lce.certificacion_id
  WHERE c.estado = 'aprobado'
  GROUP BY lce.linea_oc_id
) cert ON cert.linea_oc_id = loc.id;

-- ROLLUP por OC (certificación)
CREATE VIEW public.v_oc_rollup WITH (security_invoker = true) AS
SELECT oc.id AS orden_compra_id,
  COALESCE(SUM(r.monto_pendiente),0) AS monto_pendiente_certificar,
  CASE
    WHEN COUNT(r.linea_oc_id) = 0 THEN 'sin'
    WHEN BOOL_AND(r.estado_certificacion = 'total') THEN 'total'
    WHEN BOOL_OR(r.estado_certificacion <> 'sin') THEN 'parcial'
    ELSE 'sin'
  END::public.estado_rollup AS estado_certificacion
FROM public.gu_ordenesdecompra oc
LEFT JOIN public.v_loc_rollup r ON r.orden_compra_id = oc.id
GROUP BY oc.id;

-- ROLLUP por certificación (facturación) — solo facturas finalizadas
CREATE VIEW public.v_cert_rollup WITH (security_invoker = true) AS
SELECT ce.id AS certificacion_id, ce.total_con_iva,
  COALESCE(imp.monto,0) AS monto_facturado,
  CASE WHEN COALESCE(imp.monto,0) = 0 THEN 'sin'
       WHEN ce.total_con_iva > 0 AND COALESCE(imp.monto,0) >= ce.total_con_iva THEN 'total'
       ELSE 'parcial' END::public.estado_rollup AS estado_facturacion
FROM public.gu_certificaciones ce
LEFT JOIN (
  SELECT fc.certificacion_id, SUM(fc.monto_asignado) AS monto
  FROM public.gu_facturas_certificaciones fc
  JOIN public.gu_facturas f ON f.id = fc.factura_id
  WHERE f.estado = 'finalizado'
  GROUP BY fc.certificacion_id
) imp ON imp.certificacion_id = ce.id;

-- ROLLUP por factura (pago) — solo OPs pagadas
CREATE VIEW public.v_factura_rollup WITH (security_invoker = true) AS
SELECT f.id AS factura_id, f.total_facturado,
  COALESCE(pg.monto,0) AS monto_pagado,
  CASE WHEN COALESCE(pg.monto,0) = 0 THEN 'sin'
       WHEN f.total_facturado > 0 AND COALESCE(pg.monto,0) >= f.total_facturado THEN 'total'
       ELSE 'parcial' END::public.estado_rollup AS estado_pago
FROM public.gu_facturas f
LEFT JOIN (
  SELECT lop.factura_id, SUM(lop.monto) AS monto
  FROM public.gu_lineasdeordenesdepago lop
  JOIN public.gu_ordenesdepago op ON op.id = lop.orden_pago_id
  WHERE op.estado = 'pagado'
  GROUP BY lop.factura_id
) pg ON pg.factura_id = f.id;

-- RLS deny-anon en todas las tablas nuevas (service_role bypasea; el acceso legítimo va por API routes)
ALTER TABLE public.gu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gu_item_proveedor_precio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gu_cajas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gu_ordenesdecompra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gu_lineasdeordenesdecompra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gu_certificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gu_lineasdecertificacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gu_facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gu_lineasdefactura ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gu_facturas_certificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gu_ordenesdepago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gu_lineasdeordenesdepago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gu_lineasdeordenesdepagocaja ENABLE ROW LEVEL SECURITY;