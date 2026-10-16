-- ============================================================================
-- NEXADASH SUBSCRIPTIONS & B2B BILLING
-- Gestão de contratos, assinaturas das barbearias e controle de recebimentos
-- ============================================================================

-- 1. Assinaturas Contratadas
CREATE TABLE IF NOT EXISTS public.nexadash_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.nexadash_customers(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  plan_name text NOT NULL DEFAULT 'NEXADASH PRO',
  billing_cycle text NOT NULL DEFAULT 'mensal' CHECK (billing_cycle IN ('mensal', 'trimestral', 'semestral', 'anual')),
  contracted_price numeric(10,2) NOT NULL DEFAULT 59.90,
  special_conditions text,
  features text,
  started_at date NOT NULL DEFAULT current_date,
  valid_until date NOT NULL,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'trial', 'suspensa', 'cancelada', 'encerrada')),
  next_due_date date NOT NULL,
  cancellation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Faturas / Cobranças e Histórico de Pagamentos
CREATE TABLE IF NOT EXISTS public.nexadash_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES public.nexadash_subscriptions(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.nexadash_customers(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  amount numeric(10,2) NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'recebido', 'vencido', 'cancelado')),
  payment_method text,
  paid_at timestamptz,
  confirmation_notes text,
  payment_link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: Acesso exclusivo ao papel master da NEXADASH
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN ARRAY ARRAY['nexadash_subscriptions', 'nexadash_invoices'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "master_exclusive_%I" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "master_exclusive_%I" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''master'')) WITH CHECK (public.has_role(auth.uid(), ''master''))', t, t);
  END LOOP;
END $$;
