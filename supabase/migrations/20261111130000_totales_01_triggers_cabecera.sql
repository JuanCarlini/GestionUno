-- Totales de cabecera: los calcula la base, en la misma transacción que cambia las líneas.
--
-- Hasta acá la app leía las líneas y escribía los totales de la cabecera en dos round-trips
-- (OrdenCompraService.recalcularCabecera, OrdenPagoService.recalcularTotal y las dos que ya
-- se fueron con las altas transaccionales). Dos ediciones simultáneas sobre la misma OC
-- podían intercalarse así:
--
--   A inserta línea     -> A lee líneas [l1]
--   B inserta línea     -> B lee líneas [l1, l2]
--   B escribe total(l1+l2)
--   A escribe total(l1)        <- la cabecera queda mintiendo
--
-- Con el recálculo en un trigger AFTER sobre la tabla de líneas, el total se recalcula dentro
-- de la misma transacción que insertó o borró la línea, leyendo lo que esa transacción ve. No
-- hay ventana entre el read y el write, y no hace falta que la app se acuerde de llamarlo.
--
-- FOR EACH ROW y no FOR EACH STATEMENT con transition tables: una cabecera tiene un puñado de
-- líneas, el UPDATE extra por fila no se nota, y la versión por fila es la que se entiende de
-- una pasada. Un UPDATE puede mover la línea de documento, así que se recalculan los dos.

-- ------------------------------------------------------------ órdenes de compra
CREATE OR REPLACE FUNCTION public.fn_recalc_oc_cabecera() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids bigint[];
BEGIN
  v_ids := ARRAY(
    SELECT DISTINCT x FROM unnest(ARRAY[
      CASE WHEN TG_OP <> 'DELETE' THEN NEW.orden_compra_id END,
      CASE WHEN TG_OP <> 'INSERT' THEN OLD.orden_compra_id END
    ]) AS x WHERE x IS NOT NULL
  );

  UPDATE public.gu_ordenesdecompra o
  SET total_neto    = t.neto,
      total_iva     = t.con_iva - t.neto,
      total_con_iva = t.con_iva
  FROM (
    SELECT l.orden_compra_id AS id,
           COALESCE(SUM(l.total_neto), 0)    AS neto,
           COALESCE(SUM(l.total_con_iva), 0) AS con_iva
    FROM public.gu_lineasdeordenesdecompra l
    WHERE l.orden_compra_id = ANY(v_ids)
    GROUP BY l.orden_compra_id
  ) t
  WHERE o.id = t.id;

  -- Si la cabecera quedó sin líneas, el GROUP BY de arriba no devuelve fila y el UPDATE no la
  -- toca: los totales se ponen en cero explícitamente.
  UPDATE public.gu_ordenesdecompra o
  SET total_neto = 0, total_iva = 0, total_con_iva = 0
  WHERE o.id = ANY(v_ids)
    AND NOT EXISTS (
      SELECT 1 FROM public.gu_lineasdeordenesdecompra l WHERE l.orden_compra_id = o.id
    );

  RETURN NULL; -- trigger AFTER: el valor de retorno se ignora
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_oc_cabecera ON public.gu_lineasdeordenesdecompra;
CREATE TRIGGER trg_recalc_oc_cabecera
AFTER INSERT OR UPDATE OR DELETE ON public.gu_lineasdeordenesdecompra
FOR EACH ROW EXECUTE FUNCTION public.fn_recalc_oc_cabecera();

-- ------------------------------------------------------------ facturas
CREATE OR REPLACE FUNCTION public.fn_recalc_factura_cabecera() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids bigint[];
BEGIN
  v_ids := ARRAY(
    SELECT DISTINCT x FROM unnest(ARRAY[
      CASE WHEN TG_OP <> 'DELETE' THEN NEW.factura_id END,
      CASE WHEN TG_OP <> 'INSERT' THEN OLD.factura_id END
    ]) AS x WHERE x IS NOT NULL
  );

  -- total_facturado = total_con_iva: es lo que hay que pagar, y es contra esto que
  -- fn_check_imputacion topea las imputaciones.
  UPDATE public.gu_facturas f
  SET total_neto      = t.neto,
      total_iva       = t.con_iva - t.neto,
      total_con_iva   = t.con_iva,
      total_facturado = t.con_iva
  FROM (
    SELECT l.factura_id AS id,
           COALESCE(SUM(l.total_neto), 0)    AS neto,
           COALESCE(SUM(l.total_con_iva), 0) AS con_iva
    FROM public.gu_lineasdefactura l
    WHERE l.factura_id = ANY(v_ids)
    GROUP BY l.factura_id
  ) t
  WHERE f.id = t.id;

  UPDATE public.gu_facturas f
  SET total_neto = 0, total_iva = 0, total_con_iva = 0, total_facturado = 0
  WHERE f.id = ANY(v_ids)
    AND NOT EXISTS (SELECT 1 FROM public.gu_lineasdefactura l WHERE l.factura_id = f.id);

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_factura_cabecera ON public.gu_lineasdefactura;
CREATE TRIGGER trg_recalc_factura_cabecera
AFTER INSERT OR UPDATE OR DELETE ON public.gu_lineasdefactura
FOR EACH ROW EXECUTE FUNCTION public.fn_recalc_factura_cabecera();

