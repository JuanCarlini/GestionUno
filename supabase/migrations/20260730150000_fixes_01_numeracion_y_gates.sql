-- #1 numeracion de LOC y CE: count(*)+1 reusaba numeros al borrar una linea/cert intermedia
--    (numero_loc duplicado silencioso; numero_cert chocaba contra su UNIQUE con un 409 criptico)
--    y colisionaba entre inserts concurrentes. Ahora max(sufijo)+1, serializado por el lock
--    FOR UPDATE de la fila padre que toman los triggers de guarda (se ejecutan antes por
--    orden alfabetico: trg_loc_oc_editable < trg_num_loc, trg_cert_oc_aprobada < trg_num_cert).
--    Esos guards pasan de FOR SHARE a FOR UPDATE: dos transacciones con FOR SHARE que luego
--    escalan a FOR UPDATE se deadlockean entre si; tomar el exclusivo de entrada lo evita.
-- #2 fn_check_imputacion no lockeaba la factura: dos imputaciones simultaneas leian el mismo
--    acumulado y ambas pasaban el tope (fn_check_avance_100 ya lockeaba su LOC; ahora es simetrico).
-- #3 las lineas de caja de una OP no tenian ni trigger de inmutabilidad (su hermana LOP si)
--    ni UNIQUE (orden_pago_id, caja_id): se podia cargar la misma caja dos veces y editar el
--    reparto despues de que fn_op_gate validara las sumas.

-- ---------- #1a: guardas con lock exclusivo del padre ----------

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

  -- FOR UPDATE (no SHARE): ademas de la guarda, serializa la numeracion de fn_num_loc.
  SELECT estado
    INTO v_estado
    FROM public.gu_ordenesdecompra
   WHERE id = v_oc_id
     FOR UPDATE;

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

CREATE OR REPLACE FUNCTION public.fn_cert_oc_aprobada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_estado public.estado_aprobacion;
  v_proveedor_id bigint;
BEGIN
  -- FOR UPDATE (no SHARE): ademas de la guarda, serializa la numeracion de fn_num_cert.
  SELECT estado, proveedor_id
    INTO v_estado, v_proveedor_id
    FROM public.gu_ordenesdecompra
   WHERE id = NEW.orden_compra_id
     FOR UPDATE;

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

-- ---------- #1b: numeracion por max(sufijo)+1 ----------

CREATE OR REPLACE FUNCTION public.fn_num_loc() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v_oc text; v_seq int;
BEGIN
  IF NEW.numero_loc IS NULL THEN
    -- El padre ya esta lockeado FOR UPDATE por fn_loc_oc_editable (misma transaccion);
    -- re-tomarlo es gratis y deja la funcion correcta por si sola.
    SELECT numero_oc INTO v_oc FROM public.gu_ordenesdecompra WHERE id = NEW.orden_compra_id FOR UPDATE;
    -- max+1 (no count+1): borrar una linea intermedia no reusa numeros ya emitidos.
    SELECT COALESCE(MAX((substring(numero_loc from '\.(\d+)$'))::int), 0) + 1 INTO v_seq
      FROM public.gu_lineasdeordenesdecompra WHERE orden_compra_id = NEW.orden_compra_id;
    NEW.numero_loc := v_oc||'.'||v_seq;
  END IF; RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.fn_num_cert() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v_ocnum text; v_prov bigint; v_seq int;
BEGIN
  SELECT numero_oc, proveedor_id INTO v_ocnum, v_prov FROM public.gu_ordenesdecompra WHERE id = NEW.orden_compra_id FOR UPDATE;
  IF NEW.proveedor_id IS NULL THEN NEW.proveedor_id := v_prov; END IF;
  IF NEW.numero_cert IS NULL THEN
    -- max+1 (no count+1): borrar una cert no reusa numeros (chocaba con el UNIQUE de numero_cert).
    SELECT COALESCE(MAX((substring(numero_cert from '\.(\d+)$'))::int), 0) + 1 INTO v_seq
      FROM public.gu_certificaciones WHERE orden_compra_id = NEW.orden_compra_id;
    NEW.numero_cert := 'CE-'||substring(v_ocnum from 4)||'.'||v_seq;
  END IF; RETURN NEW; END; $$;

-- ---------- #2: tope de imputacion con lock ----------

CREATE OR REPLACE FUNCTION public.fn_check_imputacion() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v_sum_lfact numeric; v_sum_imput numeric; v_cert public.estado_aprobacion;
BEGIN
  -- Serializa imputaciones concurrentes de la misma factura: sin esto, dos inserts
  -- simultaneos leian el mismo acumulado y ambos pasaban el tope.
  PERFORM 1 FROM public.gu_facturas WHERE id = NEW.factura_id FOR UPDATE;
  SELECT estado INTO v_cert FROM public.gu_certificaciones WHERE id = NEW.certificacion_id;
  IF v_cert <> 'aprobado' THEN RAISE EXCEPTION 'Solo se pueden imputar certificaciones aprobadas'; END IF;
  SELECT COALESCE(SUM(total_con_iva),0) INTO v_sum_lfact FROM public.gu_lineasdefactura WHERE factura_id = NEW.factura_id;
  SELECT COALESCE(SUM(monto_asignado),0) INTO v_sum_imput FROM public.gu_facturas_certificaciones WHERE factura_id = NEW.factura_id AND id <> COALESCE(NEW.id,-1);
  IF v_sum_imput + NEW.monto_asignado > v_sum_lfact THEN
    RAISE EXCEPTION 'La suma imputada a certificaciones (%) no puede superar el total de líneas de factura (%)', v_sum_imput + NEW.monto_asignado, v_sum_lfact;
  END IF; RETURN NEW; END; $$;

-- ---------- #3: cajas de OP con la misma proteccion que las facturas ----------

ALTER TABLE public.gu_lineasdeordenesdepagocaja
  ADD CONSTRAINT uq_lopcaja_op_caja UNIQUE (orden_pago_id, caja_id);

CREATE OR REPLACE FUNCTION public.fn_lopcaja_op_editable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_op_id  bigint;
  v_estado public.estado_op;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_op_id := OLD.orden_pago_id;
  ELSE
    v_op_id := NEW.orden_pago_id;
  END IF;

  SELECT estado
    INTO v_estado
    FROM public.gu_ordenesdepago
   WHERE id = v_op_id
     FOR SHARE;

  -- La OP ya no existe: DELETE en cascada de la propia OP.
  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF v_estado NOT IN ('borrador', 'rechazado') THEN
    RAISE EXCEPTION
      'No se pueden modificar las cajas de una orden de pago en estado "%"',
      v_estado;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_lopcaja_op_editable ON public.gu_lineasdeordenesdepagocaja;
CREATE TRIGGER trg_lopcaja_op_editable
  BEFORE INSERT OR UPDATE OR DELETE
  ON public.gu_lineasdeordenesdepagocaja
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_lopcaja_op_editable();

REVOKE EXECUTE ON FUNCTION public.fn_lopcaja_op_editable() FROM PUBLIC, anon, authenticated;
