-- Esquema base: lo que existía ANTES de que el repo empezara a versionar migraciones.
--
-- Las migraciones ccip_* arrancan dando por sentadas seis tablas (roles, usuarios,
-- proveedores, proyectos y las dos de auditoría), tres enums y la función fn_audit_log, que
-- se crearon a mano en julio y nunca entraron al repo. Sobre una base vacía, ccip_02 fallaba
-- en su primer ALTER TABLE. Por eso el job nocturno no podía armar su base de prueba.
--
-- Reconstruido leyendo el catálogo de producción (pg_attribute, pg_constraint, pg_indexes,
-- pg_proc), no de memoria. El timestamp la deja primera en el orden de aplicación.
--
-- TODO va con IF NOT EXISTS: contra producción, donde estos objetos ya existen, es un no-op.
-- No es para volver a correrla ahí, es para que no haga daño si alguien lo hace.

-- ---------------------------------------------------------------------------- enums
-- CREATE TYPE no acepta IF NOT EXISTS, de ahí el bloque.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                  WHERE n.nspname = 'public' AND t.typname = 'estado_activo_inactivo') THEN
    CREATE TYPE public.estado_activo_inactivo AS ENUM ('activo', 'inactivo');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                  WHERE n.nspname = 'public' AND t.typname = 'proyecto_estado') THEN
    CREATE TYPE public.proyecto_estado AS ENUM ('planificado', 'en_ejecucion', 'finalizado', 'cancelado');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                  WHERE n.nspname = 'public' AND t.typname = 'audit_accion') THEN
    CREATE TYPE public.audit_accion AS ENUM ('crear', 'actualizar', 'eliminar');
  END IF;
END $$;

