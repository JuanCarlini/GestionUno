-- Altas compuestas en una sola transacción.
--
-- Hasta acá la app insertaba la cabecera, después las líneas, y si algo fallaba borraba la
-- cabecera a mano desde TypeScript. Dos problemas: si ese borrado también falla (timeout,
-- conexión cortada, el proceso muere entre las dos llamadas) queda un documento huérfano en
-- estado borrador; y entre el insert de la cabecera y el de las líneas hay una ventana en la
-- que otra request ve un documento con total 0.
--
-- Estas funciones reciben la cabecera y las líneas como jsonb y hacen todo en una
-- transacción: o queda el documento completo, o no queda nada. Los triggers de numeración
-- (fn_num_*), derivación (fn_lce_derive) y los gates (fn_check_avance_100,
-- fn_check_imputacion, fn_cert_oc_aprobada) son BEFORE ... FOR EACH ROW, así que corren
-- adentro y su error aborta la transacción entera.
--
-- Lo que NO hacen: nada de reglas de negocio. El armado de las líneas (precio heredado del
-- proveedor, descripción del item, totales por línea) y la validación Zod siguen en la app;
-- acá solo se persiste.
--
-- SECURITY DEFINER con search_path fijo y sin EXECUTE para nadie salvo el dueño: la app
-- entra con la service key, igual que para las rpc_reporte_*.

-- ---------------------------------------------------------------- orden de compra
CREATE OR REPLACE FUNCTION public.fn_crear_orden_compra(
  p_cabecera jsonb,
  p_lineas   jsonb DEFAULT '[]'::jsonb
)
RETURNS public.gu_ordenesdecompra
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_oc public.gu_ordenesdecompra;
BEGIN
  -- estado siempre 'borrador': lo fija el server, no el cliente. numero_oc lo pone fn_num_oc.
  INSERT INTO public.gu_ordenesdecompra
    (proveedor_id, proyecto_id, moneda, tarea, fecha_oc, observaciones, created_by, estado)
  SELECT c.proveedor_id,
         c.proyecto_id,
         COALESCE(c.moneda, 'ARS'),
         c.tarea,
         COALESCE(c.fecha_oc, current_date),
         c.observaciones,
         c.created_by,
         'borrador'
  FROM jsonb_to_record(p_cabecera) AS c(
    proveedor_id bigint,
    proyecto_id  bigint,
    moneda       public.moneda_enum,
    tarea        text,
    fecha_oc     date,
    observaciones text,
    created_by   bigint
  )
  RETURNING * INTO v_oc;

  IF jsonb_array_length(COALESCE(p_lineas, '[]'::jsonb)) > 0 THEN
    INSERT INTO public.gu_lineasdeordenesdecompra
      (orden_compra_id, item_id, descripcion, cantidad, unidad_medida,
       precio_unitario_neto, iva_porcentaje, total_neto, total_con_iva)
    SELECT v_oc.id,
           l.item_id,
           l.descripcion,
           l.cantidad,
           l.unidad_medida,
           l.precio_unitario_neto,
           COALESCE(l.iva_porcentaje, 21),
           l.total_neto,
           l.total_con_iva
    FROM jsonb_to_recordset(p_lineas) AS l(
      item_id              bigint,
      descripcion          text,
      cantidad             numeric,
      unidad_medida        text,
      precio_unitario_neto numeric,
      iva_porcentaje       numeric,
      total_neto           numeric,
      total_con_iva        numeric
    );

    -- Totales de cabecera desde las líneas ya persistidas, en la misma transacción: así no
    -- existe el instante en que la OC tiene líneas y total 0.
    UPDATE public.gu_ordenesdecompra o
    SET total_neto    = t.neto,
        total_iva     = t.con_iva - t.neto,
        total_con_iva = t.con_iva
    FROM (
      SELECT COALESCE(SUM(total_neto), 0)    AS neto,
             COALESCE(SUM(total_con_iva), 0) AS con_iva
      FROM public.gu_lineasdeordenesdecompra
      WHERE orden_compra_id = v_oc.id
    ) t
    WHERE o.id = v_oc.id
    RETURNING o.* INTO v_oc;
  END IF;

  RETURN v_oc;
END;
$$;

