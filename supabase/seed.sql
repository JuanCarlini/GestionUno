-- Datos semilla para un entorno de PRUEBA. Lo usa el night job (.github/workflows/nightly.yml)
-- después de aplicar las migraciones, para que el E2E tenga contra qué correr.
--
-- NUNCA correr esto contra producción: crea usuarios con una contraseña conocida y pública.
-- La guarda de abajo aborta si la base tiene documentos del circuito.
--
-- Es idempotente: se puede correr dos veces seguidas sin duplicar nada. Ojo con el método,
-- porque no es uniforme: gu_usuario (email), gu_items (codigo) y gu_proyectos (codigo) tienen
-- UNIQUE y usan ON CONFLICT; gu_roles, gu_proveedores y gu_cajas NO lo tienen, así que van con
-- WHERE NOT EXISTS. Verificado contra el catálogo de la base, no contra las migraciones.

-- ---------------------------------------------------------------- guarda
-- Un seed que se puede correr por accidente contra la base equivocada es una bomba de tiempo.
-- Si hay documentos del circuito, esta no es una base de prueba recién migrada.
DO $$
DECLARE
  v_docs int;
BEGIN
  SELECT (SELECT count(*) FROM public.gu_ordenesdecompra)
       + (SELECT count(*) FROM public.gu_facturas)
       + (SELECT count(*) FROM public.gu_ordenesdepago)
    INTO v_docs;

  IF v_docs > 0 THEN
    RAISE EXCEPTION
      'seed.sql abortado: la base ya tiene % documentos del circuito. Este script es solo para entornos de prueba vacíos.', v_docs;
  END IF;
END $$;

-- ---------------------------------------------------------------- roles
-- Los crean las migraciones rbac_*; acá se insertan si faltan y se reafirma la matriz, porque
-- de qué puede hacer cada rol depende la mitad de lo que verifica el E2E.
INSERT INTO public.gu_roles (nombre, descripcion, permisos)
SELECT v.nombre, v.descripcion, v.permisos
FROM (VALUES
  ('admin', 'Acceso total (short-circuit en tienePermiso)', '{}'::text[]),
  ('supervisor', 'Aprueba y anula en todo el circuito', ARRAY[
    'ordenes_compra:ver','ordenes_compra:crear','ordenes_compra:aprobar','ordenes_compra:borrar',
    'certificaciones:ver','certificaciones:crear','certificaciones:aprobar','certificaciones:borrar',
    'facturas:ver','facturas:crear','facturas:aprobar','facturas:borrar',
    'ordenes_pago:ver','ordenes_pago:crear','ordenes_pago:aprobar','ordenes_pago:borrar',
    'proveedores:ver','proveedores:crear','proveedores:aprobar',
    'items:ver','items:crear',
    'proyectos:ver','proyectos:crear',
    'reportes:ver'
  ]),
  ('usuario', 'Carga documentos, no aprueba', ARRAY[
    'ordenes_compra:ver','ordenes_compra:crear',
    'certificaciones:ver','certificaciones:crear',
    'facturas:ver','facturas:crear',
    'ordenes_pago:ver','ordenes_pago:crear',
    'proveedores:ver','proveedores:crear',
    'items:ver','items:crear',
    'proyectos:ver','proyectos:crear',
    'reportes:ver'
  ]),
  ('readonly', 'Solo lectura', ARRAY[
    'ordenes_compra:ver','certificaciones:ver','facturas:ver','ordenes_pago:ver',
    'proveedores:ver','items:ver','proyectos:ver','reportes:ver'
  ])
) AS v(nombre, descripcion, permisos)
WHERE NOT EXISTS (SELECT 1 FROM public.gu_roles r WHERE r.nombre = v.nombre);

UPDATE public.gu_roles r
SET permisos = v.permisos
FROM (VALUES
  ('admin', '{}'::text[]),
  ('supervisor', ARRAY[
    'ordenes_compra:ver','ordenes_compra:crear','ordenes_compra:aprobar','ordenes_compra:borrar',
    'certificaciones:ver','certificaciones:crear','certificaciones:aprobar','certificaciones:borrar',
    'facturas:ver','facturas:crear','facturas:aprobar','facturas:borrar',
    'ordenes_pago:ver','ordenes_pago:crear','ordenes_pago:aprobar','ordenes_pago:borrar',
    'proveedores:ver','proveedores:crear','proveedores:aprobar',
    'items:ver','items:crear',
    'proyectos:ver','proyectos:crear',
    'reportes:ver'
  ]),
  ('usuario', ARRAY[
    'ordenes_compra:ver','ordenes_compra:crear',
    'certificaciones:ver','certificaciones:crear',
    'facturas:ver','facturas:crear',
    'ordenes_pago:ver','ordenes_pago:crear',
    'proveedores:ver','proveedores:crear',
    'items:ver','items:crear',
    'proyectos:ver','proyectos:crear',
    'reportes:ver'
  ]),
  ('readonly', ARRAY[
    'ordenes_compra:ver','certificaciones:ver','facturas:ver','ordenes_pago:ver',
    'proveedores:ver','items:ver','proyectos:ver','reportes:ver'
  ])
) AS v(nombre, permisos)
WHERE r.nombre = v.nombre;

