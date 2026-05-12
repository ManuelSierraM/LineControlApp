
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Centros de costo
CREATE TABLE public.centros_costo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, codigo)
);
ALTER TABLE public.centros_costo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cc owner all" ON public.centros_costo FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Líneas
CREATE TABLE public.lineas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  msisdn TEXT NOT NULL,
  imei TEXT,
  plan TEXT,
  costo_mensual NUMERIC(12,2) DEFAULT 0,
  centro_costo TEXT,
  estado TEXT DEFAULT 'activa',
  ultimo_uso DATE,
  consumo_mb NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lineas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lineas owner all" ON public.lineas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_lineas_user ON public.lineas(user_id);
CREATE INDEX idx_lineas_imei ON public.lineas(imei);

-- Dispositivos UEM
CREATE TABLE public.dispositivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  imei TEXT NOT NULL,
  modelo TEXT,
  fabricante TEXT,
  so TEXT,
  estado TEXT DEFAULT 'enrolado',
  ultimo_checkin DATE,
  asignado_a TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dispositivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disp owner all" ON public.dispositivos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_disp_user ON public.dispositivos(user_id);
CREATE INDEX idx_disp_imei ON public.dispositivos(imei);

-- POPS
CREATE TABLE public.pops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  ubicacion TEXT,
  centro_costo TEXT,
  estado TEXT DEFAULT 'activo',
  responsable TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pops owner all" ON public.pops FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Alertas
CREATE TABLE public.alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  severidad TEXT NOT NULL DEFAULT 'media',
  entidad TEXT,
  referencia TEXT,
  mensaje TEXT NOT NULL,
  detalle TEXT,
  resuelta BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alertas owner all" ON public.alertas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Archivos de carga
CREATE TABLE public.archivos_carga (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL,
  registros INT NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'completado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.archivos_carga ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arch owner all" ON public.archivos_carga FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
