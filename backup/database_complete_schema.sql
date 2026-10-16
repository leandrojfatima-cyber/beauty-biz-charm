-- ============================================================================
-- BELEZI / SALÃO INTEGRADO - BACKUP CONSOLIDADO DO BANCO DE DADOS
-- Gerado em: 2026-10-16
-- Versão da Aplicação: 1.0 (Compatível com Supabase / PostgreSQL 15+)
-- ============================================================================

-- 1. TIPOS ENUM
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('master', 'admin', 'barbeiro', 'cliente');
  END IF;
END $$;

-- 2. TABELAS PRINCIPAIS DE NEGÓCIO

-- 2.1 Profissionais (Equipe)
CREATE TABLE IF NOT EXISTS public.professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  user_id uuid, -- Vínculo opcional com auth.users para login de barbeiro
  name text NOT NULL,
  role text NOT NULL DEFAULT 'cabeleireiro',
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2.2 Clientes
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  user_id uuid, -- Vínculo opcional com auth.users para login do cliente
  name text NOT NULL,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2.3 Serviços
CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'cabelo',
  price numeric(10,2) NOT NULL DEFAULT 0,
  duration_min int NOT NULL DEFAULT 60,
  commission_pct numeric(5,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2.4 Produtos e Estoque
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  sku text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  cost numeric(10,2) NOT NULL DEFAULT 0,
  stock numeric(10,2) NOT NULL DEFAULT 0,
  min_stock numeric(10,2) NOT NULL DEFAULT 0,
  commission_pct numeric(5,2) NOT NULL DEFAULT 0,
  for_sale boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2.5 Agendamentos
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'agendado',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2.6 Comandas (Orders)
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  number serial,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'aberta',
  payment_method text,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

-- 2.7 Itens de Comanda (Order Items)
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind in ('servico','produto')),
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL,
  description text NOT NULL,
  qty numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  commission_pct numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2.8 Movimentações de Estoque (Auditoria de Estoque)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  qty numeric(10,2) NOT NULL,
  type text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2.9 Transações Financeiras (Livro Caixa)
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  type text NOT NULL CHECK (type in ('receita','despesa')),
  category text NOT NULL DEFAULT 'geral',
  description text NOT NULL,
  amount numeric(10,2) NOT NULL,
  date date NOT NULL DEFAULT current_date,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2.10 Configurações do Salão / Barbearia
CREATE TABLE IF NOT EXISTS public.salon_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() UNIQUE,
  name text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  maps_link text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2.11 Papéis e Permissões de Usuários
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role, salon_id)
);

-- 2.12 Logs de Auditoria
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  email text,
  action text NOT NULL,
  device text,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2.13 Planos Comerciais
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric NOT NULL DEFAULT 0,
  price_max numeric,
  installments integer NOT NULL DEFAULT 1,
  installment_price numeric NOT NULL DEFAULT 0,
  optional boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  highlight boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  payment_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. GATILHOS E FUNÇÕES ARMAZENADAS

-- 3.1 Baixa automática de estoque
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.products SET stock = stock + NEW.qty WHERE id = NEW.product_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_stock_movement ON public.stock_movements;
CREATE TRIGGER trg_stock_movement
  AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();

