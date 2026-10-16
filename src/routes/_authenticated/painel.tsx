import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Stat } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { brl, db, fmtTime, todayISO } from "@/lib/db";
import { useClients, useProducts, useProfessionals, useServices } from "@/lib/lookups";
import { currentMonth, dayBounds, monthRange } from "@/lib/period";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — Belezi" },
      {
        name: "description",
        content: "Acompanhe a agenda, receitas, comandas e estoque do salão no Belezi.",
      },
      { property: "og:title", content: "Painel — Belezi" },
      {
        property: "og:description",
        content: "Acompanhe a agenda, receitas, comandas e estoque do salão no Belezi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Painel,
});

function Painel() {
  const today = todayISO();
  const { start, end } = monthRange(currentMonth());
  const { data: pros = [] } = useProfessionals();
  const { data: clients = [] } = useClients();
  const { data: services = [] } = useServices();
  const { data: products = [] } = useProducts();
  const { data } = useQuery({
    queryKey: ["dashboard", today],
    queryFn: async () => {
      const d = dayBounds(today, today);
      const [appts, openOrders, tx, todayTx] = await Promise.all([
        db
          .from("appointments")
          .select("*")
          .gte("starts_at", d.from)
          .lte("starts_at", d.to)
          .neq("status", "cancelado")
          .order("starts_at"),
        db.from("orders").select("id", { count: "exact", head: true }).eq("status", "aberta"),
        db.from("transactions").select("type, amount").gte("date", start).lte("date", end),
        db.from("transactions").select("amount").eq("type", "receita").eq("date", today),
      ]);
      const sum = (rows: any[], type: string) =>
        rows.filter((r) => r.type === type).reduce((s, r) => s + Number(r.amount), 0);
      return {
        appts: appts.data ?? [],
        open: openOrders.count ?? 0,
        income: sum(tx.data ?? [], "receita"),
        expense: sum(tx.data ?? [], "despesa"),
        todayIncome: (todayTx.data ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0),
      };
    },
  });
  const low = products.filter((p: any) => p.active && Number(p.stock) <= Number(p.min_stock));
  const name = (arr: any[], id: string) => arr.find((x) => x.id === id)?.name ?? "—";
  const empty = !pros.length && !services.length;

  return (
    <div>
      <PageHeader
        title="Painel"
        subtitle={new Date().toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      />
      {empty && (
        <div className="mb-6 rounded-lg border border-primary/30 bg-accent p-5 text-accent-foreground">
          <p className="font-semibold">Primeiros passos</p>
          <p className="mt-1 text-sm">
            Cadastre sua equipe, seus serviços (com o percentual de comissão) e produtos. Depois é
            só agendar e abrir comandas.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link to="/profissionais">Profissionais</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/servicos">Serviços</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/produtos">Produtos</Link>
            </Button>
          </div>
        </div>
      )}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Recebido hoje" value={brl(data?.todayIncome)} tone="success" />
        <Stat label="Comandas abertas" value={String(data?.open ?? 0)} />
        <Stat label="Receitas do mês" value={brl(data?.income)} tone="primary" />
        <Stat label="Resultado do mês" value={brl((data?.income ?? 0) - (data?.expense ?? 0))} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="font-semibold">Agenda de hoje</p>
            <Link to="/agenda" className="text-sm text-primary">
              Ver agenda
            </Link>
          </div>
          {(data?.appts ?? []).length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhum horário hoje.</p>
          )}
          {(data?.appts ?? []).map((a: any) => (
            <div
              key={a.id}
              className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 border-b px-4 py-3 text-sm last:border-0"
            >
              <span className="w-14 font-semibold">{fmtTime(a.starts_at)}</span>
              <span className="flex-1">
                {name(clients, a.client_id)}{" "}
                <span className="text-muted-foreground">· {name(services, a.service_id)}</span>
              </span>
              <span className="col-start-2 text-muted-foreground sm:col-auto">
                {name(pros, a.professional_id)}
              </span>
            </div>
          ))}
        </div>
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <p className="font-semibold">Estoque baixo</p>
          </div>
          {low.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">Tudo em dia.</p>
          )}
          {low.map((p: any) => (
            <div
              key={p.id}
              className="flex justify-between border-b px-4 py-2.5 text-sm last:border-0"
            >
              <span>{p.name}</span>
              <span className="font-semibold text-destructive">
                {Number(p.stock)} / mín. {Number(p.min_stock)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
