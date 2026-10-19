-- ============================================================================
-- BELEZI / SALÃO INTEGRADO — SCRIPT SQL CONSOLIDADO DE ALINHAMENTO DO PAINEL
-- Garante tabelas, colunas (salon_id, starts_at, appointment_date, total_amount, etc.)
-- com compatibilidade retroativa e tratamento seguro contra erros 42703.
-- Idempotente: pode ser executado múltiplas vezes com total segurança.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA: salon_settings (Configurações da Barbearia)
CREATE TABLE IF NOT EXISTS public.salon_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL DEFAULT 'Minha Barbearia',
  address text DEFAULT '',
  maps_link text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.salon_settings
  ADD COLUMN IF NOT EXISTS owner_id uuid DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS name text DEFAULT 'Minha Barbearia',
  ADD COLUMN IF NOT EXISTS address text DEFAULT '',
  ADD COLUMN IF NOT EXISTS maps_link text DEFAULT '',
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#0F172A',
  ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#D4AF37',
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS business_hours jsonb DEFAULT '{}'::jsonb;

-- 2. TABELA: professionals (Equipe & Barbeiros)
CREATE TABLE IF NOT EXISTS public.professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Profissional',
  role text NOT NULL DEFAULT 'barbeiro_master',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS owner_id uuid DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'barbeiro_master',
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS working_hours text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS schedule_details jsonb;

-- 3. TABELA: clients (Clientes)
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Cliente',
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS owner_id uuid DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS is_vip boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS vip_plan_name text,
  ADD COLUMN IF NOT EXISTS is_blocked_booking boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS block_reason text,
  ADD COLUMN IF NOT EXISTS no_shows_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_service_date date,
  ADD COLUMN IF NOT EXISTS last_product_purchase_date date,
  ADD COLUMN IF NOT EXISTS notes text;

-- 4. TABELA: services (Catálogo de Serviços)
CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Serviço',
  price numeric(10,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS owner_id uuid DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'cabelo',
  ADD COLUMN IF NOT EXISTS duration_min integer DEFAULT 45,
  ADD COLUMN IF NOT EXISTS commission_pct numeric(5,2) DEFAULT 50,
  ADD COLUMN IF NOT EXISTS highlight boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

-- 5. TABELA: products (Produtos & Estoque)
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Produto',
  price numeric(10,2) NOT NULL DEFAULT 0,
  stock numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS owner_id uuid DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS cost numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_stock numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_pct numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS for_sale boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

-- 6. TABELA: appointments (Agenda e Atendimentos)
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- GARANTIR COLUNAS CRÍTICAS DE appointments (starts_at, ends_at, appointment_date)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS owner_id uuid DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS professional_id uuid REFERENCES public.professionals(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS appointment_date timestamptz,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'agendado',
  ADD COLUMN IF NOT EXISTS is_vip boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS vip_simultaneous_override boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_blocked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS block_reason text,
  ADD COLUMN IF NOT EXISTS notes text;

-- Sincronizar starts_at com appointment_date ou date se existirem
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'appointment_date') THEN
    UPDATE public.appointments SET starts_at = appointment_date WHERE starts_at IS NULL AND appointment_date IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'date') THEN
    UPDATE public.appointments SET starts_at = (date || ' 00:00:00')::timestamptz WHERE starts_at IS NULL AND date IS NOT NULL;
  END IF;
  UPDATE public.appointments SET starts_at = COALESCE(created_at, now()) WHERE starts_at IS NULL;
  UPDATE public.appointments SET ends_at = (starts_at + interval '45 minutes') WHERE ends_at IS NULL;
END $$;

-- 7. TABELA: orders (Comandas)
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS owner_id uuid DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'aberta',
  ADD COLUMN IF NOT EXISTS opened_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS total numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method text;

UPDATE public.orders SET total_amount = total WHERE total_amount IS NULL OR total_amount = 0;
UPDATE public.orders SET total = total_amount WHERE total IS NULL OR total = 0;

-- 8. TABELA: order_items (Itens de Comanda)
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  qty numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS owner_id uuid DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS kind text DEFAULT 'servico',
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commission_pct numeric(5,2) DEFAULT 0;

-- 9. TABELA: transactions (Financeiro Operacional)
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  description text NOT NULL DEFAULT '',
  amount numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS owner_id uuid DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'receita',
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'vendas',
  ADD COLUMN IF NOT EXISTS amount numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS date date DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'realizado',
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'dinheiro',
  ADD COLUMN IF NOT EXISTS card_fee numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'avulso',
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes text;

UPDATE public.transactions SET net_amount = amount WHERE net_amount IS NULL;
UPDATE public.transactions SET total_amount = amount WHERE total_amount IS NULL OR total_amount = 0;

