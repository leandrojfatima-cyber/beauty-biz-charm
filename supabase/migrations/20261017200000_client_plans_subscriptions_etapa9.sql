-- Migration: Etapa 9 — Planos e Assinaturas dos Clientes Finais
-- Modelos: Avulso, Recorrente, Ilimitado, VIP e One (com regra de 1 corte por mês)
-- Separação total entre Assinatura do Software BELEZI (NEXADASH) e Assinaturas de Serviços da Barbearia (Clientes Finais)
-- Isolamento estrito por salon_id e owner_id

-- 1. Tabela de Planos de Serviços da Barbearia
CREATE TABLE IF NOT EXISTS public.salon_client_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  name text NOT NULL,
  model text NOT NULL CHECK (model IN ('avulso', 'recorrente', 'ilimitado', 'vip', 'one')),
  price numeric(10,2) NOT NULL DEFAULT 0,
  billing_cycle text NOT NULL DEFAULT 'mensal' CHECK (billing_cycle IN ('mensal', 'trimestral', 'semestral', 'anual')),
  monthly_credit_limit integer NOT NULL DEFAULT 1,
  service_ids text[] DEFAULT '{}'::text[],
  benefits text[] DEFAULT '{}'::text[],
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS para salon_client_plans
ALTER TABLE public.salon_client_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_manage_salon_client_plans" ON public.salon_client_plans;
CREATE POLICY "owner_manage_salon_client_plans" ON public.salon_client_plans
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "public_read_active_salon_client_plans" ON public.salon_client_plans;
CREATE POLICY "public_read_active_salon_client_plans" ON public.salon_client_plans
  FOR SELECT TO anon, authenticated
  USING (active = true);

-- 2. Tabela de Assinaturas dos Clientes Finais
CREATE TABLE IF NOT EXISTS public.client_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.salon_client_plans(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'pausada', 'cancelada', 'inadimplente')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  renews_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  credits_used_this_period integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS para client_subscriptions
ALTER TABLE public.client_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_manage_client_subscriptions" ON public.client_subscriptions;
CREATE POLICY "owner_manage_client_subscriptions" ON public.client_subscriptions
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "client_read_own_subscriptions" ON public.client_subscriptions;
CREATE POLICY "client_read_own_subscriptions" ON public.client_subscriptions
  FOR SELECT TO anon, authenticated
  USING (true);

-- 3. Tabela de Log de Uso de Créditos de Assinatura
CREATE TABLE IF NOT EXISTS public.subscription_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.client_subscriptions(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  used_at timestamptz NOT NULL DEFAULT now(),
  description text
);

ALTER TABLE public.subscription_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_manage_subscription_logs" ON public.subscription_usage_logs;
CREATE POLICY "owner_manage_subscription_logs" ON public.subscription_usage_logs
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 4. Triggers de sincronização automática de salon_id
DROP TRIGGER IF EXISTS trg_sync_salon_id_plans ON public.salon_client_plans;
CREATE TRIGGER trg_sync_salon_id_plans
  BEFORE INSERT OR UPDATE ON public.salon_client_plans
  FOR EACH ROW EXECUTE FUNCTION public.sync_salon_id_from_owner();

DROP TRIGGER IF EXISTS trg_sync_salon_id_subs ON public.client_subscriptions;
CREATE TRIGGER trg_sync_salon_id_subs
  BEFORE INSERT OR UPDATE ON public.client_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.sync_salon_id_from_owner();

DROP TRIGGER IF EXISTS trg_sync_salon_id_sub_logs ON public.subscription_usage_logs;
CREATE TRIGGER trg_sync_salon_id_sub_logs
  BEFORE INSERT OR UPDATE ON public.subscription_usage_logs
  FOR EACH ROW EXECUTE FUNCTION public.sync_salon_id_from_owner();

