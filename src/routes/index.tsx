import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Receipt, Percent, Package, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Salão — Gestão completa para cabeleireiros e manicures" },
      { name: "description", content: "Agenda, comandas, comissões por serviço e produto, estoque e financeiro integrados." },
      { property: "og:title", content: "Salão — Gestão completa para seu salão" },
      { property: "og:description", content: "Agenda, comandas, comissões, estoque e fluxo de caixa em um só sistema." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const features = [
  { icon: CalendarDays, t: "Agenda", d: "Horários por profissional, cabelo e unhas." },
  { icon: Receipt, t: "Comandas", d: "Serviços e produtos vinculados a quem atendeu." },
  { icon: Percent, t: "Comissões", d: "Percentual por serviço e por produto, calculado sozinho." },
  { icon: Package, t: "Estoque", d: "Produtos de uso interno e venda, com alerta de mínimo." },
  { icon: Wallet, t: "Financeiro", d: "Receitas, despesas e fluxo de caixa do período." },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-xl font-semibold">Salão<span className="text-primary">.</span></span>
        <Button asChild variant="outline"><Link to="/auth">Entrar</Link></Button>
      </header>
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-12 md:pt-24">
        <p className="mb-4 text-sm font-medium uppercase tracking-widest text-primary">Gestão de salão</p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
          Agenda, comandas e caixa do salão, tudo no mesmo lugar.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Feche a comanda e o sistema já calcula a comissão de cada profissional, baixa o estoque e lança a receita.
        </p>
        <Button asChild size="lg" className="mt-8"><Link to="/painel">Acessar o sistema</Link></Button>
      </section>
      <section className="mx-auto grid max-w-6xl gap-px overflow-hidden rounded-xl border bg-border px-0 sm:grid-cols-2 lg:grid-cols-5 mb-20">
        {features.map(({ icon: Icon, t, d }) => (
          <div key={t} className="bg-card p-6">
            <Icon className="h-5 w-5 text-primary" />
            <h3 className="mt-4 font-semibold">{t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
