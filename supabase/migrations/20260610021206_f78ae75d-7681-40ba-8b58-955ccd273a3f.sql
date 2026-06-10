
-- 1. Enum de roles
CREATE TYPE public.app_role AS ENUM ('admin', 'supervisor', 'operador');

-- 2. Tabla user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Función has_role (security definer, evita recursión)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. Políticas sobre user_roles
-- Cada usuario ve sus propios roles
CREATE POLICY "users see own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Solo admin puede insertar/actualizar/eliminar roles
CREATE POLICY "admin manage roles insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin manage roles update" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin manage roles delete" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Trigger: asignar 'operador' por defecto a cada nuevo usuario
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'operador')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_assign_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.assign_default_role();

-- 6. Asignar rol 'admin' al primer usuario existente (si hay alguno) y 'operador' al resto
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'operador' FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

-- Si no existe ningún admin, promover al usuario más antiguo
DO $$
DECLARE
  first_user UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    SELECT id INTO first_user FROM auth.users ORDER BY created_at ASC LIMIT 1;
    IF first_user IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (first_user, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;
END $$;

-- 7. Actualizar políticas RLS en las tablas de datos
-- LINEAS
DROP POLICY IF EXISTS "lineas owner all" ON public.lineas;
CREATE POLICY "lineas select" ON public.lineas FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "lineas insert" ON public.lineas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lineas update" ON public.lineas FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "lineas delete" ON public.lineas FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- DISPOSITIVOS
DROP POLICY IF EXISTS "disp owner all" ON public.dispositivos;
CREATE POLICY "disp select" ON public.dispositivos FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "disp insert" ON public.dispositivos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "disp update" ON public.dispositivos FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "disp delete" ON public.dispositivos FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- POPS
DROP POLICY IF EXISTS "pops owner all" ON public.pops;
CREATE POLICY "pops select" ON public.pops FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "pops insert" ON public.pops FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pops update" ON public.pops FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "pops delete" ON public.pops FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ALERTAS
DROP POLICY IF EXISTS "alertas owner all" ON public.alertas;
CREATE POLICY "alertas select" ON public.alertas FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "alertas insert" ON public.alertas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "alertas update" ON public.alertas FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "alertas delete" ON public.alertas FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ARCHIVOS_CARGA
DROP POLICY IF EXISTS "arch owner all" ON public.archivos_carga;
CREATE POLICY "arch select" ON public.archivos_carga FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "arch insert" ON public.archivos_carga FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "arch update" ON public.archivos_carga FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "arch delete" ON public.archivos_carga FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- CENTROS_COSTO
DROP POLICY IF EXISTS "cc owner all" ON public.centros_costo;
CREATE POLICY "cc select" ON public.centros_costo FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "cc insert" ON public.centros_costo FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cc update" ON public.centros_costo FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "cc delete" ON public.centros_costo FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 8. Permitir a admin ver perfiles de otros usuarios (para asignar roles)
CREATE POLICY "admin see all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));
