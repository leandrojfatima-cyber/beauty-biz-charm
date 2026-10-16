-- Migration: Etapa 5 — Liberação Manual de Acesso e Ciclo de Ativação NEXADASH
-- Garante que:
-- 1. Toda nova conta de barbearia inicia com status 'aguardando_liberacao'.
-- 2. Nenhum pagamento online ou interessado libera sozinho o sistema.
-- 3. A ativação depende exclusivamente de autorização manual por um administrador NEXADASH.
-- 4. Nenhum vencimento provoca suspensão automática; suspensão é deliberação manual.

-- 1. Adicionar colunas de controle de ativação e vigência em salon_settings
ALTER TABLE public.salon_settings
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aguardando_liberacao'
    CHECK (status IN ('aguardando_liberacao', 'ativa', 'suspensa_manual', 'cancelada')),
  ADD COLUMN IF NOT EXISTS plan_name text NOT NULL DEFAULT 'NEXADASH PRO',
  ADD COLUMN IF NOT EXISTS contract_valid_until date,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS activated_by text,
  ADD COLUMN IF NOT EXISTS activation_notes text,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_by text,
  ADD COLUMN IF NOT EXISTS suspension_reason text;

-- 2. Criar tabela de auditoria e ciclo de ativações manuais
CREATE TABLE IF NOT EXISTS public.nexadash_account_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.nexadash_customers(id) ON DELETE SET NULL,
  salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.nexadash_subscriptions(id) ON DELETE SET NULL,
  company_name text NOT NULL,
  owner_email text NOT NULL,
  phone text,
  city text,
  plan_name text NOT NULL DEFAULT 'NEXADASH PRO',
  contracted_value numeric(10,2) NOT NULL DEFAULT 59.90,
  billing_cycle text NOT NULL DEFAULT 'mensal',
  valid_until date NOT NULL,
  
  -- Ciclo de Ativação: 8 Etapas
  -- Passo 2: Conferência das Condições Acordadas
  conditions_verified boolean NOT NULL DEFAULT false,
  conditions_verified_at timestamptz,
  conditions_notes text,
  
  -- Passo 3: Situação do Pagamento Conforme o Contrato
  payment_status text NOT NULL DEFAULT 'pendente' 
    CHECK (payment_status IN ('pendente', 'em_analise', 'pago_confirmado', 'isento_cortesia')),
  payment_method text,
  payment_reference text,
  payment_confirmed_at timestamptz,
  
  -- Passo 4: Preparação da Conta da Barbearia
  account_prepared boolean NOT NULL DEFAULT false,
  account_prepared_at timestamptz,
  account_preparation_notes text,
  
  -- Passo 5 & 6: Liberação Manual pelo Administrador NEXADASH
  activation_status text NOT NULL DEFAULT 'pendente_liberacao_manual'
    CHECK (activation_status IN ('pendente_liberacao_manual', 'autorizado_ativo', 'suspenso_manual', 'recusado')),
  authorized_by_admin text,
  authorized_at timestamptz,
  deliberation_notes text,
  
  -- Passo 7 & 8: Decisão Manual de Suspensão / Reativação
  suspension_reason text,
  suspended_by_admin text,
  suspended_at timestamptz,
  reactivated_at timestamptz,
  reactivated_by_admin text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Habilitar RLS e Permissões
ALTER TABLE public.nexadash_account_activations ENABLE ROW LEVEL SECURITY;

-- Master NEXADASH tem controle total de auditoria, aprovação e deliberação
DROP POLICY IF EXISTS "master_manage_activations" ON public.nexadash_account_activations;
CREATE POLICY "master_manage_activations" ON public.nexadash_account_activations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'))
  WITH CHECK (public.has_role(auth.uid(), 'master'));

-- Barbearia pode consultar apenas seu próprio status de ativação
DROP POLICY IF EXISTS "salon_view_own_activation" ON public.nexadash_account_activations;
CREATE POLICY "salon_view_own_activation" ON public.nexadash_account_activations
  FOR SELECT TO authenticated
  USING (
    owner_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR salon_id IN (SELECT id FROM public.salon_settings WHERE owner_id = auth.uid())
  );

-- 4. Função auxiliar para registrar a ativação manual com assinatura do administrador
CREATE OR REPLACE FUNCTION public.manual_authorize_salon_activation(
  _activation_id uuid,
  _admin_email text,
  _notes text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rec record;
BEGIN
  -- Apenas Master pode executar
  IF NOT public.has_role(auth.uid(), 'master') THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores autorizados da NEXADASH podem liberar acessos.';
  END IF;

  SELECT * INTO _rec FROM public.nexadash_account_activations WHERE id = _activation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro de ativação não encontrado.';
  END IF;

  -- Atualizar status da ativação
  UPDATE public.nexadash_account_activations
  SET 
    activation_status = 'autorizado_ativo',
    authorized_by_admin = _admin_email,
    authorized_at = now(),
    deliberation_notes = _notes,
    updated_at = now()
  WHERE id = _activation_id;

  -- Se houver salão vinculado, atualizar para 'ativa'
  IF _rec.salon_id IS NOT NULL THEN
    UPDATE public.salon_settings
    SET 
      status = 'ativa',
      plan_name = _rec.plan_name,
      contract_valid_until = _rec.valid_until,
      activated_at = now(),
      activated_by = _admin_email,
      activation_notes = _notes,
      updated_at = now()
    WHERE id = _rec.salon_id;
  END IF;

  -- Registrar no log de auditoria oficial
  INSERT INTO public.audit_logs (user_id, email, action, details)
  VALUES (
    auth.uid(),
    _admin_email,
    'NEXADASH Liberação Manual: Acesso autorizado',
    format('Empresa: %s | Plano: %s | Vigência: %s | Notas: %s', _rec.company_name, _rec.plan_name, _rec.valid_until, _notes)
  );

  RETURN true;
END;
$$;

-- 5. Função auxiliar para registrar suspensão manual (sem suspensão automática)
CREATE OR REPLACE FUNCTION public.manual_suspend_salon_access(
  _activation_id uuid,
  _admin_email text,
  _reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rec record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'master') THEN
    RAISE EXCEPTION 'Apenas administradores NEXADASH podem suspender acessos.';
  END IF;

  IF _reason IS NULL OR trim(_reason) = '' THEN
    RAISE EXCEPTION 'A justificativa de suspensão é obrigatória para fins de auditoria comercial.';
  END IF;

  SELECT * INTO _rec FROM public.nexadash_account_activations WHERE id = _activation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro de ativação não encontrado.';
  END IF;

  UPDATE public.nexadash_account_activations
  SET 
    activation_status = 'suspenso_manual',
    suspended_by_admin = _admin_email,
    suspended_at = now(),
    suspension_reason = _reason,
    updated_at = now()
  WHERE id = _activation_id;

  IF _rec.salon_id IS NOT NULL THEN
    UPDATE public.salon_settings
    SET 
      status = 'suspensa_manual',
      suspended_by = _admin_email,
      suspended_at = now(),
      suspension_reason = _reason,
      updated_at = now()
    WHERE id = _rec.salon_id;
  END IF;

  INSERT INTO public.audit_logs (user_id, email, action, details)
  VALUES (
    auth.uid(),
    _admin_email,
    'NEXADASH Suspensão Manual: Acesso bloqueado pela diretoria',
    format('Empresa: %s | Motivo: %s', _rec.company_name, _reason)
  );

  RETURN true;
END;
$$;
