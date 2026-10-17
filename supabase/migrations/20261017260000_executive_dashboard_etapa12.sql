-- Etapa 12 — add salon ownership keys to tables used in executive reporting.
-- Existing owner_id-based RLS policies remain the authorization boundary.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE;
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS salon_id uuid REFERENCES public.salon_settings(id) ON DELETE CASCADE;

-- Backfill existing rows to the salon owned by the same account.
UPDATE public.products AS p
SET salon_id = s.id
FROM public.salon_settings AS s
WHERE p.owner_id = s.owner_id AND p.salon_id IS NULL;

UPDATE public.orders AS o
SET salon_id = s.id
FROM public.salon_settings AS s
WHERE o.owner_id = s.owner_id AND o.salon_id IS NULL;

UPDATE public.order_items AS i
SET salon_id = o.salon_id
FROM public.orders AS o
WHERE i.order_id = o.id AND i.owner_id = o.owner_id AND i.salon_id IS NULL;

-- Derive, never trust, a submitted salon_id: each row belongs to its owner's salon.
CREATE OR REPLACE FUNCTION public.sync_dashboard_salon_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT id INTO NEW.salon_id
  FROM public.salon_settings
  WHERE owner_id = NEW.owner_id
  LIMIT 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_dashboard_salon_products ON public.products;
CREATE TRIGGER trg_sync_dashboard_salon_products
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.sync_dashboard_salon_id();

DROP TRIGGER IF EXISTS trg_sync_dashboard_salon_orders ON public.orders;
CREATE TRIGGER trg_sync_dashboard_salon_orders
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.sync_dashboard_salon_id();

DROP TRIGGER IF EXISTS trg_sync_dashboard_salon_order_items ON public.order_items;
CREATE TRIGGER trg_sync_dashboard_salon_order_items
  BEFORE INSERT OR UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_dashboard_salon_id();

CREATE INDEX IF NOT EXISTS idx_products_salon_dashboard ON public.products(salon_id);
CREATE INDEX IF NOT EXISTS idx_orders_salon_dashboard ON public.orders(salon_id, closed_at);
CREATE INDEX IF NOT EXISTS idx_order_items_salon_dashboard ON public.order_items(salon_id, order_id);
