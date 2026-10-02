
create table public.professionals (id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid(), name text not null, role text not null default 'cabeleireiro', phone text, active boolean not null default true, created_at timestamptz not null default now());
create table public.clients (id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid(), name text not null, phone text, notes text, created_at timestamptz not null default now());
create table public.services (id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid(), name text not null, category text not null default 'cabelo', price numeric(10,2) not null default 0, duration_min int not null default 60, commission_pct numeric(5,2) not null default 0, active boolean not null default true, created_at timestamptz not null default now());
create table public.products (id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid(), name text not null, sku text, price numeric(10,2) not null default 0, cost numeric(10,2) not null default 0, stock numeric(10,2) not null default 0, min_stock numeric(10,2) not null default 0, commission_pct numeric(5,2) not null default 0, for_sale boolean not null default true, active boolean not null default true, created_at timestamptz not null default now());
create table public.appointments (id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid(), client_id uuid references public.clients(id) on delete set null, professional_id uuid not null references public.professionals(id) on delete cascade, service_id uuid references public.services(id) on delete set null, starts_at timestamptz not null, ends_at timestamptz not null, status text not null default 'agendado', notes text, created_at timestamptz not null default now());
create table public.orders (id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid(), number serial, client_id uuid references public.clients(id) on delete set null, appointment_id uuid references public.appointments(id) on delete set null, status text not null default 'aberta', payment_method text, discount numeric(10,2) not null default 0, total numeric(10,2) not null default 0, opened_at timestamptz not null default now(), closed_at timestamptz);
create table public.order_items (id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid(), order_id uuid not null references public.orders(id) on delete cascade, kind text not null check (kind in ('servico','produto')), service_id uuid references public.services(id) on delete set null, product_id uuid references public.products(id) on delete set null, professional_id uuid references public.professionals(id) on delete set null, description text not null, qty numeric(10,2) not null default 1, unit_price numeric(10,2) not null default 0, commission_pct numeric(5,2) not null default 0, created_at timestamptz not null default now());
create table public.stock_movements (id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid(), product_id uuid not null references public.products(id) on delete cascade, qty numeric(10,2) not null, type text not null, note text, created_at timestamptz not null default now());
create table public.transactions (id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid(), type text not null check (type in ('receita','despesa')), category text not null default 'geral', description text not null, amount numeric(10,2) not null, date date not null default current_date, order_id uuid references public.orders(id) on delete set null, created_at timestamptz not null default now());

do $$ declare t text; begin
  foreach t in array array['professionals','clients','services','products','appointments','orders','order_items','stock_movements','transactions'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "owner_all" on public.%I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t);
  end loop;
end $$;
grant usage, select on sequence public.orders_number_seq to authenticated;

-- stock movement updates product stock
create or replace function public.apply_stock_movement() returns trigger language plpgsql set search_path = public as $$
begin
  update public.products set stock = stock + new.qty where id = new.product_id;
  return new;
end $$;
create trigger trg_stock_movement after insert on public.stock_movements for each row execute function public.apply_stock_movement();

create or replace function public.close_order(_order_id uuid, _payment_method text) returns void language plpgsql set search_path = public as $$
declare o record; subtotal numeric; it record;
begin
  select * into o from public.orders where id = _order_id and owner_id = auth.uid() for update;
  if not found then raise exception 'Comanda não encontrada'; end if;
  if o.status <> 'aberta' then raise exception 'Comanda já fechada'; end if;
  select coalesce(sum(qty*unit_price),0) into subtotal from public.order_items where order_id = _order_id;
  update public.orders set status='fechada', payment_method=_payment_method, total=greatest(subtotal - discount,0), closed_at=now() where id=_order_id;
  for it in select * from public.order_items where order_id=_order_id and kind='produto' and product_id is not null loop
    insert into public.stock_movements(owner_id, product_id, qty, type, note) values (auth.uid(), it.product_id, -it.qty, 'venda', 'Comanda #' || o.number);
  end loop;
  if greatest(subtotal - o.discount,0) > 0 then
    insert into public.transactions(owner_id, type, category, description, amount, order_id) values (auth.uid(), 'receita', 'atendimento', 'Comanda #' || o.number, greatest(subtotal - o.discount,0), _order_id);
  end if;
  if o.appointment_id is not null then update public.appointments set status='concluido' where id=o.appointment_id; end if;
end $$;
grant execute on function public.close_order(uuid, text) to authenticated;
