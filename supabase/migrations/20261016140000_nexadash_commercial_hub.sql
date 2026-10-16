-- ============================================================================
-- NEXADASH COMMERCIAL HUB & CRM TABLES
-- Exclusivo para administradores NEXADASH (papel 'master')
-- ============================================================================

-- 1. Interessados / Leads
CREATE TABLE IF NOT EXISTS public.nexadash_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_name text NOT NULL,
  phone text,
  email text,
  city text,
  stage text NOT NULL DEFAULT 'novo' CHECK (stage IN ('novo', 'contato', 'demo', 'proposta', 'negociacao', 'ganho', 'perdido')),
  plan_interest text DEFAULT 'NEXADASH PRO',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Empresas Compradoras (Clientes Ativos da NEXADASH)
CREATE TABLE IF NOT EXISTS public.nexadash_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.nexadash_leads(id) ON DELETE SET NULL,
  company_name text NOT NULL,
  contact_name text NOT NULL,
  phone text,
  email text,
  document text,
  plan_name text NOT NULL DEFAULT 'NEXADASH PRO',
  monthly_price numeric(10,2) NOT NULL DEFAULT 59.90,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'trial', 'inadimplente', 'cancelado')),
  started_at date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Propostas, Contratos e Condições Negociadas
CREATE TABLE IF NOT EXISTS public.nexadash_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.nexadash_leads(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.nexadash_customers(id) ON DELETE SET NULL,
  title text NOT NULL,
  plan_name text NOT NULL,
  price numeric(10,2) NOT NULL,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  conditions text,
  status text NOT NULL DEFAULT 'enviada' CHECK (status IN ('enviada', 'aceita', 'recusada', 'cancelada')),
  valid_until date,
  payment_link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Histórico de Contatos e Interações
CREATE TABLE IF NOT EXISTS public.nexadash_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.nexadash_leads(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.nexadash_customers(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'ligacao', 'reuniao', 'email')),
  summary text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Suporte, Implantação e Consultorias
CREATE TABLE IF NOT EXISTS public.nexadash_support_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.nexadash_customers(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'implantacao' CHECK (type IN ('implantacao', 'suporte', 'consultoria')),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluido')),
  priority text NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: Acesso exclusivo para o papel master da NEXADASH
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN ARRAY ARRAY['nexadash_leads', 'nexadash_customers', 'nexadash_proposals', 'nexadash_interactions', 'nexadash_support_onboarding'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "master_exclusive_%I" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "master_exclusive_%I" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''master'')) WITH CHECK (public.has_role(auth.uid(), ''master''))', t, t);
  END LOOP;
END $$;
