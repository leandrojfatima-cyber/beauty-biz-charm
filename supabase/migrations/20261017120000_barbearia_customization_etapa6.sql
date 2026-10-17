-- Migration: Etapa 6 — Cadastro e Personalização das Barbearias
-- Permite que a empresa compradora configure o seu próprio ambiente sem alterar código.
-- Garante isolamento estrito de dados por salon_id e owner_id.

-- 1. Ampliar a tabela salon_settings com Perfil, Identidade Visual, Políticas e Horários
ALTER TABLE public.salon_settings
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#0F172A',
  ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#D4AF37',
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS facebook text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS full_address text,
  ADD COLUMN IF NOT EXISTS scheduling_rules text DEFAULT 'Agendamentos com confirmação automática via WhatsApp.',
  ADD COLUMN IF NOT EXISTS min_advance_minutes integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS max_advance_days integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS cancellation_policy text DEFAULT 'Cancelamentos gratuitos até 2 horas antes do horário marcado.',
  ADD COLUMN IF NOT EXISTS late_tolerance_minutes integer DEFAULT 15,
  ADD COLUMN IF NOT EXISTS reminder_hours integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS photos jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS business_hours jsonb DEFAULT '{
    "monday": {"open": "09:00", "close": "20:00", "closed": false},
    "tuesday": {"open": "09:00", "close": "20:00", "closed": false},
    "wednesday": {"open": "09:00", "close": "20:00", "closed": false},
    "thursday": {"open": "09:00", "close": "20:00", "closed": false},
    "friday": {"open": "09:00", "close": "20:00", "closed": false},
    "saturday": {"open": "08:00", "close": "19:00", "closed": false},
    "sunday": {"open": "09:00", "close": "14:00", "closed": true}
  }'::jsonb;

-- 2. Tabela de Galeria de Fotos do Espaço (com isolamento estrito)
CREATE TABLE IF NOT EXISTS public.salon_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text,
  caption text,
  category text DEFAULT 'ambiente' CHECK (category IN ('ambiente', 'fachada', 'lounge', 'estacoes', 'detalhes')),
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS para salon_photos
ALTER TABLE public.salon_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_manage_salon_photos" ON public.salon_photos;
CREATE POLICY "owner_manage_salon_photos" ON public.salon_photos
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

GRANT ALL ON public.salon_photos TO authenticated;
GRANT ALL ON public.salon_photos TO service_role;

-- 3. Ampliar a tabela professionals com dados visuais, especialidades e escala
ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS specialties text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS working_hours text DEFAULT 'Segunda a Sábado, 09h às 19h',
  ADD COLUMN IF NOT EXISTS schedule_details jsonb DEFAULT '{
    "monday": {"start": "09:00", "end": "19:00", "active": true},
    "tuesday": {"start": "09:00", "end": "19:00", "active": true},
    "wednesday": {"start": "09:00", "end": "19:00", "active": true},
    "thursday": {"start": "09:00", "end": "19:00", "active": true},
    "friday": {"start": "09:00", "end": "19:00", "active": true},
    "saturday": {"start": "08:00", "end": "18:00", "active": true},
    "sunday": {"start": "09:00", "end": "13:00", "active": false}
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS instagram text;

-- 4. Ampliar a tabela services com descrição detalhada, foto e destaque
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS highlight boolean NOT NULL DEFAULT false;

-- 5. Função para sincronizar salon_id automaticamente nas tabelas filhas a partir do owner_id
CREATE OR REPLACE FUNCTION public.sync_salon_id_from_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sid uuid;
BEGIN
  IF NEW.salon_id IS NULL THEN
    SELECT id INTO sid FROM public.salon_settings WHERE owner_id = NEW.owner_id LIMIT 1;
    IF sid IS NOT NULL THEN
      NEW.salon_id := sid;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Triggers de preenchimento automático de salon_id
DROP TRIGGER IF EXISTS trg_sync_salon_id_professionals ON public.professionals;
CREATE TRIGGER trg_sync_salon_id_professionals
  BEFORE INSERT OR UPDATE ON public.professionals
  FOR EACH ROW EXECUTE FUNCTION public.sync_salon_id_from_owner();

DROP TRIGGER IF EXISTS trg_sync_salon_id_services ON public.services;
CREATE TRIGGER trg_sync_salon_id_services
  BEFORE INSERT OR UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.sync_salon_id_from_owner();

DROP TRIGGER IF EXISTS trg_sync_salon_id_photos ON public.salon_photos;
CREATE TRIGGER trg_sync_salon_id_photos
  BEFORE INSERT OR UPDATE ON public.salon_photos
  FOR EACH ROW EXECUTE FUNCTION public.sync_salon_id_from_owner();

-- 6. Garantir índices para alta performance de isolamento por salon_id
CREATE INDEX IF NOT EXISTS idx_professionals_salon_id ON public.professionals(salon_id);
CREATE INDEX IF NOT EXISTS idx_services_salon_id ON public.services(salon_id);
CREATE INDEX IF NOT EXISTS idx_salon_photos_salon_id ON public.salon_photos(salon_id);
