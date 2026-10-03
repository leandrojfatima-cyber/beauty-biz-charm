CREATE TABLE public.salon_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() UNIQUE,
  name text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  maps_link text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salon_settings TO authenticated;
GRANT ALL ON public.salon_settings TO service_role;
ALTER TABLE public.salon_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner select salon_settings" ON public.salon_settings FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "owner insert salon_settings" ON public.salon_settings FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner update salon_settings" ON public.salon_settings FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner delete salon_settings" ON public.salon_settings FOR DELETE TO authenticated USING (owner_id = auth.uid());