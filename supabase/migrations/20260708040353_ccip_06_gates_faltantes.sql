-- Gates del circuito que vivían solo en la capa de app.
-- #1 certificar solo contra OC aprobada (+ coherencia de proveedor CE<->OC)
-- #2 pagar solo facturas finalizadas (+ coherencia proveedor/moneda, LOP inmutable fuera de borrador)
-- #6 líneas de OC inmutables fuera de borrador/rechazado
-- RAISE EXCEPTION => SQLSTATE P0001 => la app lo mapea a HTTP 422 con este mensaje tal cual.

CREATE OR REPLACE FUNCTION public.fn_cert_oc_aprobada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_estado public.estado_aprobacion;
  v_proveedor_id bigint;
BEGIN
  SELECT estado, proveedor_id
    INTO v_estado, v_proveedor_id
    FROM public.gu_ordenesdecompra
   WHERE id = NEW.orden_compra_id
     FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La orden de compra % no existe', NEW.orden_compra_id;
  END IF;

  IF v_estado <> 'aprobado' THEN
    RAISE EXCEPTION
      'Solo se puede certificar contra una orden de compra aprobada (la OC % está en estado "%")',
      NEW.orden_compra_id, v_estado;
  END IF;

  IF NEW.proveedor_id IS NULL THEN
    NEW.proveedor_id := v_proveedor_id;
  ELSIF NEW.proveedor_id <> v_proveedor_id THEN
    RAISE EXCEPTION
      'El proveedor de la certificación (%) no coincide con el de la orden de compra (%)',
      NEW.proveedor_id, v_proveedor_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cert_oc_aprobada ON public.gu_certificaciones;
CREATE TRIGGER trg_cert_oc_aprobada
  BEFORE INSERT OR UPDATE OF orden_compra_id, proveedor_id
  ON public.gu_certificaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_cert_oc_aprobada();


CREATE OR REPLACE FUNCTION public.fn_lop_factura_pagable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_op_id        bigint;
  v_op_estado    public.estado_op;
  v_op_moneda    public.moneda_enum;
  v_op_proveedor bigint;
  v_f_estado     public.estado_factura;
  v_f_moneda     public.moneda_enum;
  v_f_proveedor  bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_op_id := OLD.orden_pago_id;
  ELSE
    v_op_id := NEW.orden_pago_id;
  END IF;

  SELECT estado, moneda, proveedor_id
    INTO v_op_estado, v_op_moneda, v_op_proveedor
    FROM public.gu_ordenesdepago
   WHERE id = v_op_id
     FOR SHARE;

  -- La OP ya no existe: DELETE en cascada de la propia OP (verificado: la hija ve al padre borrado).
  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF v_op_estado NOT IN ('borrador', 'rechazado') THEN
    RAISE EXCEPTION
      'No se pueden modificar las facturas de una orden de pago en estado "%"',
      v_op_estado;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  SELECT estado, moneda, proveedor_id
    INTO v_f_estado, v_f_moneda, v_f_proveedor
    FROM public.gu_facturas
   WHERE id = NEW.factura_id
     FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La factura % no existe', NEW.factura_id;
  END IF;

  IF v_f_estado <> 'finalizado' THEN
    RAISE EXCEPTION
      'Solo se pueden pagar facturas finalizadas (la factura % está en estado "%")',
      NEW.factura_id, v_f_estado;
  END IF;

  IF v_f_moneda <> v_op_moneda THEN
    RAISE EXCEPTION
      'La factura % es en % y la orden de pago es en %',
      NEW.factura_id, v_f_moneda, v_op_moneda;
  END IF;

  IF v_f_proveedor <> v_op_proveedor THEN
    RAISE EXCEPTION
      'La factura % es del proveedor % y la orden de pago es del proveedor %',
      NEW.factura_id, v_f_proveedor, v_op_proveedor;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lop_factura_pagable ON public.gu_lineasdeordenesdepago;
CREATE TRIGGER trg_lop_factura_pagable
  BEFORE INSERT OR UPDATE OR DELETE
  ON public.gu_lineasdeordenesdepago
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_lop_factura_pagable();


CREATE OR REPLACE FUNCTION public.fn_loc_oc_editable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_oc_id  bigint;
  v_estado public.estado_aprobacion;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_oc_id := OLD.orden_compra_id;
  ELSE
    v_oc_id := NEW.orden_compra_id;
  END IF;

  SELECT estado
    INTO v_estado
    FROM public.gu_ordenesdecompra
   WHERE id = v_oc_id
     FOR SHARE;

  -- La OC ya no existe: DELETE en cascada de la propia OC.
  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF v_estado NOT IN ('borrador', 'rechazado') THEN
    RAISE EXCEPTION
      'No se pueden modificar las líneas de una orden de compra en estado "%"',
      v_estado;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_loc_oc_editable ON public.gu_lineasdeordenesdecompra;
CREATE TRIGGER trg_loc_oc_editable
  BEFORE INSERT OR UPDATE OR DELETE
  ON public.gu_lineasdeordenesdecompra
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_loc_oc_editable();


REVOKE EXECUTE ON FUNCTION public.fn_cert_oc_aprobada()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_lop_factura_pagable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_loc_oc_editable()     FROM PUBLIC, anon, authenticated;