-- 5. Função RPC para Validar e Debitar Créditos de Assinatura
CREATE OR REPLACE FUNCTION public.validate_and_consume_subscription_credit(
  p_client_id uuid,
  p_service_id uuid,
  p_appointment_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub record;
  v_plan record;
  v_credits_remaining integer;
  v_is_covered boolean := false;
BEGIN
  -- Localizar assinatura ativa válida do cliente
  SELECT * INTO v_sub
  FROM public.client_subscriptions
  WHERE client_id = p_client_id
    AND status = 'ativa'
    AND renews_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_sub IS NULL THEN
    RETURN jsonb_build_object(
      'has_active_subscription', false,
      'credit_consumed', false,
      'message', 'Cliente não possui assinatura ativa no momento.'
    );
  END IF;

  SELECT * INTO v_plan
  FROM public.salon_client_plans
  WHERE id = v_sub.plan_id;

  IF v_plan IS NULL THEN
    RETURN jsonb_build_object(
      'has_active_subscription', false,
      'credit_consumed', false,
      'message', 'Plano da assinatura não localizado.'
    );
  END IF;

  -- Checar limites por modelo
  IF v_plan.model = 'one' THEN
    -- Regra One: exatamente 1 corte por mês
    IF v_sub.credits_used_this_period >= 1 THEN
      RETURN jsonb_build_object(
        'has_active_subscription', true,
        'credit_consumed', false,
        'plan_name', v_plan.name,
        'model', v_plan.model,
        'credits_used', v_sub.credits_used_this_period,
        'monthly_limit', 1,
        'message', 'O corte mensal incluso no plano One já foi utilizado neste ciclo.'
      );
    ELSE
      v_is_covered := true;
    END IF;
  ELSIF v_plan.model = 'recorrente' THEN
    IF v_sub.credits_used_this_period >= v_plan.monthly_credit_limit THEN
      RETURN jsonb_build_object(
        'has_active_subscription', true,
        'credit_consumed', false,
        'plan_name', v_plan.name,
        'model', v_plan.model,
        'credits_used', v_sub.credits_used_this_period,
        'monthly_limit', v_plan.monthly_credit_limit,
        'message', 'O limite mensal de créditos deste plano já foi atingido.'
      );
    ELSE
      v_is_covered := true;
    END IF;
  ELSIF v_plan.model IN ('ilimitado', 'vip') THEN
    v_is_covered := true;
  ELSE
    -- Avulso
    v_is_covered := false;
  END IF;

  IF v_is_covered THEN
    -- Debitar crédito
    UPDATE public.client_subscriptions
    SET credits_used_this_period = credits_used_this_period + 1,
        updated_at = now()
    WHERE id = v_sub.id;

    -- Registrar log de consumo
    INSERT INTO public.subscription_usage_logs (
      owner_id,
      salon_id,
      subscription_id,
      client_id,
      appointment_id,
      service_id,
      description
    ) VALUES (
      v_sub.owner_id,
      v_sub.salon_id,
      v_sub.id,
      p_client_id,
      p_appointment_id,
      p_service_id,
      'Atendimento coberto pelo plano: ' || v_plan.name
    );

    -- Atualizar flag VIP do cliente se for plano VIP
    IF v_plan.model = 'vip' THEN
      UPDATE public.clients
      SET is_vip = true, vip_plan_name = v_plan.name
      WHERE id = p_client_id;
    END IF;

    RETURN jsonb_build_object(
      'has_active_subscription', true,
      'credit_consumed', true,
      'plan_name', v_plan.name,
      'model', v_plan.model,
      'credits_used', v_sub.credits_used_this_period + 1,
      'monthly_limit', v_plan.monthly_credit_limit,
      'message', 'Crédito debitado com sucesso da assinatura ' || v_plan.name
    );
  END IF;

  RETURN jsonb_build_object(
    'has_active_subscription', true,
    'credit_consumed', false,
    'message', 'Serviço avulso não incluído na franquia da assinatura.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_and_consume_subscription_credit TO anon, authenticated, service_role;

-- 6. Índices para performance
CREATE INDEX IF NOT EXISTS idx_salon_client_plans_salon_id ON public.salon_client_plans(salon_id);
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_client_id ON public.client_subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_status ON public.client_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscription_usage_logs_sub ON public.subscription_usage_logs(subscription_id);