-- 10. TABELAS DE ASSINATURAS E PLANOS
CREATE TABLE IF NOT EXISTS public.salon_client_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Plano VIP',
  model text NOT NULL DEFAULT 'recorrente',
  price numeric(10,2) NOT NULL DEFAULT 0,
  billing_cycle text NOT NULL DEFAULT 'mensal',
  monthly_credit_limit integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.salon_client_plans(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ativa',
  starts_at timestamptz NOT NULL DEFAULT now(),
  renews_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 11. TRIGGER UNIVERSAL PARA SINCRONIZAR salon_id A PARTIR DO owner_id
CREATE OR REPLACE FUNCTION public.sync_salon_id_from_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.salon_id IS NULL AND NEW.owner_id IS NOT NULL THEN
    SELECT id INTO NEW.salon_id
    FROM public.salon_settings
    WHERE owner_id = NEW.owner_id
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_salon_professionals ON public.professionals;
CREATE TRIGGER trg_sync_salon_professionals BEFORE INSERT OR UPDATE ON public.professionals FOR EACH ROW EXECUTE FUNCTION public.sync_salon_id_from_owner();

DROP TRIGGER IF EXISTS trg_sync_salon_clients ON public.clients;
CREATE TRIGGER trg_sync_salon_clients BEFORE INSERT OR UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.sync_salon_id_from_owner();

DROP TRIGGER IF EXISTS trg_sync_salon_services ON public.services;
CREATE TRIGGER trg_sync_salon_services BEFORE INSERT OR UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.sync_salon_id_from_owner();

DROP TRIGGER IF EXISTS trg_sync_salon_products ON public.products;
CREATE TRIGGER trg_sync_salon_products BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.sync_salon_id_from_owner();

DROP TRIGGER IF EXISTS trg_sync_salon_appointments ON public.appointments;
CREATE TRIGGER trg_sync_salon_appointments BEFORE INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.sync_salon_id_from_owner();

DROP TRIGGER IF EXISTS trg_sync_salon_orders ON public.orders;
CREATE TRIGGER trg_sync_salon_orders BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.sync_salon_id_from_owner();

DROP TRIGGER IF EXISTS trg_sync_salon_order_items ON public.order_items;
CREATE TRIGGER trg_sync_salon_order_items BEFORE INSERT OR UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.sync_salon_id_from_owner();

DROP TRIGGER IF EXISTS trg_sync_salon_transactions ON public.transactions;
CREATE TRIGGER trg_sync_salon_transactions BEFORE INSERT OR UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.sync_salon_id_from_owner();

-- 12. BACKFILL DE salon_id
UPDATE public.professionals p SET salon_id = s.id FROM public.salon_settings s WHERE p.owner_id = s.owner_id AND p.salon_id IS NULL;
UPDATE public.clients c SET salon_id = s.id FROM public.salon_settings s WHERE c.owner_id = s.owner_id AND c.salon_id IS NULL;
UPDATE public.services sv SET salon_id = s.id FROM public.salon_settings s WHERE sv.owner_id = s.owner_id AND sv.salon_id IS NULL;
UPDATE public.products pr SET salon_id = s.id FROM public.salon_settings s WHERE pr.owner_id = s.owner_id AND pr.salon_id IS NULL;
UPDATE public.appointments a SET salon_id = s.id FROM public.salon_settings s WHERE a.owner_id = s.owner_id AND a.salon_id IS NULL;
UPDATE public.orders o SET salon_id = s.id FROM public.salon_settings s WHERE o.owner_id = s.owner_id AND o.salon_id IS NULL;
UPDATE public.order_items oi SET salon_id = o.salon_id FROM public.orders o WHERE oi.order_id = o.id AND oi.salon_id IS NULL;
UPDATE public.transactions t SET salon_id = s.id FROM public.salon_settings s WHERE t.owner_id = s.owner_id AND t.salon_id IS NULL;

-- 13. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.salon_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'salon_settings', 'professionals', 'clients', 'services',
    'products', 'appointments', 'orders', 'order_items', 'transactions'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "owner_all_%s" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "owner_all_%s" ON public.%I FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())',
      tbl, tbl
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "public_read_salon_settings" ON public.salon_settings;
CREATE POLICY "public_read_salon_settings" ON public.salon_settings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read_active_services" ON public.services;
CREATE POLICY "public_read_active_services" ON public.services FOR SELECT TO anon, authenticated USING (active = true);

DROP POLICY IF EXISTS "public_read_active_professionals" ON public.professionals;
CREATE POLICY "public_read_active_professionals" ON public.professionals FOR SELECT TO anon, authenticated USING (active = true);

-- 14. CRIAÇÃO SEGURA DE ÍNDICES CONDICIONAIS (SEM DEPENDÊNCIA RÍGIDA)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'date') THEN
    CREATE INDEX IF NOT EXISTS idx_transactions_dashboard ON public.transactions(date);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'closed_at') THEN
    CREATE INDEX IF NOT EXISTS idx_orders_dashboard ON public.orders(closed_at);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'starts_at') THEN
    CREATE INDEX IF NOT EXISTS idx_appointments_dashboard ON public.appointments(starts_at);
  END IF;
END $$;

-- 15. PERMISSÕES
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