-- ---------------------------------------------------------------- usuarios
-- Un usuario por rol. La contraseña de los cuatro es  Semilla.12345  (13 caracteres: la
-- política exige 12 mínimo). El hash es bcrypt costo 12, el mismo que usa la app.
--
-- Esta contraseña es PÚBLICA: está en el repo. Por eso el seed solo corre en entornos de
-- prueba efímeros, y por eso la guarda de arriba existe.
INSERT INTO public.gu_usuario (nombre, email, password_hash, rol_id, estado)
SELECT v.nombre, v.email, '$2b$12$X1Kh/UuZ.373wRLtQZRO6eTWNPLA7m7wNBR85BJ6jfpCMdkZnYsKC', r.id, 'activo'
FROM (VALUES
  ('Admin de prueba',      'admin@prueba.test',      'admin'),
  ('Supervisor de prueba', 'supervisor@prueba.test', 'supervisor'),
  ('Usuario de prueba',    'usuario@prueba.test',    'usuario'),
  ('Readonly de prueba',   'readonly@prueba.test',   'readonly')
) AS v(nombre, email, rol)
JOIN public.gu_roles r ON r.nombre = v.rol
ON CONFLICT (email) DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      rol_id = EXCLUDED.rol_id,
      estado = 'activo';

-- ---------------------------------------------------------------- proyectos
INSERT INTO public.gu_proyectos (nombre, codigo, descripcion, fecha_inicio) VALUES
  ('Obra Norte', 'PROY-N', 'Proyecto de prueba del circuito completo', '2026-01-02'),
  ('Obra Sur',   'PROY-S', 'Proyecto de prueba sin movimientos',       '2026-03-01')
ON CONFLICT (codigo) DO NOTHING;

-- ---------------------------------------------------------------- proveedores
INSERT INTO public.gu_proveedores (nombre, cuit, email, telefono, direccion, estado)
SELECT v.nombre, v.cuit, v.email, v.telefono, v.direccion, v.estado
FROM (VALUES
  ('Hormigonera Sur SA',   '30-11111111-1', 'ventas@hormigonera.test', '341 555-0001', 'Ruta 9 km 12',  'activo'),
  ('Aceros del Litoral',   '30-22222222-2', 'ventas@aceros.test',      '341 555-0002', 'Parque Ind. 4', 'activo'),
  ('Suministros Inactivo', '30-33333333-3', 'ventas@inactivo.test',    '341 555-0003', 'Calle Falsa 1', 'inactivo')
) AS v(nombre, cuit, email, telefono, direccion, estado)
WHERE NOT EXISTS (SELECT 1 FROM public.gu_proveedores p WHERE p.cuit = v.cuit);

-- ---------------------------------------------------------------- items
INSERT INTO public.gu_items (codigo, nombre, descripcion, unidad_medida, categoria, is_active) VALUES
  ('SEM-0001', 'Cemento portland', 'Bolsa de 50 kg',       'bolsas', 'Materiales', true),
  ('SEM-0002', 'Hierro del 8',     'Barra de 12 m',        'barras', 'Materiales', true),
  ('SEM-0003', 'Hora de máquina',  'Retroexcavadora',      'horas',  'Servicios',  true),
  ('SEM-0004', 'Item inactivo',    'Para probar el filtro','unidad', 'Materiales', false)
ON CONFLICT (codigo) DO NOTHING;

-- Precio por proveedor: sin esto, el alta de una línea sin precio explícito devuelve 422
-- ("el item no tiene precio cargado para este proveedor"), que es uno de los caminos que el
-- E2E recorre. La columna es `precio`, no `precio_unitario_neto` (esa es la de la línea de OC).
INSERT INTO public.gu_item_proveedor_precio (item_id, proveedor_id, precio)
SELECT i.id, p.id, v.precio
FROM (VALUES
  ('SEM-0001', '30-11111111-1', 9500.00),
  ('SEM-0002', '30-22222222-2', 48000.00),
  ('SEM-0003', '30-11111111-1', 75000.00)
) AS v(codigo, cuit, precio)
JOIN public.gu_items i ON i.codigo = v.codigo
JOIN public.gu_proveedores p ON p.cuit = v.cuit
ON CONFLICT (item_id, proveedor_id) DO UPDATE SET precio = EXCLUDED.precio;

-- ---------------------------------------------------------------- cajas
-- La OP reparte el pago entre cajas; fn_op_gate exige Σcajas = Σfacturas al mandar a aprobar.
INSERT INTO public.gu_cajas (nombre, tipo, moneda, is_active)
SELECT v.nombre, v.tipo::public.caja_tipo, v.moneda::public.moneda_enum, true
FROM (VALUES
  ('Banco Nación cta. cte.', 'banco',         'ARS'),
  ('Caja chica obra',        'efectivo',      'ARS'),
  ('Transferencias USD',     'transferencia', 'USD')
) AS v(nombre, tipo, moneda)
WHERE NOT EXISTS (SELECT 1 FROM public.gu_cajas c WHERE c.nombre = v.nombre);