-- 3.2 Fechamento Atômico de Comanda
CREATE OR REPLACE FUNCTION public.close_order(_order_id uuid, _payment_method text)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  o record;
  subtotal numeric;
  it record;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id AND owner_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comanda não encontrada';
  END IF;
  IF o.status <> 'aberta' THEN
    RAISE EXCEPTION 'Comanda já fechada';
  END IF;

  SELECT coalesce(sum(qty * unit_price), 0) INTO subtotal
  FROM public.order_items WHERE order_id = _order_id;

  UPDATE public.orders
  SET status = 'fechada',
      payment_method = _payment_method,
      total = greatest(subtotal - discount, 0),
      closed_at = now()
  WHERE id = _order_id;

  FOR it IN SELECT * FROM public.order_items WHERE order_id = _order_id AND kind = 'produto' AND product_id IS NOT NULL LOOP
    INSERT INTO public.stock_movements(owner_id, product_id, qty, type, note)
    VALUES (auth.uid(), it.product_id, -it.qty, 'venda', 'Comanda #' || o.number);
  END LOOP;

  IF greatest(subtotal - o.discount, 0) > 0 THEN
    INSERT INTO public.transactions(owner_id, type, category, description, amount, order_id)
    VALUES (auth.uid(), 'receita', 'atendimento', 'Comanda #' || o.number, greatest(subtotal - o.discount, 0), _order_id);
  END IF;

  IF o.appointment_id IS NOT NULL THEN
    UPDATE public.appointments SET status = 'concluido' WHERE id = o.appointment_id;
  END IF;
END $$;

-- 3.3 Verificação de Papel (Role)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

-- 3.4 Concessão de Acesso Master
CREATE OR REPLACE FUNCTION public.claim_master()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  em text;
  conf timestamptz;
BEGIN
  SELECT email, email_confirmed_at INTO em, conf FROM auth.users WHERE id = auth.uid();
  IF lower(em) = 'master@nexadash.com' AND conf IS NOT NULL THEN
    INSERT INTO public.user_roles(user_id, role)
    VALUES (auth.uid(), 'master')
    ON CONFLICT DO NOTHING;
    RETURN true;
  END IF;
  RETURN public.has_role(auth.uid(), 'master');
END $$;

-- 4. SEGURANÇA E ROW LEVEL SECURITY (RLS)
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN ARRAY ARRAY['professionals','clients','services','products','appointments','orders','order_items','stock_movements','transactions','salon_settings'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "owner_all" ON public.%I', t);
    EXECUTE format('CREATE POLICY "owner_all" ON public.%I FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())', t);
  END LOOP;
END $$;

GRANT USAGE, SELECT ON SEQUENCE public.orders_number_seq TO authenticated;

-- Permissões de Auditoria
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "insert_own" ON public.audit_logs;
CREATE POLICY "insert_own" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "master_read" ON public.audit_logs;
CREATE POLICY "master_read" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'master'));

-- Permissões de Planos
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON public.plans;
CREATE POLICY "public_read" ON public.plans FOR SELECT TO anon, authenticated USING (active OR public.has_role(auth.uid(), 'master'));
DROP POLICY IF EXISTS "master_write" ON public.plans;
CREATE POLICY "master_write" ON public.plans FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'master')) WITH CHECK (public.has_role(auth.uid(), 'master'));

-- 5. SEED INICIAL DE PLANOS (Caso não existam)
INSERT INTO public.plans (name, description, price, price_max, installments, installment_price, optional, active, highlight, sort_order, payment_url)
SELECT v.* FROM (VALUES
  ('NEXADASH START', 'Para autônomo/MEI. Recursos básicos.', 29.90::numeric, null::numeric, 1, 0::numeric, false, true, false, 1, 'https://mpago.la/1i9ivFj'),
  ('NEXADASH PRO', 'Dashboard completo, relatórios, exportação e recursos adicionais.', 59.90, null, 1, 0, false, true, true, 2, 'https://mpago.la/1i9ivFj'),
  ('NEXADASH IA', 'Tudo do Pro + análise inteligente, relatórios automáticos e recomendações.', 99.90, null, 1, 0, false, true, false, 3, 'https://mpago.la/1i9ivFj'),
  ('NEXADASH BUSINESS', 'Para empresas maiores: usuários adicionais, personalização, suporte e módulos específicos.', 199.00, 299.00, 1, 0, false, true, false, 4, 'https://mpago.la/1i9ivFj')
) AS v(name, description, price, price_max, installments, installment_price, optional, active, highlight, sort_order, payment_url)
WHERE NOT EXISTS (SELECT 1 FROM public.plans);
