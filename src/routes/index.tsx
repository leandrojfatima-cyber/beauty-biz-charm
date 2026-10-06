import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Receipt, Percent, Package, Wallet, ExternalLink, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/db";
import painelImage from "@/assets/belezi-painel-demo.jpg.asset.json";
import agendaImage from "@/assets/belezi-agenda-demo.jpg.asset.json";
import financeiroImage from "@/assets/belezi-financeiro-demo.jpg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Belezi — Gestão completa para cabeleireiros e manicures" },
      { name: "description", content: "Agenda, comandas, comissões por serviço e produto, estoque e financeiro integrados." },
      { property: "og:title", content: "Belezi — Gestão completa para seu salão" },
      { property: "og:description", content: "Agenda, comandas, comissões, estoque e fluxo de caixa em um só sistema." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const features = [
  { icon: CalendarDays, t: "Agenda" },
  { icon: Receipt, t: "Comandas" },
  { icon: Percent, t: "Comissões" },
  { icon: Package, t: "Estoque" },
  { icon: Wallet, t: "Financeiro" },
];

const screenshots = [
  { image: painelImage.url, title: "Seu salão em um só lugar", label: "01 · Painel", description: "Agenda do dia, receitas e estoque." },
  { image: agendaImage.url, title: "Cada horário organizado", label: "02 · Agenda", description: "Atendimentos separados por profissional." },
  { image: financeiroImage.url, title: "O caixa sempre à vista", label: "03 · Financeiro", description: "Entradas, despesas e saldo do período." },
];

type Plan = { id: string; name: string; description: string; price: number; price_max: number | null; highlight: boolean; payment_url: string | null };
const DEFAULT_PAY_URL = "https://mpago.la/1i9ivFj";

const priceLabel = (p: Plan) =>
  p.price_max && Number(p.price_max) > Number(p.price) ? `${brl(p.price)} a ${brl(p.price_max)}` : brl(p.price);

function usePublicPlans() {
  return useQuery({
    queryKey: ["public-plans"],
    queryFn: async (): Promise<Plan[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("plans").select("id,name,description,price,price_max,highlight,payment_url").eq("active", true).order("sort_order").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function Index() {
  const { data: plans = [] } = usePublicPlans();
  const [selected, setSelected] = useState<string | null>(null);
  const chosen = plans.find((x) => x.id === selected) ?? plans.find((x) => x.highlight) ?? plans[0];
  return (
    <div className="belezi-home bg-background">
      <header className="home-header flex items-center justify-between gap-3 border-b">
        <Link to="/" aria-label="Belezi — Página inicial" className="font-display text-xl font-semibold">Belezi<span className="text-primary">.</span></Link>
        <span className="hidden text-xs text-muted-foreground sm:block">Sistema de Agendamento Online</span>
        <Button asChild variant="outline" size="sm"><Link to="/auth">Entrar <ArrowRight className="h-3.5 w-3.5" /></Link></Button>
      </header>
      <section className="home-intro">
        <p className="mb-1 text-xs font-medium uppercase text-primary">Gestão para cabeleireiros e manicures</p>
        <h1 className="font-semibold">Belezi<span className="text-primary">.</span> Seu salão, conectado.</h1>
        <p className="mt-2 text-sm text-muted-foreground">Agenda, comandas, comissões, estoque e caixa em um só sistema.</p>
        <div className="home-features mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          {features.map(({ icon: Icon, t }) => <span key={t} className="flex items-center gap-1.5 text-xs"><Icon className="h-3.5 w-3.5 text-primary" />{t}</span>)}
        </div>
      </section>
      <section className="home-showcase" aria-label="Telas do sistema Belezi">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Conheça o Belezi por dentro</h2>
          <span className="text-[10px] text-muted-foreground">Dados fictícios para demonstração</span>
        </div>
        <div className="home-screenshots">
          {screenshots.map(({ image, title, label, description }) => (
            <figure key={label} className="home-screenshot">
              <div className="home-image border bg-card"><img src={image} alt={`${label}: tela real do Belezi com dados fictícios`} width={1280} height={800} /></div>
              <figcaption className="pt-2">
                <span className="text-[10px] font-medium uppercase text-primary">{label}</span>
                <h3 className="mt-0.5 text-sm font-semibold">{title}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
      <section className="home-offer border-y border-primary/20 bg-accent text-accent-foreground" aria-label="Planos do sistema Belezi">
        <div className="home-offer-head">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase text-primary">Belezi para o seu negócio</p>
            <h2 className="text-base font-semibold">Escolha o plano ideal para o seu salão.</h2>
          </div>
          <div className="home-offer-actions flex flex-wrap gap-2">
            <Button asChild size="sm"><a href="https://mpago.la/1i9ivFj" target="_blank" rel="noopener noreferrer">{chosen ? `Assinar ${chosen.name}` : "Comprar pelo Mercado Pago"} <ExternalLink className="h-3.5 w-3.5" /></a></Button>
            <Button asChild size="sm" variant="outline"><Link to="/painel">Acessar o sistema <ArrowRight className="h-3.5 w-3.5" /></Link></Button>
          </div>
        </div>
        <div className="home-plans" role="radiogroup" aria-label="Planos">
          {plans.map((p) => {
            const isSel = (selected ?? plans.find((x) => x.highlight)?.id ?? plans[0]?.id) === p.id;
            return (
            <button type="button" role="radio" aria-checked={isSel} onClick={() => setSelected(p.id)} key={p.id} className={`home-plan cursor-pointer rounded-lg border bg-card text-left text-card-foreground transition hover:border-primary ${isSel ? "border-primary ring-2 ring-primary" : ""}`}>
              <div className="flex items-center justify-between gap-1">
                <p className="truncate text-xs font-semibold">{p.name}</p>
                {isSel ? <span className="rounded bg-primary px-1 text-[9px] font-semibold uppercase text-primary-foreground">Escolhido</span> : p.highlight && <span className="rounded border border-primary px-1 text-[9px] font-semibold uppercase text-primary">Popular</span>}
              </div>
              <p className="font-display text-base font-semibold leading-tight">{priceLabel(p)}<span className="text-[10px] font-normal text-muted-foreground">/mês</span></p>
              <p className="home-plan-desc text-[10px] text-muted-foreground">{p.description}</p>
            </button>
          );})}
        </div>
      </section>
      <footer className="home-footer text-[10px] text-muted-foreground">Belezi © 2026 · Desenvolvido e comercializado por NEXADASH</footer>
    </div>
  );
}