-- ---------------------------------------------------------------- certificación
CREATE OR REPLACE FUNCTION public.fn_crear_certificacion(
  p_cabecera jsonb,
  p_lineas   jsonb
)
RETURNS public.gu_certificaciones
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cert public.gu_certificaciones;
BEGIN
  INSERT INTO public.gu_certificaciones
    (orden_compra_id, proveedor_id, fecha_cert, fecha_devengado, observaciones, estado)
  SELECT c.orden_compra_id,
         c.proveedor_id,
         COALESCE(c.fecha_cert, current_date),
         c.fecha_devengado,
         c.observaciones,
         'borrador'
  FROM jsonb_to_record(p_cabecera) AS c(
    orden_compra_id bigint,
    proveedor_id    bigint,
    fecha_cert      date,
    fecha_devengado date,
    observaciones   text
  )
  RETURNING * INTO v_cert;

  -- avance_unidades es el único input: avance_monto, avance_porcentaje, iva_porcentaje y
  -- numero_lce los deriva fn_lce_derive, y fn_check_avance_100 rechaza el sobrecertificado
  -- (ahí es donde la ruta devuelve 422; con el alta en una transacción, ese 422 ya no deja
  -- la cabecera colgada).
  INSERT INTO public.gu_lineasdecertificacion (certificacion_id, linea_oc_id, avance_unidades)
  SELECT v_cert.id, l.linea_oc_id, l.avance_unidades
  FROM jsonb_to_recordset(p_lineas) AS l(
    linea_oc_id     bigint,
    avance_unidades numeric
  );

  -- Los totales se suman de las líneas DERIVADAS: avance_monto lo puso el trigger.
  UPDATE public.gu_certificaciones c
  SET total_neto    = t.neto,
      total_con_iva = t.con_iva
  FROM (
    SELECT COALESCE(SUM(avance_monto), 0) AS neto,
           COALESCE(SUM(avance_monto * (1 + iva_porcentaje / 100)), 0) AS con_iva
    FROM public.gu_lineasdecertificacion
    WHERE certificacion_id = v_cert.id
  ) t
  WHERE c.id = v_cert.id
  RETURNING c.* INTO v_cert;

  RETURN v_cert;
END;
$$;

-- ---------------------------------------------------------------- factura
CREATE OR REPLACE FUNCTION public.fn_crear_factura(
  p_cabecera     jsonb,
  p_lineas       jsonb,
  p_imputaciones jsonb DEFAULT '[]'::jsonb
)
RETURNS public.gu_facturas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_factura public.gu_facturas;
BEGIN
  INSERT INTO public.gu_facturas
    (proveedor_id, moneda, fecha_emision, numero_comprobante, punto_venta, observaciones, estado)
  SELECT c.proveedor_id,
         COALESCE(c.moneda, 'ARS'),
         COALESCE(c.fecha_emision, current_date),
         c.numero_comprobante,
         c.punto_venta,
         c.observaciones,
         'borrador'
  FROM jsonb_to_record(p_cabecera) AS c(
    proveedor_id       bigint,
    moneda             public.moneda_enum,
    fecha_emision      date,
    numero_comprobante text,
    punto_venta        text,
    observaciones      text
  )
  RETURNING * INTO v_factura;

  INSERT INTO public.gu_lineasdefactura
    (factura_id, descripcion, cantidad, precio_unitario, iva_porcentaje, total_neto, total_con_iva)
  SELECT v_factura.id,
         l.descripcion,
         l.cantidad,
         l.precio_unitario,
         COALESCE(l.iva_porcentaje, 21),
         l.total_neto,
         l.total_con_iva
  FROM jsonb_to_recordset(p_lineas) AS l(
    descripcion     text,
    cantidad        numeric,
    precio_unitario numeric,
    iva_porcentaje  numeric,
    total_neto      numeric,
    total_con_iva   numeric
  );

  -- total_facturado = total_con_iva, igual que hacía recalcularCabecera en la app.
  UPDATE public.gu_facturas f
  SET total_neto       = t.neto,
      total_iva        = t.con_iva - t.neto,
      total_con_iva    = t.con_iva,
      total_facturado  = t.con_iva
  FROM (
    SELECT COALESCE(SUM(total_neto), 0)    AS neto,
           COALESCE(SUM(total_con_iva), 0) AS con_iva
    FROM public.gu_lineasdefactura
    WHERE factura_id = v_factura.id
  ) t
  WHERE f.id = v_factura.id
  RETURNING f.* INTO v_factura;

  -- Las imputaciones van últimas y a propósito: fn_check_imputacion compara contra el total
  -- de la factura, que recién acá quedó calculado. Si el trigger rechaza una, se cae el alta
  -- completa en vez de dejar una factura sin imputar.
  IF jsonb_array_length(COALESCE(p_imputaciones, '[]'::jsonb)) > 0 THEN
    INSERT INTO public.gu_facturas_certificaciones (factura_id, certificacion_id, monto_asignado)
    SELECT v_factura.id, i.certificacion_id, i.monto_asignado
    FROM jsonb_to_recordset(p_imputaciones) AS i(
      certificacion_id bigint,
      monto_asignado   numeric
    );
  END IF;

  RETURN v_factura;
END;
$$;

-- Nadie las ejecuta salvo el dueño de la función y la service key de la app. Mismo criterio
-- que las rpc_reporte_*: si mañana se abre RLS para `authenticated`, estas no quedan expuestas.
REVOKE EXECUTE ON FUNCTION public.fn_crear_orden_compra(jsonb, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.fn_crear_certificacion(jsonb, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.fn_crear_factura(jsonb, jsonb, jsonb) FROM anon, authenticated, public;
