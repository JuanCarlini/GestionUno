CREATE SEQUENCE public.seq_oc START 1;
CREATE SEQUENCE public.seq_fact START 1;
CREATE SEQUENCE public.seq_op START 1;

-- Numeración OC / FACT / OP
CREATE FUNCTION public.fn_num_oc() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN IF NEW.numero_oc IS NULL THEN NEW.numero_oc := 'OC-'||lpad(nextval('public.seq_oc')::text,5,'0'); END IF; RETURN NEW; END; $$;
CREATE TRIGGER trg_num_oc BEFORE INSERT ON public.gu_ordenesdecompra FOR EACH ROW EXECUTE FUNCTION public.fn_num_oc();

CREATE FUNCTION public.fn_num_fact() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN IF NEW.numero_factura IS NULL THEN NEW.numero_factura := 'FACT-'||lpad(nextval('public.seq_fact')::text,5,'0'); END IF; RETURN NEW; END; $$;
CREATE TRIGGER trg_num_fact BEFORE INSERT ON public.gu_facturas FOR EACH ROW EXECUTE FUNCTION public.fn_num_fact();

CREATE FUNCTION public.fn_num_op() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN IF NEW.numero_op IS NULL THEN NEW.numero_op := 'OP-'||lpad(nextval('public.seq_op')::text,5,'0'); END IF; RETURN NEW; END; $$;
CREATE TRIGGER trg_num_op BEFORE INSERT ON public.gu_ordenesdepago FOR EACH ROW EXECUTE FUNCTION public.fn_num_op();

-- Numeración LOC (OC-N.n)
CREATE FUNCTION public.fn_num_loc() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v_oc text; v_seq int;
BEGIN
  IF NEW.numero_loc IS NULL THEN
    SELECT numero_oc INTO v_oc FROM public.gu_ordenesdecompra WHERE id = NEW.orden_compra_id;
    SELECT count(*)+1 INTO v_seq FROM public.gu_lineasdeordenesdecompra WHERE orden_compra_id = NEW.orden_compra_id;
    NEW.numero_loc := v_oc||'.'||v_seq;
  END IF; RETURN NEW; END; $$;
CREATE TRIGGER trg_num_loc BEFORE INSERT ON public.gu_lineasdeordenesdecompra FOR EACH ROW EXECUTE FUNCTION public.fn_num_loc();

-- Certificación: numeración CE-{oc}.{s} + proveedor heredado de la OC
CREATE FUNCTION public.fn_num_cert() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v_ocnum text; v_prov bigint; v_seq int;
BEGIN
  SELECT numero_oc, proveedor_id INTO v_ocnum, v_prov FROM public.gu_ordenesdecompra WHERE id = NEW.orden_compra_id;
  IF NEW.proveedor_id IS NULL THEN NEW.proveedor_id := v_prov; END IF;
  IF NEW.numero_cert IS NULL THEN
    SELECT count(*)+1 INTO v_seq FROM public.gu_certificaciones WHERE orden_compra_id = NEW.orden_compra_id;
    NEW.numero_cert := 'CE-'||substring(v_ocnum from 4)||'.'||v_seq;
  END IF; RETURN NEW; END; $$;
CREATE TRIGGER trg_num_cert BEFORE INSERT ON public.gu_certificaciones FOR EACH ROW EXECUTE FUNCTION public.fn_num_cert();

-- LCE: numeración CE-N.s.x + deriva avance_monto/%/iva de la LOC
CREATE FUNCTION public.fn_lce_derive() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v_certnum text; v_seq int; v_precio numeric; v_cant numeric; v_iva numeric;
BEGIN
  SELECT precio_unitario_neto, cantidad, iva_porcentaje INTO v_precio, v_cant, v_iva
    FROM public.gu_lineasdeordenesdecompra WHERE id = NEW.linea_oc_id;
  NEW.avance_monto := round(NEW.avance_unidades * COALESCE(v_precio,0), 2);
  NEW.avance_porcentaje := CASE WHEN COALESCE(v_cant,0) > 0 THEN round(NEW.avance_unidades / v_cant * 100, 4) ELSE 0 END;
  NEW.iva_porcentaje := COALESCE(v_iva, NEW.iva_porcentaje);
  IF NEW.numero_lce IS NULL THEN
    SELECT numero_cert INTO v_certnum FROM public.gu_certificaciones WHERE id = NEW.certificacion_id;
    SELECT count(*)+1 INTO v_seq FROM public.gu_lineasdecertificacion WHERE certificacion_id = NEW.certificacion_id;
    NEW.numero_lce := v_certnum||'.'||v_seq;
  END IF; RETURN NEW; END; $$;
CREATE TRIGGER trg_lce_derive BEFORE INSERT OR UPDATE ON public.gu_lineasdecertificacion FOR EACH ROW EXECUTE FUNCTION public.fn_lce_derive();

-- Regla del 100% por unidades (con lock de la LOC)
CREATE FUNCTION public.fn_check_avance_100() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v_cant numeric; v_acum numeric;
BEGIN
  SELECT cantidad INTO v_cant FROM public.gu_lineasdeordenesdecompra WHERE id = NEW.linea_oc_id FOR UPDATE;
  IF v_cant IS NULL THEN RAISE EXCEPTION 'La línea de OC % no existe', NEW.linea_oc_id; END IF;
  SELECT COALESCE(SUM(lce.avance_unidades),0) INTO v_acum
    FROM public.gu_lineasdecertificacion lce
    JOIN public.gu_certificaciones c ON c.id = lce.certificacion_id
    WHERE lce.linea_oc_id = NEW.linea_oc_id
      AND c.estado NOT IN ('anulado','rechazado')
      AND lce.id <> COALESCE(NEW.id,-1);
  IF v_acum + NEW.avance_unidades > v_cant THEN
    RAISE EXCEPTION 'No se puede certificar más del 100%% de la línea de OC: cantidad %, ya certificado %, se intentó %', v_cant, v_acum, NEW.avance_unidades;
  END IF; RETURN NEW; END; $$;