-- ---------------------------------------------------------------------------- roles
-- `permisos` es el array de pares modulo:accion de la matriz RBAC. Ojo: `nombre` NO tiene
-- UNIQUE en producción, y el seed depende de eso (usa WHERE NOT EXISTS, no ON CONFLICT).
CREATE TABLE IF NOT EXISTS public.gu_roles (
  id          bigint GENERATED ALWAYS AS IDENTITY,
  nombre      character varying(50) NOT NULL,
  descripcion text,
  creado_en   timestamp with time zone DEFAULT now(),
  permisos    text[] NOT NULL DEFAULT '{}'::text[],
  CONSTRAINT gu_roles_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------- usuarios
-- updated_at lo mueve la app al cambiar la clave, y de ahí sale la invalidación de sesiones
-- viejas (ver docs/requisitos/autenticacion.md, AUTH-03). No hay trigger: es deliberado.
CREATE TABLE IF NOT EXISTS public.gu_usuario (
  id            bigint GENERATED ALWAYS AS IDENTITY,
  nombre        character varying(100) NOT NULL,
  email         character varying(150) NOT NULL,
  password_hash character varying(255) NOT NULL,
  rol_id        bigint NOT NULL,
  estado        public.estado_activo_inactivo DEFAULT 'activo'::public.estado_activo_inactivo,
  created_at    timestamp with time zone DEFAULT now(),
  updated_at    timestamp with time zone DEFAULT now(),
  CONSTRAINT gu_usuario_pkey PRIMARY KEY (id),
  CONSTRAINT gu_usuario_email_key UNIQUE (email),
  CONSTRAINT fk_gu_usuario_rol FOREIGN KEY (rol_id) REFERENCES public.gu_roles(id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_rol ON public.gu_usuario USING btree (rol_id);

-- ---------------------------------------------------------------------------- proveedores
-- Sin UNIQUE en cuit: hay proveedores cargados sin CUIT y el dato se repite entre borradores.
-- condicion_iva va al final porque se agregó después; el orden replica el de producción.
CREATE TABLE IF NOT EXISTS public.gu_proveedores (
  id            bigint GENERATED ALWAYS AS IDENTITY,
  nombre        character varying(150) NOT NULL,
  cuit          character varying(20),
  direccion     text,
  telefono      character varying(50),
  email         character varying(150),
  estado        public.estado_activo_inactivo DEFAULT 'activo'::public.estado_activo_inactivo,
  created_at    timestamp with time zone DEFAULT now(),
  condicion_iva character varying(50),
  CONSTRAINT gu_proveedores_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------- proyectos
CREATE TABLE IF NOT EXISTS public.gu_proyectos (
  id           bigint GENERATED ALWAYS AS IDENTITY,
  nombre       character varying(150) NOT NULL,
  codigo       character varying(50),
  descripcion  text,
  fecha_inicio date,
  fecha_fin    date,
  estado       public.proyecto_estado DEFAULT 'planificado'::public.proyecto_estado,
  created_at   timestamp with time zone DEFAULT now(),
  CONSTRAINT gu_proyectos_pkey PRIMARY KEY (id),
  CONSTRAINT gu_proyectos_codigo_key UNIQUE (codigo)
);

-- ---------------------------------------------------------------------------- auditoría
-- Dos tablas que conviven y NO son lo mismo:
--   gu_auditoria  → bitácora funcional, la escribe la app con el motivo del cambio.
--   gu_audit_log  → control de cambios automático, lo escribe fn_audit_log desde un trigger
--                   con el antes y el después en jsonb.
CREATE TABLE IF NOT EXISTS public.gu_auditoria (
  id            bigint GENERATED ALWAYS AS IDENTITY,
  tabla_origen  character varying(100) NOT NULL,
  registro_id   bigint NOT NULL,
  usuario_id    bigint NOT NULL,
  accion        character varying(50) NOT NULL,
  motivo_cambio text,
  fecha_cambio  timestamp with time zone DEFAULT now(),
  created_at    timestamp with time zone DEFAULT now(),
  CONSTRAINT gu_auditoria_pkey PRIMARY KEY (id),
  CONSTRAINT fk_aud_usuario FOREIGN KEY (usuario_id) REFERENCES public.gu_usuario(id)
);

CREATE INDEX IF NOT EXISTS idx_aud_usuario        ON public.gu_auditoria USING btree (usuario_id);
CREATE INDEX IF NOT EXISTS idx_fecha_aud          ON public.gu_auditoria USING btree (fecha_cambio);
CREATE INDEX IF NOT EXISTS idx_tabla_registro_aud ON public.gu_auditoria USING btree (tabla_origen, registro_id);

-- usuario_id es nullable acá y NOT NULL en gu_auditoria: el trigger corre en transacciones que
-- no siempre tienen app.audit_user_id seteado (una migración, un script), y perder el registro
-- entero por no saber quién lo hizo sería peor que guardarlo sin autor.
CREATE TABLE IF NOT EXISTS public.gu_audit_log (
  id               bigint GENERATED ALWAYS AS IDENTITY,
  tabla_afectada   character varying(50) NOT NULL,
  registro_id      bigint NOT NULL,
  usuario_id       bigint,
  accion           public.audit_accion NOT NULL,
  datos_anteriores jsonb,
  datos_nuevos     jsonb,
  ip_address       character varying(45),
  created_at       timestamp with time zone DEFAULT now(),
  CONSTRAINT gu_audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT fk_auditlog_usuario FOREIGN KEY (usuario_id) REFERENCES public.gu_usuario(id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_auditlog        ON public.gu_audit_log USING btree (usuario_id);
CREATE INDEX IF NOT EXISTS idx_fecha_auditlog          ON public.gu_audit_log USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_tabla_registro_auditlog ON public.gu_audit_log USING btree (tabla_afectada, registro_id);

-- ---------------------------------------------------------------------------- fn_audit_log
-- La usan los triggers trg_audit_* que crea ccip_04 sobre las cuatro tablas del circuito.
-- El autor sale de app.audit_user_id, que setea la app por transacción; si no está, queda NULL.
CREATE OR REPLACE FUNCTION public.fn_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_accion public.audit_accion;
  v_registro_id BIGINT;
  v_datos_ant JSONB;
  v_datos_nue JSONB;
  v_usuario_id BIGINT;
BEGIN
  BEGIN
    v_usuario_id := NULLIF(current_setting('app.audit_user_id', true), '')::BIGINT;
  EXCEPTION WHEN others THEN
    v_usuario_id := NULL;
  END;

  IF (TG_OP = 'INSERT') THEN
    v_accion := 'crear';       v_registro_id := NEW.id;
    v_datos_ant := NULL;       v_datos_nue := to_jsonb(NEW);
  ELSIF (TG_OP = 'UPDATE') THEN
    v_accion := 'actualizar';  v_registro_id := NEW.id;
    v_datos_ant := to_jsonb(OLD); v_datos_nue := to_jsonb(NEW);
  ELSE
    v_accion := 'eliminar';    v_registro_id := OLD.id;
    v_datos_ant := to_jsonb(OLD); v_datos_nue := NULL;
  END IF;

  INSERT INTO public.gu_audit_log
    (tabla_afectada, registro_id, usuario_id, accion, datos_anteriores, datos_nuevos)
  VALUES
    (TG_TABLE_NAME, v_registro_id, v_usuario_id, v_accion, v_datos_ant, v_datos_nue);

  IF (TG_OP = 'DELETE') THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------- RLS
-- RLS activo y CERO políticas, igual que en producción: nadie entra por PostgREST. La app
-- usa la service key, que lo saltea. Si algún día se expone la base a `authenticated`, acá
-- es donde van las políticas, y hay que replicar la regla de dueño de OC-01 a mano.
ALTER TABLE public.gu_roles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gu_usuario     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gu_proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gu_proyectos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gu_auditoria   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gu_audit_log   ENABLE ROW LEVEL SECURITY;
