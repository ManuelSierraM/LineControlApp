ALTER TABLE public.pops ADD COLUMN IF NOT EXISTS fecha_alta date;
ALTER TABLE public.pops ADD COLUMN IF NOT EXISTS fecha_baja date;
ALTER TABLE public.pops ADD COLUMN IF NOT EXISTS modelo text;
ALTER TABLE public.pops DROP COLUMN IF EXISTS responsable;