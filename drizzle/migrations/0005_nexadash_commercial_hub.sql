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

CREATE TABLE IF NOT EXISTS public.nexadash_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.nexadash_leads(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.nexadash_customers(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'ligacao', 'reuniao', 'email')),
  summary text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

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
