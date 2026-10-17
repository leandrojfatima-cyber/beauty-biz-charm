-- Migration: Etapa 11 — Automações e WhatsApp
-- Motor de automação de relacionamento para barbearias:
-- Lembretes de agendamento, mensagens de cobrança de planos, alertas de aniversário,
-- recuperação de clientes inativos, lembretes de recompra de produtos, gestão de faltas e penalizações,
-- e histórico de disparos via WhatsApp com isolamento estrito por salon_id e owner_id.

-- 1. Ampliar a tabela clients com data de nascimento, controle de faltas e bloqueio
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS no_shows_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_blocked_booking boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS block_reason text,
  ADD COLUMN IF NOT EXISTS last_service_date date,
  ADD COLUMN IF NOT EXISTS last_product_purchase_date date;

-- 2. Tabela de Configurações de Regras e Automação da Barbearia
CREATE TABLE IF NOT EXISTS public.salon_automation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  
  -- Lembretes de agendamento
  reminder_enabled boolean NOT NULL DEFAULT true,
  reminder_hours_before integer NOT NULL DEFAULT 2,
  
  -- Aniversários
  birthday_enabled boolean NOT NULL DEFAULT true,
  birthday_coupon_text text DEFAULT 'Ganhe 15% de desconto no seu corte neste mês de aniversário!',
  
  -- Recuperação de Clientes Inativos
  inactive_clients_days integer NOT NULL DEFAULT 35,
  inactive_coupon_text text DEFAULT 'Estamos com saudades! Agende seu horário nesta semana e ganhe um café especial ou cerveja por nossa conta.',
  
  -- Recompra de Produtos
  product_reorder_enabled boolean NOT NULL DEFAULT true,
  product_reorder_days integer NOT NULL DEFAULT 40,
  product_reorder_message text DEFAULT 'Notamos que já faz um tempinho desde a sua última pomada/óleo de barba. Que tal garantir a reposição do seu produto favorito?',
  
  -- Cobrança e Vencimento de Planos
  subscription_notice_enabled boolean NOT NULL DEFAULT true,
  subscription_notice_days_before integer NOT NULL DEFAULT 3,
  
  -- Gestão de Faltas, No-Shows e Penalidades
  no_show_tolerance_minutes integer NOT NULL DEFAULT 15,
  max_no_shows_before_block integer NOT NULL DEFAULT 2,
  no_show_fee numeric(10,2) NOT NULL DEFAULT 0,
  require_advance_payment_blocked boolean NOT NULL DEFAULT true,
  
  -- Templates Personalizados de Mensagens WhatsApp
  custom_templates jsonb NOT NULL DEFAULT '{
    "lembrete": "Olá, {{cliente}}! ⏰ Passando para lembrar do seu horário hoje na {{barbearia}} às {{horario}} com {{barbeiro}}. Podemos confirmar?",
    "confirmacao": "Olá, {{cliente}}! 💈 Seu agendamento na {{barbearia}} está confirmado para {{data}} às {{horario}} com {{barbeiro}}. Te esperamos!",
    "aniversario": "Fala {{cliente}}, parabéns pelo seu dia! 🎉 A equipe da {{barbearia}} deseja muito sucesso. Como presente: {{cupom}}",
    "recuperacao": "Fala {{cliente}}, tudo bem? Faz tempo que você não cuida do visual aqui na {{barbearia}}! ✂️ {{cupom}} Vamos agendar?",
    "cobranca_plano": "Olá, {{cliente}}! Seu plano {{plano}} na {{barbearia}} vence em {{vencimento}}. Valor: R$ {{valor}}. Chave PIX: {{pix}}. Qualquer dúvida estamos à disposição!",
    "recompra_produto": "Fala {{cliente}}! Seu produto {{produto}} já deve estar no finalzinho. 🧴 Passa aqui na {{barbearia}} para repor ou peça pelo WhatsApp!",
    "falta_aviso": "Olá, {{cliente}}. Notamos que você não pôde comparecer ao agendamento de {{data}} na {{barbearia}}. Para reagendar sem pendências, entre em contato conosco."
  }'::jsonb,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_salon_automation_settings_owner UNIQUE (owner_id)
);

