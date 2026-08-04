-- Verificacion de los reportes: comprueba invariantes que los triggers de la base
-- ya garantizan, asi que un fallo aca significa error en la agregacion, no en los datos.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM public.rpc_reporte_circuito(NULL, NULL, NULL, NULL, NULL) LOOP
    IF r.certificado > r.comprado + 0.01 THEN
      RAISE EXCEPTION 'Invariante roto (% ): certificado % > comprado %',
        r.moneda, r.certificado, r.comprado;
    END IF;
    IF r.facturado > r.certificado + 0.01 THEN
      RAISE EXCEPTION 'Invariante roto (% ): facturado % > certificado %',
        r.moneda, r.facturado, r.certificado;
    END IF;
    IF r.pagado > r.facturado + 0.01 THEN
      RAISE EXCEPTION 'Invariante roto (% ): pagado % > facturado %',
        r.moneda, r.pagado, r.facturado;
    END IF;
  END LOOP;
  RAISE NOTICE 'Invariantes del circuito: OK';
END $$;

-- El corte por proveedor tiene que sumar exactamente el total del circuito.
-- Si difiere, un JOIN esta perdiendo o duplicando filas en alguno de los dos.
DO $$
DECLARE
  v_circuito numeric;
  v_proveedores numeric;
  r record;
BEGIN
  FOR r IN SELECT DISTINCT moneda FROM public.rpc_reporte_circuito(NULL,NULL,NULL,NULL,NULL) LOOP
    SELECT comprado INTO v_circuito
    FROM public.rpc_reporte_circuito(NULL,NULL,NULL,NULL,r.moneda);

    SELECT COALESCE(SUM(comprado), 0) INTO v_proveedores
    FROM public.rpc_reporte_proveedores(NULL,NULL,NULL,NULL,r.moneda);

    IF abs(v_circuito - v_proveedores) > 0.01 THEN
      RAISE EXCEPTION 'Descuadre (%): circuito % vs proveedores %',
        r.moneda, v_circuito, v_proveedores;
    END IF;
  END LOOP;
  RAISE NOTICE 'Coherencia circuito/proveedores: OK';
END $$;

-- Agrupar y volver a sumar es tautologico, nunca puede fallar. Se valida en
-- cambio que saldo y tramo salgan bien calculados de sus propias columnas.
DO $$
DECLARE
  r record;
  v_tramo_esperado text;
BEGIN
  FOR r IN SELECT * FROM public.rpc_reporte_deuda(NULL,NULL,NULL,NULL,NULL) LOOP
    IF abs(r.saldo - (r.total_facturado - r.pagado)) > 0.01 THEN
      RAISE EXCEPTION 'Saldo mal calculado (factura %): saldo % vs total % - pagado %',
        r.numero_factura, r.saldo, r.total_facturado, r.pagado;
    END IF;

    v_tramo_esperado := CASE
      WHEN r.dias <= 30 THEN '0-30'
      WHEN r.dias <= 60 THEN '31-60'
      WHEN r.dias <= 90 THEN '61-90'
      ELSE '+90'
    END;
    IF r.tramo IS DISTINCT FROM v_tramo_esperado THEN
      RAISE EXCEPTION 'Tramo mal asignado (factura %): tramo % para dias %, esperado %',
        r.numero_factura, r.tramo, r.dias, v_tramo_esperado;
    END IF;
  END LOOP;
  RAISE NOTICE 'Coherencia de tramos de aging: OK';
END $$;
