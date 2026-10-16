ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'barbeiro';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cliente';

ALTER TABLE public.user_roles 
  ADD COLUMN IF NOT EXISTS salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE;

ALTER TABLE public.professionals 
  ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE public.clients 
  ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE OR REPLACE FUNCTION public.is_master()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'master');
$$;

CREATE OR REPLACE FUNCTION public.is_salon_owner(_owner_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _owner_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_salon_member(_owner_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.professionals p
      WHERE p.owner_id = _owner_id AND p.user_id = auth.uid() AND p.active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.salon_settings s ON s.id = ur.salon_id
      WHERE s.owner_id = _owner_id AND ur.user_id = auth.uid()
    );
$$;
