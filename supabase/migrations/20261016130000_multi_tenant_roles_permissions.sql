-- Migration: Multi-Tenant Architecture & Roles Permissions
-- Extends roles to support NEXADASH Admin, Salon Admin, Barbeiro, and Cliente

-- 1. Expand app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'barbeiro';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cliente';

-- 2. Add salon_id to user_roles for multi-tenant role assignment
ALTER TABLE public.user_roles 
  ADD COLUMN IF NOT EXISTS salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE;

-- 3. Add user_id to professionals and clients to allow login by staff and customers
ALTER TABLE public.professionals 
  ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE public.clients 
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- 4. Helper security functions for role checking
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

-- 5. Multi-tenant RLS Isolation Verification
-- Ensure every tenant is strictly isolated by owner_id
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN ARRAY ARRAY['professionals','clients','services','products','appointments','orders','order_items','stock_movements','transactions','salon_settings'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    
    -- Owner policy: complete control over own salon
    EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation_owner" ON public.%I', t);
    EXECUTE format('CREATE POLICY "tenant_isolation_owner" ON public.%I FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())', t);
  END LOOP;
END $$;

-- 6. Grant read-only access for staff members (barbeiros) to their salon's catalog & schedule
DROP POLICY IF EXISTS "barbeiro_read_appointments" ON public.appointments;
CREATE POLICY "barbeiro_read_appointments" ON public.appointments FOR SELECT TO authenticated
USING (
  owner_id = auth.uid() 
  OR professional_id IN (
    SELECT id FROM public.professionals WHERE user_id = auth.uid() AND active = true
  )
);

DROP POLICY IF EXISTS "barbeiro_read_services" ON public.services;
CREATE POLICY "barbeiro_read_services" ON public.services FOR SELECT TO authenticated
USING (
  owner_id = auth.uid() 
  OR public.is_salon_member(owner_id)
);

DROP POLICY IF EXISTS "barbeiro_read_clients" ON public.clients;
CREATE POLICY "barbeiro_read_clients" ON public.clients FOR SELECT TO authenticated
USING (
  owner_id = auth.uid() 
  OR public.is_salon_member(owner_id)
);

-- 7. Audit log policies
DROP POLICY IF EXISTS "audit_logs_tenant_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_tenant_insert" ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
