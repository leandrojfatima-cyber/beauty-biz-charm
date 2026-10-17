-- Migration: Etapa 10 — Financeiro e Comissões
-- Módulo financeiro operacional completo: fluxo de caixa, previsto vs realizado,
-- taxas de maquininha, vales, adiantamentos, bonificações, comissões automáticas,
-- fechamentos periódicos e isolamento estrito por salon_id e owner_id.

-- 1. Ampliar a tabela transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'realizado' CHECK (status IN ('realizado', 'previsto', 'cancelado')),
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'dinheiro',
  ADD COLUMN IF NOT EXISTS card_fee numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'avulso',
  ADD COLUMN IF NOT EXISTS professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes text;

-- Atualizar net_amount para registros legados
UPDATE public.transactions
SET net_amount = amount
WHERE net_amount IS NULL;

-- 2. Tabela de Vales, Adiantamentos e Bonificações de Profissionais
CREATE TABLE IF NOT EXISTS public.professional_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('vale', 'adiantamento', 'bonificacao', 'ajuste')),
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'descontado', 'pago', 'cancelado')),
  description text NOT NULL,
  notes text,
  closing_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS para professional_advances
ALTER TABLE public.professional_advances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_manage_professional_advances" ON public.professional_advances;
CREATE POLICY "owner_manage_professional_advances" ON public.professional_advances
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 3. Tabela de Fechamentos Financeiros Periódicos (Prestação de Contas)
CREATE TABLE IF NOT EXISTS public.financial_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL,
  period_type text NOT NULL DEFAULT 'mensal' CHECK (period_type IN ('diario', 'semanal', 'quinzenal', 'mensal', 'personalizado')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  gross_sales numeric(10,2) NOT NULL DEFAULT 0,
  service_commissions numeric(10,2) NOT NULL DEFAULT 0,
  product_commissions numeric(10,2) NOT NULL DEFAULT 0,
  subscription_commissions numeric(10,2) NOT NULL DEFAULT 0,
  total_commissions numeric(10,2) NOT NULL DEFAULT 0,
  total_advances numeric(10,2) NOT NULL DEFAULT 0,
  total_bonuses numeric(10,2) NOT NULL DEFAULT 0,
  net_payable numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'fechado' CHECK (status IN ('rascunho', 'fechado', 'pago')),
  notes text,
  payment_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  closed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS para financial_closings
ALTER TABLE public.financial_closings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_manage_financial_closings" ON public.financial_closings;
CREATE POLICY "owner_manage_financial_closings" ON public.financial_closings
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 4. Triggers automáticos para preenchimento de salon_id
CREATE OR REPLACE FUNCTION public.sync_financial_salon_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.salon_id IS NULL AND NEW.owner_id IS NOT NULL THEN
    SELECT id INTO NEW.salon_id
    FROM public.salon_settings
    WHERE owner_id = NEW.owner_id
    LIMIT 1;
  END IF;

  IF NEW.net_amount IS NULL AND TG_TABLE_NAME = 'transactions' THEN
    NEW.net_amount := GREATEST(NEW.amount - COALESCE(NEW.card_fee, 0), 0);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_transactions_salon ON public.transactions;
CREATE TRIGGER trg_sync_transactions_salon
  BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_financial_salon_id();

DROP TRIGGER IF EXISTS trg_sync_advances_salon ON public.professional_advances;
CREATE TRIGGER trg_sync_advances_salon
  BEFORE INSERT OR UPDATE ON public.professional_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_financial_salon_id();

DROP TRIGGER IF EXISTS trg_sync_closings_salon ON public.financial_closings;
CREATE TRIGGER trg_sync_closings_salon
  BEFORE INSERT OR UPDATE ON public.financial_closings
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_financial_salon_id();

-- 5. RPC para fechamento atômico e liquidação de comissão com abatimento de vales
CREATE OR REPLACE FUNCTION public.pay_professional_commission(
  _professional_id uuid,
  _start_date date,
  _end_date date,
  _service_comm numeric,
  _product_comm numeric,
  _subscription_comm numeric,
  _advances_deducted numeric,
  _bonuses_added numeric,
  _net_payable numeric,
  _payment_method text DEFAULT 'pix',
  _notes text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner_id uuid;
  v_salon_id uuid;
  v_pro_name text;
  v_tx_id uuid;
  v_closing_id uuid;
BEGIN
  v_owner_id := auth.uid();
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT id, name INTO v_salon_id, v_pro_name
  FROM public.professionals
  WHERE id = _professional_id AND owner_id = v_owner_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profissional não encontrado ou não pertence a esta barbearia';
  END IF;

  SELECT id INTO v_salon_id
  FROM public.salon_settings
  WHERE owner_id = v_owner_id
  LIMIT 1;

  -- 1. Inserir despesa no financeiro
  INSERT INTO public.transactions (
    owner_id,
    salon_id,
    type,
    category,
    description,
    amount,
    net_amount,
    date,
    status,
    payment_method,
    professional_id,
    source,
    notes
  ) VALUES (
    v_owner_id,
    v_salon_id,
    'despesa',
    'comissões',
    'Comissão ' || v_pro_name || ' (' || to_char(_start_date, 'DD/MM/YYYY') || ' a ' || to_char(_end_date, 'DD/MM/YYYY') || ')',
    _net_payable,
    _net_payable,
    current_date,
    'realizado',
    _payment_method,
    _professional_id,
    'comissao',
    _notes
  ) RETURNING id INTO v_tx_id;

  -- 2. Criar registro do fechamento financeiro
  INSERT INTO public.financial_closings (
    owner_id,
    salon_id,
    professional_id,
    period_type,
    start_date,
    end_date,
    gross_sales,
    service_commissions,
    product_commissions,
    subscription_commissions,
    total_commissions,
    total_advances,
    total_bonuses,
    net_payable,
    status,
    notes,
    payment_transaction_id,
    closed_at
  ) VALUES (
    v_owner_id,
    v_salon_id,
    _professional_id,
    'personalizado',
    _start_date,
    _end_date,
    0,
    _service_comm,
    _product_comm,
    _subscription_comm,
    (_service_comm + _product_comm + _subscription_comm),
    _advances_deducted,
    _bonuses_added,
    _net_payable,
    'pago',
    _notes,
    v_tx_id,
    now()
  ) RETURNING id INTO v_closing_id;

  -- 3. Marcar vales e adiantamentos pendentes do período como descontados
  UPDATE public.professional_advances
  SET status = 'descontado',
      closing_id = v_closing_id,
      updated_at = now()
  WHERE professional_id = _professional_id
    AND owner_id = v_owner_id
    AND type IN ('vale', 'adiantamento')
    AND status = 'pendente'
    AND date >= _start_date
    AND date <= _end_date;

  -- 4. Marcar bonificações como pagas
  UPDATE public.professional_advances
  SET status = 'pago',
      closing_id = v_closing_id,
      updated_at = now()
  WHERE professional_id = _professional_id
    AND owner_id = v_owner_id
    AND type = 'bonificacao'
    AND status = 'pendente'
    AND date >= _start_date
    AND date <= _end_date;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'closing_id', v_closing_id,
    'net_payable', _net_payable
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pay_professional_commission TO authenticated;
