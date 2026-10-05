import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Receipt, Percent, Package, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  { icon: CalendarDays, t: "Agenda", d: "Horários por profissional, cabelo e unhas." },
  { icon: Receipt, t: "Comandas", d: "Serviços e produtos vinculados a quem atendeu." },
  { icon: Percent, t: "Comissões", d: "Percentual por serviço e por produto, calculado sozinho." },
  { icon: Package, t: "Estoque", d: "Produtos de uso interno e venda, com alerta de mínimo." },
  { icon: Wallet, t: "Financeiro", d: "Receitas, despesas e fluxo de caixa do período." },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-3 py-3 sm:px-6 sm:py-6">
        <span className="font-display text-xl font-semibold">Belezi<span className="text-primary">.</span></span>
        <Button asChild variant="outline"><Link to="/auth">Entrar</Link></Button>
      </header>
      <section className="mx-auto max-w-6xl px-3 pb-6 pt-4 sm:px-6 sm:pb-16 sm:pt-12 md:pt-24">
        <p className="mb-4 text-sm font-medium uppercase tracking-widest text-primary">Gestão de salão</p>
        <h1 className="max-w-3xl text-2xl font-semibold sm:text-4xl leading-tight md:text-6xl">
          Agenda, comandas e caixa do salão, tudo no mesmo lugar.
        </h1>
        <p className="mt-3 max-w-xl text-sm sm:mt-6 sm:text-lg text-muted-foreground">
          Feche a comanda e o sistema já calcula a comissão de cada profissional, baixa o estoque e lança a receita.
        </p>
        <Button asChild size="lg" className="mt-4 sm:mt-8"><Link to="/painel">Acessar o sistema</Link></Button>
      </section>
      <section className="mx-auto grid max-w-6xl gap-px overflow-hidden rounded-lg border bg-border px-0 grid-cols-2 lg:grid-cols-5 mb-6 sm:mb-20">
        {features.map(({ icon: Icon, t, d }) => (
          <div key={t} className="bg-card p-3 sm:p-6">
            <Icon className="h-5 w-5 text-primary" />
            <h3 className="mt-2 font-semibold sm:mt-4">{t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
      <footer className="border-t px-3 py-3 text-center text-xs sm:py-6 sm:text-sm text-muted-foreground">Belezi — Sistema de Agendamento Online © 2026 · Desenvolvido e comercializado por NEXADASH</footer>
    </div>
  );
}
