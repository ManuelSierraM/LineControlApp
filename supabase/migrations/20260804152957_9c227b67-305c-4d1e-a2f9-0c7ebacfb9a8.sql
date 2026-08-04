DROP POLICY IF EXISTS "arch delete" ON public.archivos_carga;
CREATE POLICY "arch delete" ON public.archivos_carga
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));