-- ------------------------------------------------------------ certificaciones
-- Mismo patrón, con la vuelta de que avance_monto lo deriva fn_lce_derive (BEFORE INSERT):
-- este trigger es AFTER, así que lee el valor ya derivado.
CREATE OR REPLACE FUNCTION public.fn_recalc_cert_cabecera() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids bigint[];
BEGIN
  v_ids := ARRAY(
    SELECT DISTINCT x FROM unnest(ARRAY[
      CASE WHEN TG_OP <> 'DELETE' THEN NEW.certificacion_id END,
      CASE WHEN TG_OP <> 'INSERT' THEN OLD.certificacion_id END
    ]) AS x WHERE x IS NOT NULL
  );

  UPDATE public.gu_certificaciones c
  SET total_neto    = t.neto,
      total_con_iva = t.con_iva
  FROM (
    SELECT l.certificacion_id AS id,
           COALESCE(SUM(l.avance_monto), 0) AS neto,
           COALESCE(SUM(l.avance_monto * (1 + l.iva_porcentaje / 100)), 0) AS con_iva
    FROM public.gu_lineasdecertificacion l
    WHERE l.certificacion_id = ANY(v_ids)
    GROUP BY l.certificacion_id
  ) t
  WHERE c.id = t.id;

  UPDATE public.gu_certificaciones c
  SET total_neto = 0, total_con_iva = 0
  WHERE c.id = ANY(v_ids)
    AND NOT EXISTS (
      SELECT 1 FROM public.gu_lineasdecertificacion l WHERE l.certificacion_id = c.id
    );

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_cert_cabecera ON public.gu_lineasdecertificacion;
CREATE TRIGGER trg_recalc_cert_cabecera
AFTER INSERT OR UPDATE OR DELETE ON public.gu_lineasdecertificacion
FOR EACH ROW EXECUTE FUNCTION public.fn_recalc_cert_cabecera();

-- ------------------------------------------------------------ órdenes de pago
-- total_a_pagar = Σ monto de las líneas de factura. Las líneas de caja NO lo tocan: el gate
-- Σcajas = Σfacturas lo aplica fn_op_gate al mandar a aprobar.
CREATE OR REPLACE FUNCTION public.fn_recalc_op_total() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids bigint[];
BEGIN
  v_ids := ARRAY(
    SELECT DISTINCT x FROM unnest(ARRAY[
      CASE WHEN TG_OP <> 'DELETE' THEN NEW.orden_pago_id END,
      CASE WHEN TG_OP <> 'INSERT' THEN OLD.orden_pago_id END
    ]) AS x WHERE x IS NOT NULL
  );

  UPDATE public.gu_ordenesdepago op
  SET total_a_pagar = t.total
  FROM (
    SELECT l.orden_pago_id AS id, COALESCE(SUM(l.monto), 0) AS total
    FROM public.gu_lineasdeordenesdepago l
    WHERE l.orden_pago_id = ANY(v_ids)
    GROUP BY l.orden_pago_id
  ) t
  WHERE op.id = t.id;

  UPDATE public.gu_ordenesdepago op
  SET total_a_pagar = 0
  WHERE op.id = ANY(v_ids)
    AND NOT EXISTS (
      SELECT 1 FROM public.gu_lineasdeordenesdepago l WHERE l.orden_pago_id = op.id
    );

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_op_total ON public.gu_lineasdeordenesdepago;
CREATE TRIGGER trg_recalc_op_total
AFTER INSERT OR UPDATE OR DELETE ON public.gu_lineasdeordenesdepago
FOR EACH ROW EXECUTE FUNCTION public.fn_recalc_op_total();

-- ------------------------------------------------------------ altas transaccionales
-- Con los triggers arriba, el recálculo explícito que hacían las funciones de alta quedó
-- duplicado: se van, para que el total tenga un solo dueño. El orden sigue garantizado --
-- un trigger AFTER ... FOR EACH ROW corre al terminar el INSERT de las líneas, así que
-- cuando fn_crear_factura inserta las imputaciones la cabecera ya está totalizada, que es
-- lo que fn_check_imputacion necesita.
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

    -- Los totales ya los puso trg_recalc_oc_cabecera; se relee la fila para devolverla con
    -- ellos (la variable todavía tiene la cabecera en cero).
    SELECT * INTO v_oc FROM public.gu_ordenesdecompra WHERE id = v_oc.id;
  END IF;

  RETURN v_oc;
END;
$$;

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

  INSERT INTO public.gu_lineasdecertificacion (certificacion_id, linea_oc_id, avance_unidades)
  SELECT v_cert.id, l.linea_oc_id, l.avance_unidades
  FROM jsonb_to_recordset(p_lineas) AS l(
    linea_oc_id     bigint,
    avance_unidades numeric
  );

  SELECT * INTO v_cert FROM public.gu_certificaciones WHERE id = v_cert.id;
  RETURN v_cert;
END;
$$;

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

  -- Las imputaciones van después de las líneas porque fn_check_imputacion compara contra
  -- total_facturado, que para este punto ya dejó listo trg_recalc_factura_cabecera.
  IF jsonb_array_length(COALESCE(p_imputaciones, '[]'::jsonb)) > 0 THEN
    INSERT INTO public.gu_facturas_certificaciones (factura_id, certificacion_id, monto_asignado)
    SELECT v_factura.id, i.certificacion_id, i.monto_asignado
    FROM jsonb_to_recordset(p_imputaciones) AS i(
      certificacion_id bigint,
      monto_asignado   numeric
    );
  END IF;

  SELECT * INTO v_factura FROM public.gu_facturas WHERE id = v_factura.id;
  RETURN v_factura;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_crear_orden_compra(jsonb, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.fn_crear_certificacion(jsonb, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.fn_crear_factura(jsonb, jsonb, jsonb) FROM anon, authenticated, public;
