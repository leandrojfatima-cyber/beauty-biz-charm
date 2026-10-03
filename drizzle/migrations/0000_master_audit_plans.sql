create type public.app_role as enum ('master');
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid not null, role app_role not null, unique(user_id, role));
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy own_read on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

-- Grants master to the single authorised e-mail, only once it is confirmed.
create or replace function public.claim_master() returns boolean language plpgsql security definer set search_path = public as $$
declare em text; conf timestamptz;
begin
  select email, email_confirmed_at into em, conf from auth.users where id = auth.uid();
  if lower(em) = 'master@nexadash.com' and conf is not null then
    insert into public.user_roles(user_id, role) values (auth.uid(), 'master') on conflict do nothing;
    return true;
  end if;
  return public.has_role(auth.uid(), 'master');
end $$;
revoke execute on function public.claim_master() from anon, public;
grant execute on function public.claim_master() to authenticated;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  email text,
  action text not null,
  device text,
  details text,
  created_at timestamptz not null default now()
);
grant select, insert on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy insert_own on public.audit_logs for insert to authenticated with check (user_id = auth.uid());
create policy master_read on public.audit_logs for select to authenticated using (public.has_role(auth.uid(), 'master'));

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric not null default 0,
  installments integer not null default 1,
  installment_price numeric not null default 0,
  optional boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.plans to anon, authenticated;
grant insert, update, delete on public.plans to authenticated;
grant all on public.plans to service_role;
alter table public.plans enable row level security;
create policy public_read on public.plans for select to anon, authenticated using (active or public.has_role(auth.uid(), 'master'));
create policy master_write on public.plans for all to authenticated using (public.has_role(auth.uid(), 'master')) with check (public.has_role(auth.uid(), 'master'));