CREATE TRIGGER trg_check_avance_100 BEFORE INSERT OR UPDATE OF avance_unidades, linea_oc_id ON public.gu_lineasdecertificacion FOR EACH ROW EXECUTE FUNCTION public.fn_check_avance_100();

-- Imputación: cert aprobada + Σ imputado ≤ Σ líneas de factura
CREATE FUNCTION public.fn_check_imputacion() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v_sum_lfact numeric; v_sum_imput numeric; v_cert public.estado_aprobacion;
BEGIN
  SELECT estado INTO v_cert FROM public.gu_certificaciones WHERE id = NEW.certificacion_id;
  IF v_cert <> 'aprobado' THEN RAISE EXCEPTION 'Solo se pueden imputar certificaciones aprobadas'; END IF;
  SELECT COALESCE(SUM(total_con_iva),0) INTO v_sum_lfact FROM public.gu_lineasdefactura WHERE factura_id = NEW.factura_id;
  SELECT COALESCE(SUM(monto_asignado),0) INTO v_sum_imput FROM public.gu_facturas_certificaciones WHERE factura_id = NEW.factura_id AND id <> COALESCE(NEW.id,-1);
  IF v_sum_imput + NEW.monto_asignado > v_sum_lfact THEN
    RAISE EXCEPTION 'La suma imputada a certificaciones (%) no puede superar el total de líneas de factura (%)', v_sum_imput + NEW.monto_asignado, v_sum_lfact;
  END IF; RETURN NEW; END; $$;
CREATE TRIGGER trg_check_imputacion BEFORE INSERT OR UPDATE ON public.gu_facturas_certificaciones FOR EACH ROW EXECUTE FUNCTION public.fn_check_imputacion();

-- Gate OC: borrador -> en_aprobacion requiere >=1 línea
CREATE FUNCTION public.fn_oc_gate() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.estado = 'en_aprobacion' AND OLD.estado = 'borrador' THEN
    IF NOT EXISTS (SELECT 1 FROM public.gu_lineasdeordenesdecompra WHERE orden_compra_id = NEW.id) THEN
      RAISE EXCEPTION 'La OC debe tener al menos una línea para mandarse a aprobar';
    END IF;
  END IF; RETURN NEW; END; $$;
CREATE TRIGGER trg_oc_gate BEFORE UPDATE OF estado ON public.gu_ordenesdecompra FOR EACH ROW EXECUTE FUNCTION public.fn_oc_gate();

-- Gate OP: borrador -> en_aprobacion requiere Σcajas = total, Σfacturas = total, cajas misma moneda
CREATE FUNCTION public.fn_op_gate() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v_cajas numeric; v_lop numeric; v_bad int;
BEGIN
  IF NEW.estado = 'en_aprobacion' AND OLD.estado = 'borrador' THEN
    SELECT COALESCE(SUM(monto),0) INTO v_cajas FROM public.gu_lineasdeordenesdepagocaja WHERE orden_pago_id = NEW.id;
    SELECT COALESCE(SUM(monto),0) INTO v_lop FROM public.gu_lineasdeordenesdepago WHERE orden_pago_id = NEW.id;
    SELECT count(*) INTO v_bad FROM public.gu_lineasdeordenesdepagocaja lc JOIN public.gu_cajas c ON c.id = lc.caja_id WHERE lc.orden_pago_id = NEW.id AND c.moneda <> NEW.moneda;
    IF v_bad > 0 THEN RAISE EXCEPTION 'Todas las cajas deben ser de la moneda de la OP (%)', NEW.moneda; END IF;
    IF v_cajas <> NEW.total_a_pagar THEN RAISE EXCEPTION 'El total de las cajas (%) debe igualar el total a pagar (%)', v_cajas, NEW.total_a_pagar; END IF;
    IF v_lop <> NEW.total_a_pagar THEN RAISE EXCEPTION 'El total de las facturas (%) debe igualar el total a pagar (%)', v_lop, NEW.total_a_pagar; END IF;
  END IF; RETURN NEW; END; $$;
CREATE TRIGGER trg_op_gate BEFORE UPDATE OF estado ON public.gu_ordenesdepago FOR EACH ROW EXECUTE FUNCTION public.fn_op_gate();

-- Re-enganche de auditoría (control de cambios) en las 4 entidades
CREATE TRIGGER trg_audit_oc AFTER INSERT OR UPDATE OR DELETE ON public.gu_ordenesdecompra FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
CREATE TRIGGER trg_audit_cert AFTER INSERT OR UPDATE OR DELETE ON public.gu_certificaciones FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
CREATE TRIGGER trg_audit_factura AFTER INSERT OR UPDATE OR DELETE ON public.gu_facturas FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
CREATE TRIGGER trg_audit_op AFTER INSERT OR UPDATE OR DELETE ON public.gu_ordenesdepago FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- Las funciones de trigger no deben ser RPC-invocables por anon/authenticated
REVOKE EXECUTE ON FUNCTION public.fn_set_updated_at(), public.fn_num_oc(), public.fn_num_fact(), public.fn_num_op(),
  public.fn_num_loc(), public.fn_num_cert(), public.fn_lce_derive(), public.fn_check_avance_100(),
  public.fn_check_imputacion(), public.fn_oc_gate(), public.fn_op_gate() FROM anon, authenticated, public;