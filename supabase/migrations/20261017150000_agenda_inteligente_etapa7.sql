-- Migration: Etapa 7 — Agenda Inteligente
-- Controle completo de horários, regras de expediente, prevenção de conflitos e suporte a regras VIP
-- Isolamento estrito de dados por salon_id e owner_id

-- 1. Ampliar a tabela appointments com salon_id, regras VIP e bloqueios
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vip_simultaneous_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS block_reason text;

-- 2. Ampliar a tabela clients com marcação VIP e plano VIP
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vip_plan_name text;

-- 3. Trigger para sincronizar salon_id em appointments e clients a partir do owner_id
DROP TRIGGER IF EXISTS trg_sync_salon_id_appointments ON public.appointments;
CREATE TRIGGER trg_sync_salon_id_appointments
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.sync_salon_id_from_owner();

DROP TRIGGER IF EXISTS trg_sync_salon_id_clients ON public.clients;
CREATE TRIGGER trg_sync_salon_id_clients
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.sync_salon_id_from_owner();

-- 4. Índices para performance e prevenção de conflitos
CREATE INDEX IF NOT EXISTS idx_appointments_salon_id ON public.appointments(salon_id);
CREATE INDEX IF NOT EXISTS idx_appointments_pro_range ON public.appointments(professional_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_clients_salon_id ON public.clients(salon_id);

-- 5. Atualizar agendamentos existentes com salon_id
UPDATE public.appointments a
SET salon_id = s.id
FROM public.salon_settings s
WHERE a.owner_id = s.owner_id AND a.salon_id IS NULL;

UPDATE public.clients c
SET salon_id = s.id
FROM public.salon_settings s
WHERE c.owner_id = s.owner_id AND c.salon_id IS NULL;
