import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Printer, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { brl, fmtTime, todayISO } from "@/lib/db";
import { monthRange } from "@/lib/period";
import {
  dashboardDateKey,
  downloadDashboardCsv,
  periodRange,
} from "@/lib/dashboard-engine";
import { loadExecutiveDashboard } from "@/lib/dashboard-data";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Inteligência Executiva — Belezi" },
      {
        name: "description",
        content: "Acompanhe faturamento, produtividade, agenda e retenção da sua barbearia.",
      },
    ],
  }),
  component: Painel,
});

type PeriodPreset = "today" | "7days" | "month" | "custom";

function MetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "warning";
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-2 text-xl font-semibold sm:text-2xl ${
          tone === "positive"
            ? "text-emerald-700"
            : tone === "warning"
              ? "text-amber-700"
              : ""
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function RankingList({
  title,
  rows,
  unit,
}: {
  title: string;
  rows: Array<{ id: string; name: string; quantity?: number; revenue: number }>;
  unit: string;
}) {
  return (
    <section className="rounded-xl border bg-card">
      <h2 className="border-b px-4 py-3 font-semibold">{title}</h2>
      {rows.length ? (
        <ol className="divide-y">
          {rows.slice(0, 5).map((row, index) => (
            <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0 truncate">
                <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                {row.name}
                {row.quantity !== undefined && (
                  <span className="ml-1 text-muted-foreground">
                    · {row.quantity} {unit}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-medium">{brl(row.revenue)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="p-5 text-center text-sm text-muted-foreground">
          Sem vendas no período selecionado.
        </p>
      )}
    </section>
  );
}

function Painel() {
  const today = todayISO();
  const defaultRange = monthRange(today.slice(0, 7));
  const [preset, setPreset] = useState<PeriodPreset>("month");
  const [customStart, setCustomStart] = useState(defaultRange.start);
  const [customEnd, setCustomEnd] = useState(today);
  const range = useMemo(
    () => periodRange(preset, customStart, customEnd, today),
    [preset, customStart, customEnd, today],
  );
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["executive-dashboard", range.start, range.end],
    queryFn: () => loadExecutiveDashboard(range),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const analytics = data?.analytics;
  const appointmentToday = (data?.appointments ?? []).filter((appointment: any) => {
    const date = dashboardDateKey(appointment.starts_at);
    return date === today && appointment.status !== "cancelado";
  });
  const clientsById = new Map<string, string>(
    (data?.clients ?? []).map((client: any) => [client.id, client.name] as [string, string]),
  );
  const servicesById = new Map<string, string>(
    (data?.services ?? []).map((service: any) => [service.id, service.name] as [string, string]),
  );
  const professionalsById = new Map<string, string>(
    (data?.professionals ?? []).map(
      (professional: any) => [professional.id, professional.name] as [string, string],
    ),
  );
  const dateLabel =
    range.start === range.end
      ? new Date(`${range.start}T12:00:00`).toLocaleDateString("pt-BR")
      : `${new Date(`${range.start}T12:00:00`).toLocaleDateString("pt-BR")} – ${new Date(`${range.end}T12:00:00`).toLocaleDateString("pt-BR")}`;

  return (
    <div>
      <style>{`
        @media print {
          .app-shell aside, .dashboard-print-hide { display: none !important; }
          .app-shell main { padding: 0 !important; }
          .executive-dashboard-report { display: block !important; }
          .executive-dashboard-report section, .executive-dashboard-report > div { break-inside: avoid; }
          body { background: white !important; }
        }
      `}</style>
      <PageHeader
        title="Inteligência executiva"
        subtitle="Faturamento, produtividade e retenção da sua barbearia"
        actions={
          <div className="dashboard-print-hide flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!analytics}
              onClick={() => analytics && downloadDashboardCsv(analytics, range)}
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
            <Button variant="outline" size="sm" disabled={!analytics} onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Salvar PDF
            </Button>
          </div>
        }
      />

      <div className="dashboard-print-hide mb-5 flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
          {(
            [
              ["today", "Hoje"],
              ["7days", "Últimos 7 dias"],
              ["month", "Este mês"],
              ["custom", "Personalizado"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={preset === key ? "default" : "ghost"}
              onClick={() => setPreset(key)}
            >
              {label}
            </Button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs text-muted-foreground">
              De
              <input
                aria-label="Data inicial"
                className="h-9 rounded-md border bg-background px-3 text-sm text-foreground"
                type="date"
                value={customStart}
                max={customEnd}
                onChange={(event) => setCustomStart(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Até
              <input
                aria-label="Data final"
                className="h-9 rounded-md border bg-background px-3 text-sm text-foreground"
                type="date"
                value={customEnd}
                min={customStart}
                max={today}
                onChange={(event) => setCustomEnd(event.target.value)}
              />
            </label>
          </div>
        )}
        <span className="pb-2 text-xs text-muted-foreground">
          {dateLabel}
          {isFetching && !isLoading ? " · Atualizando…" : ""}
        </span>
      </div>

      {error && (
        <div role="alert" className="mb-5 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-medium">Não foi possível carregar os dados do painel.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {(error as Error).message}. Confirme que as migrações do banco estão aplicadas e tente
            novamente.
          </p>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {isLoading && !data ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Carregando dados da sua barbearia…
        </div>
      ) : analytics ? (
        <div className="executive-dashboard-report space-y-5">
          {!(data?.professionals.length ?? 0) && !(data?.services.length ?? 0) && (
            <section className="dashboard-print-hide rounded-lg border border-primary/30 bg-accent p-4 text-accent-foreground">
              <p className="font-semibold">Configure sua barbearia para começar</p>
              <p className="mt-1 text-sm">
                Cadastre profissionais e serviços para acompanhar a ocupação, as vendas e as comissões.
              </p>
              <Button asChild className="mt-3" size="sm">
                <Link to="/profissionais">Cadastrar profissionais</Link>
              </Button>
            </section>
          )}
          <section aria-label="Indicadores executivos" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label="Faturamento recebido"
              value={brl(analytics.revenue)}
              hint={`${analytics.closedOrders} comandas fechadas`}
              tone="positive"
            />
            <MetricCard
              label="Ticket médio por atendimento"
              value={brl(analytics.averageTicket)}
              hint={`${analytics.completedAppointments} atendimentos concluídos`}
            />
            <MetricCard
              label="Receita recorrente · assinaturas ativas"
              value={brl(analytics.subscriptionMrr)}
              hint={`MRR estimado · ${brl(analytics.recurringRevenue)} recebido no período`}
              tone="positive"
            />
            <MetricCard
              label="Ocupação da agenda"
              value={`${analytics.occupationRate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
              hint={`${Math.round(analytics.occupiedMinutes / 60)}h ocupadas de ${Math.round(analytics.availableMinutes / 60)}h disponíveis`}
              tone={analytics.occupationRate >= 75 ? "positive" : "default"}
            />
            <MetricCard
              label="Retenção de clientes"
              value={`${analytics.retentionRate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
              hint={`${analytics.retainedClients} de ${analytics.retainedClients + analytics.churnedClients} clientes ativos na janela anterior retornaram`}
              tone="positive"
            />
            <MetricCard
              label="Churn no período"
              value={`${analytics.churnRate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
              hint={`${analytics.churnedClients} clientes da janela anterior sem retorno`}
              tone={analytics.churnRate > 20 ? "warning" : "default"}
            />
            <MetricCard
              label="Faturamento avulso"
              value={brl(analytics.oneOffRevenue)}
              hint={`${brl(analytics.revenue)} de receitas realizadas no total`}
              tone="positive"
            />
            <MetricCard
              label="Resultado financeiro"
              value={brl(analytics.operatingResult)}
              hint={`${brl(analytics.netRevenue)} líquidos após taxas · ${brl(analytics.expenses)} em despesas`}
              tone={analytics.operatingResult >= 0 ? "positive" : "warning"}
            />
          </section>

          <section className="rounded-xl border bg-card p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="font-semibold">Evolução do faturamento</h2>
                <p className="text-xs text-muted-foreground">
                  Receita realizada por dia{analytics.dailyRevenue.length > 90 ? " e mês" : ""}
                </p>
              </div>
              <p className="text-sm font-medium">{brl(analytics.revenue)} no período</p>
            </div>
            <div className="h-64 w-full" aria-label="Gráfico de faturamento diário">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.dailyRevenue} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value: string) =>
                      value.length === 7
                        ? value
                        : new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                          })
                    }
                    minTickGap={24}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    width={64}
                    tickFormatter={(value: number) =>
                      value.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 })
                    }
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    labelFormatter={(value) =>
                      String(value).length === 7
                        ? value
                        : new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR")
                    }
                    formatter={(value) => [brl(Number(value)), "Receita"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
            <div className="overflow-hidden rounded-xl border bg-card">
              <h2 className="border-b px-4 py-3 font-semibold">Desempenho por profissional</h2>
              {analytics.professionals.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Profissional</th>
                        <th className="px-4 py-3 text-right">Faturamento</th>
                        <th className="px-4 py-3 text-right">Cortes</th>
                        <th className="px-4 py-3 text-right">Comissão</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {analytics.professionals.map((professional: any, index: number) => (
                        <tr key={professional.id}>
                          <td className="px-4 py-3">
                            <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                            {professional.name}
                          </td>
                          <td className="px-4 py-3 text-right">{brl(professional.revenue)}</td>
                          <td className="px-4 py-3 text-right">{professional.cuts ?? 0}</td>
                          <td className="px-4 py-3 text-right">{brl(professional.commissions)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="p-5 text-center text-sm text-muted-foreground">
                  Sem comandas concluídas no período.
                </p>
              )}
            </div>
            <div className="grid gap-5">
              <RankingList title="Serviços mais vendidos" rows={analytics.bestServices} unit="un." />
              <RankingList title="Produtos mais vendidos" rows={analytics.bestProducts} unit="un." />
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <h2 className="mb-2 font-semibold">Clientes no período</h2>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xl font-semibold">{analytics.newClients}</p>
                  <p className="text-xs text-muted-foreground">Novos</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xl font-semibold">{analytics.returningClients}</p>
                  <p className="text-xs text-muted-foreground">Recorrentes</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xl font-semibold">{analytics.inactiveClients}</p>
                  <p className="text-xs text-muted-foreground">Inativos</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold">Agenda de hoje</h2>
                <Link to="/agenda" className="text-sm text-primary">
                  Ver agenda
                </Link>
              </div>
              {appointmentToday.length ? (
                <ul className="divide-y">
                  {appointmentToday.slice(0, 5).map((appointment: any) => (
                    <li key={appointment.id} className="py-2 text-sm">
                      <span className="mr-3 font-semibold">{fmtTime(appointment.starts_at)}</span>
                      {clientsById.get(appointment.client_id) ?? "Cliente"}
                      <span className="text-muted-foreground">
                        {" "}
                        · {servicesById.get(appointment.service_id) ?? "Serviço"} ·{" "}
                        {professionalsById.get(appointment.professional_id) ?? "Profissional"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Nenhum horário agendado hoje.
                </p>
              )}
            </div>
          </section>
          <section className="dashboard-print-hide rounded-xl border bg-card">
            <h2 className="border-b px-4 py-3 font-semibold">Estoque baixo</h2>
            {data?.lowProducts.length ? (
              <ul className="divide-y">
                {data.lowProducts.slice(0, 5).map((product: any) => (
                  <li key={product.id} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
                    <span>{product.name}</span>
                    <span className="font-medium text-destructive">
                      {Number(product.stock)} / mín. {Number(product.min_stock)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-4 text-center text-sm text-muted-foreground">Tudo em dia.</p>
            )}
          </section>
          <div className="dashboard-print-hide flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span>{data?.openOrders ?? 0} comandas abertas</span>
            <Link to="/financeiro" className="text-primary">
              Abrir financeiro
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-6">
          <p className="font-medium">A inteligência do salão aparece aqui.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Assim que existirem comandas, lançamentos e atendimentos, seus indicadores serão
            calculados para o período escolhido.
          </p>
          <Button asChild className="mt-4" size="sm">
            <Link to="/profissionais">Configurar equipe</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