-- RLS para salon_automation_settings
ALTER TABLE public.salon_automation_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_manage_salon_automation_settings" ON public.salon_automation_settings;
CREATE POLICY "owner_manage_salon_automation_settings" ON public.salon_automation_settings
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "public_read_salon_automation_settings" ON public.salon_automation_settings;
CREATE POLICY "public_read_salon_automation_settings" ON public.salon_automation_settings
  FOR SELECT TO anon, authenticated
  USING (true);

-- 3. Tabela de Histórico de Mensagens e Disparos de Automação
CREATE TABLE IF NOT EXISTS public.automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN (
    'lembrete_agendamento',
    'confirmacao',
    'aniversario',
    'cobranca_plano',
    'recuperacao_inativo',
    'recompra_produto',
    'aviso_falta'
  )),
  channel text NOT NULL DEFAULT 'whatsapp',
  phone text,
  recipient_name text,
  message_body text NOT NULL,
  status text NOT NULL DEFAULT 'enviado' CHECK (status IN ('pendente', 'enviado', 'falha')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS para automation_logs
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_manage_automation_logs" ON public.automation_logs;
CREATE POLICY "owner_manage_automation_logs" ON public.automation_logs
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 4. Triggers automáticos para salon_id
CREATE OR REPLACE FUNCTION public.sync_automation_salon_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.salon_id IS NULL AND NEW.owner_id IS NOT NULL THEN
    SELECT id INTO NEW.salon_id
    FROM public.salon_settings
    WHERE owner_id = NEW.owner_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_automation_settings_salon ON public.salon_automation_settings;
CREATE TRIGGER trg_sync_automation_settings_salon
  BEFORE INSERT OR UPDATE ON public.salon_automation_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_automation_salon_id();

DROP TRIGGER IF EXISTS trg_sync_automation_logs_salon ON public.automation_logs;
CREATE TRIGGER trg_sync_automation_logs_salon
  BEFORE INSERT OR UPDATE ON public.automation_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_automation_salon_id();

-- 5. Função RPC para registrar falta de cliente e aplicar penalidade
CREATE OR REPLACE FUNCTION public.register_client_no_show(
  _client_id uuid,
  _appointment_id uuid,
  _reason text DEFAULT 'Não compareceu ao horário sem aviso prévio'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner_id uuid;
  v_salon_id uuid;
  v_client record;
  v_max_no_shows integer;
  v_new_count integer;
  v_is_blocked boolean;
BEGIN
  v_owner_id := auth.uid();
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_client
  FROM public.clients
  WHERE id = _client_id AND owner_id = v_owner_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;

  -- Buscar limite configurado de faltas
  SELECT coalesce(max_no_shows_before_block, 2), id INTO v_max_no_shows, v_salon_id
  FROM public.salon_automation_settings
  WHERE owner_id = v_owner_id;

  IF v_max_no_shows IS NULL THEN
    v_max_no_shows := 2;
  END IF;

  v_new_count := coalesce(v_client.no_shows_count, 0) + 1;
  v_is_blocked := (v_new_count >= v_max_no_shows);

  UPDATE public.clients
  SET no_shows_count = v_new_count,
      is_blocked_booking = v_is_blocked,
      block_reason = CASE WHEN v_is_blocked THEN 'Bloqueado por excesso de faltas (' || v_new_count || ' faltas acumuladas)' ELSE block_reason END
  WHERE id = _client_id;

  IF _appointment_id IS NOT NULL THEN
    UPDATE public.appointments
    SET status = 'cancelado',
        notes = coalesce(notes, '') || ' [FALTA/NO-SHOW REGISTRADO: ' || _reason || ']'
    WHERE id = _appointment_id AND owner_id = v_owner_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'new_no_shows_count', v_new_count,
    'is_blocked', v_is_blocked,
    'client_name', v_client.name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_client_no_show TO authenticated;
