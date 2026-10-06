alter table public.plans
  add column if not exists description text not null default '',
  add column if not exists price_max numeric,
  add column if not exists highlight boolean not null default false,
  add column if not exists sort_order integer not null default 0;

insert into public.plans (name, description, price, price_max, installments, installment_price, optional, active, highlight, sort_order)
select v.* from (values
  ('NEXADASH START', 'Para autônomo/MEI. Recursos básicos.', 29.90::numeric, null::numeric, 1, 0::numeric, false, true, false, 1),
  ('NEXADASH PRO', 'Dashboard completo, relatórios, exportação e recursos adicionais.', 59.90, null, 1, 0, false, true, true, 2),
  ('NEXADASH IA', 'Tudo do Pro + análise inteligente, relatórios automáticos e recomendações.', 99.90, null, 1, 0, false, true, false, 3),
  ('NEXADASH BUSINESS', 'Para empresas maiores: usuários adicionais, personalização, suporte e módulos específicos.', 199.00, 299.00, 1, 0, false, true, false, 4)
) as v(name, description, price, price_max, installments, installment_price, optional, active, highlight, sort_order)
where not exists (select 1 from public.plans);