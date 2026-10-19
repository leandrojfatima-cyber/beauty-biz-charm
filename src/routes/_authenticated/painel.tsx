import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import {
  Download,
  Printer,
  RefreshCw,
  Flame,
  MessageCircle,
  Copy,
  Check,
  Sparkles,
  TrendingUp,
  DollarSign,
  Users,
  Clock,
  ArrowUpRight,
  TrendingDown,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { brl, fmtTime, todayISO } from "@/lib/db";
import { monthRange } from "@/lib/period";
import {
  dashboardDateKey,
  downloadDashboardCsv,
  periodRange,
} from "@/lib/dashboard-engine";
import { loadExecutiveDashboard } from "@/lib/dashboard-data";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Inteligência Executiva — Belezi" },
      {
        name: "description",
        content: "Acompanhe faturamento, produtividade, fluxo de caixa, módulo PUMP e retenção da sua barbearia.",
      },
    ],
  }),
  component: Painel,
});

type PeriodPreset = "today" | "7days" | "month" | "custom";

function MetricCard({
  label,
  value,
  subvalue,
  hint,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: string;
  subvalue?: string;
  hint?: string;
  tone?: "default" | "positive" | "warning" | "accent";
  icon?: any;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs transition-all hover:border-primary/30">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon && (
          <div
            className={`p-1.5 rounded-lg ${
              tone === "positive"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : tone === "warning"
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : tone === "accent"
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    : "bg-muted text-muted-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="mt-2.5 flex items-baseline gap-2">
        <p
          className={`text-2xl font-bold tracking-tight ${
            tone === "positive"
              ? "text-emerald-600 dark:text-emerald-400"
              : tone === "warning"
                ? "text-amber-600 dark:text-amber-400"
                : tone === "accent"
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-foreground"
          }`}
        >
          {value}
        </p>
        {subvalue && <span className="text-xs font-medium text-muted-foreground">{subvalue}</span>}
      </div>

      {hint && <p className="mt-1 text-xs text-muted-foreground/90">{hint}</p>}
    </div>
  );
}

function RankingList({
  title,
  rows,
  unit,
}: {
  title: string;
  rows?: Array<{ id: string; name: string; quantity?: number; revenue: number }>;
  unit: string;
}) {
  const safeRows = Array.isArray(rows) ? rows : [];

  return (
    <section className="rounded-xl border bg-card">
      <h2 className="border-b px-4 py-3 font-semibold text-sm">{title}</h2>
      {safeRows.length > 0 ? (
        <ol className="divide-y text-sm">
          {safeRows.slice(0, 5).map((row, index) => (
            <li
              key={row?.id || `rank-${index}`}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <span className="min-w-0 truncate">
                <span className="mr-2 text-xs font-semibold text-muted-foreground">{index + 1}.</span>
                <span className="font-medium">{row?.name ?? "Item"}</span>
                {row?.quantity !== undefined && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    · {row?.quantity ?? 0} {unit}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-semibold">{brl(row?.revenue ?? 0)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="p-5 text-center text-xs text-muted-foreground">
          Sem movimentações no período selecionado.
        </p>
      )}
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-2.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-3 w-44" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-3">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-64 w-full" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-44 w-full" />
        </div>
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-44 w-full" />
        </div>
      </div>
    </div>
  );
}

export function Painel() {
  const today = todayISO();
  const defaultRange = monthRange(today.slice(0, 7));
  const [preset, setPreset] = useState<PeriodPreset>("month");
  const [customStart, setCustomStart] = useState(defaultRange.start);
  const [customEnd, setCustomEnd] = useState(today);
  const [chartView, setChartView] = useState<"cashflow" | "revenue">("cashflow");
  const [copiedPromoId, setCopiedPromoId] = useState<string | null>(null);

  // Consulta defensiva do usuário atual para saudação personalizada
  const { data: user } = useQuery({
    queryKey: ["current-user-painel"],
    queryFn: async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) return data.user;
        if (typeof window !== "undefined") {
          const mock = localStorage.getItem("belezi_preview_user");
          if (mock) return JSON.parse(mock);
        }
        return null;
      } catch {
        return null;
      }
    },
  });

  const userName =
    user?.user_metadata?.name ||
    user?.user_metadata?.full_name ||
    (user?.email ? user.email.split("@")[0] : null) ||
    "Gestor";

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
    if (!appointment) return false;
    const rawDate =
      appointment?.starts_at ||
      appointment?.appointment_date ||
      appointment?.scheduled_at ||
      appointment?.date;
    const date = dashboardDateKey(rawDate);
    const status = String(appointment?.status ?? "").toLowerCase();
    return date === today && status !== "cancelado";
  });

  const clientsById = new Map<string, string>(
    (data?.clients ?? [])
      .filter(Boolean)
      .map((client: any) => [client?.id ?? "", client?.name ?? "Cliente"] as [string, string]),
  );

  const servicesById = new Map<string, string>(
    (data?.services ?? [])
      .filter(Boolean)
      .map((service: any) => [service?.id ?? "", service?.name ?? "Serviço"] as [string, string]),
  );

  const professionalsById = new Map<string, string>(
    (data?.professionals ?? [])
      .filter(Boolean)
      .map((professional: any) => [
        professional?.id ?? "",
        professional?.name ?? "Profissional",
      ] as [string, string]),
  );

  const dateLabel =
    range.start === range.end
      ? new Date(`${range.start}T12:00:00`).toLocaleDateString("pt-BR")
      : `${new Date(`${range.start}T12:00:00`).toLocaleDateString("pt-BR")} – ${new Date(`${range.end}T12:00:00`).toLocaleDateString("pt-BR")}`;

  const copyPromoText = (id: string, text: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedPromoId(id);
      toast.success("Texto da campanha copiado!", {
        description: "Cole no WhatsApp ou nas redes sociais para divulgar.",
      });
      setTimeout(() => setCopiedPromoId(null), 3000);
    } catch {
      toast.error("Não foi possível copiar o texto automaticamente.");
    }
  };

  return (
    <div className="space-y-6 pb-12">
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
        title="Inteligência Executiva & Estratégica"
        subtitle={`Olá, ${userName}! Acompanhe faturamento, ocupação, retenção e recomendações do Belezi Engine.`}
        actions={
          <div className="dashboard-print-hide flex flex-wrap gap-2">
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
            <Button
              variant="outline"
              size="sm"
              disabled={!analytics}
              onClick={() => window.print()}
            >
              <Printer className="mr-2 h-4 w-4" />
              Salvar PDF
            </Button>
          </div>
        }
      />

      {/* Barra de Filtros por Período */}
      <div className="dashboard-print-hide flex flex-wrap items-end gap-3 bg-muted/30 p-2.5 rounded-xl border">
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
              className="text-xs h-8"
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
                className="h-8 rounded-md border bg-background px-2.5 text-xs text-foreground"
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
                className="h-8 rounded-md border bg-background px-2.5 text-xs text-foreground"
                type="date"
                value={customEnd}
                min={customStart}
                max={today}
                onChange={(event) => setCustomEnd(event.target.value)}
              />
            </label>
          </div>
        )}

        <span className="pb-1.5 text-xs text-muted-foreground font-medium">
          {dateLabel}
          {isFetching && !isLoading ? " · Atualizando dados…" : ""}
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-4"
        >
          <p className="font-semibold text-destructive text-sm">Falha na consulta do painel</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {(error as Error)?.message || "Ocorreu uma falha na consulta de dados."}. O sistema
            continua operacional.
          </p>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {isLoading && !data ? (
        <DashboardSkeleton />
      ) : analytics ? (
        <div className="executive-dashboard-report space-y-6">
          {/* ========================================================================= */}
          {/* 1. MÉTRICAS EXECUTIVAS DE TOPO (ETAPA 12) */}
          {/* ========================================================================= */}
          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Métricas Executivas Principais
              </h2>
              <span className="text-xs text-muted-foreground">Período selecionado</span>
            </div>

            <section
              aria-label="Indicadores executivos principais"
              className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4"
            >
              {/* Card 1: Faturamento Realizado vs. Previsto */}
              <MetricCard
                label="Faturamento Realizado vs. Previsto"
                value={brl(analytics?.revenue ?? 0)}
                subvalue={`/ ${brl(analytics?.projectedRevenue ?? analytics?.revenue ?? 0)}`}
                hint={`Meta/Projeção atingida em ${Math.round(
                  ((analytics?.revenue ?? 0) /
                    Math.max(1, analytics?.projectedRevenue ?? analytics?.revenue ?? 1)) *
                    100,
                )}% · ${analytics?.closedOrders ?? 0} comandas fechadas`}
                tone="positive"
                icon={TrendingUp}
              />

              {/* Card 2: Despesas Operacionais */}
              <MetricCard
                label="Despesas Operacionais"
                value={brl(analytics?.expenses ?? 0)}
                hint={`${
                  (analytics?.revenue ?? 0) > 0
                    ? (((analytics?.expenses ?? 0) / Math.max(1, analytics?.revenue ?? 1)) * 100).toFixed(1)
                    : "0.0"
                }% do faturamento realizado total`}
                tone={(analytics?.expenses ?? 0) > 0 ? "warning" : "default"}
                icon={TrendingDown}
              />

              {/* Card 3: Margem de Lucro (%) */}
              <MetricCard
                label="Margem de Lucro Líquida"
                value={`${(analytics?.profitMargin ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
                hint={`Resultado operacional líquido: ${brl(analytics?.operatingResult ?? 0)}`}
                tone={
                  (analytics?.profitMargin ?? 0) >= 25
                    ? "positive"
                    : (analytics?.profitMargin ?? 0) > 0
                      ? "default"
                      : "warning"
                }
                icon={DollarSign}
              />

              {/* Card 4: Ticket Médio por Atendimento */}
              <MetricCard
                label="Ticket Médio por Atendimento"
                value={brl(analytics?.averageTicket ?? 0)}
                hint={`${analytics?.completedAppointments ?? 0} cortes/atendimentos concluídos`}
                tone="accent"
                icon={Users}
              />
            </section>
          </div>

          {/* Sub-grid de Indicadores Complementares de Apoio */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border bg-card p-3.5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Receita Recorrente (MRR)
                </p>
                <p className="text-lg font-bold text-foreground mt-0.5">
                  {brl(analytics?.subscriptionMrr ?? 0)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {brl(analytics?.recurringRevenue ?? 0)} recebido no período
                </p>
              </div>
              <Sparkles className="h-5 w-5 text-purple-500 opacity-80" />
            </div>

            <div className="rounded-xl border bg-card p-3.5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Ocupação Global da Agenda
                </p>
                <p className="text-lg font-bold text-foreground mt-0.5">
                  {(analytics?.occupationRate ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {Math.round((analytics?.occupiedMinutes ?? 0) / 60)}h ocupadas de{" "}
                  {Math.round((analytics?.availableMinutes ?? 0) / 60)}h
                </p>
              </div>
              <Clock className="h-5 w-5 text-blue-500 opacity-80" />
            </div>

            <div className="rounded-xl border bg-card p-3.5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Retenção de Clientes
                </p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {(analytics?.retentionRate ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {analytics?.retainedClients ?? 0} clientes retornaram
                </p>
              </div>
              <Users className="h-5 w-5 text-emerald-500 opacity-80" />
            </div>

            <div className="rounded-xl border bg-card p-3.5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Clientes Ativos / Novos
                </p>
                <p className="text-lg font-bold text-foreground mt-0.5">
                  {analytics?.activeClients ?? 0}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({analytics?.newClients ?? 0} novos)
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Base total: {analytics?.clientCount ?? 0} cadastrados
                </p>
              </div>
              <ArrowUpRight className="h-5 w-5 text-primary opacity-80" />
            </div>
          </section>

          {/* ========================================================================= */}
          {/* 2. GRÁFICO DE DESEMPENHO E FLUXO DE CAIXA DO PERÍODO (ETAPA 12) */}
          {/* ========================================================================= */}
          <section className="rounded-xl border bg-card p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <div>
                <h2 className="font-semibold text-base">Desempenho e Fluxo de Caixa do Período</h2>
                <p className="text-xs text-muted-foreground">
                  Acompanhamento de entradas (receitas), saídas (despesas operacionais) e saldo consolidado.
                </p>
              </div>

              {/* Seletor de Modo de Gráfico */}
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border bg-muted/40 p-0.5 text-xs">
                  <button
                    onClick={() => setChartView("cashflow")}
                    className={`px-3 py-1 rounded-md font-medium transition-all ${
                      chartView === "cashflow" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    Fluxo de Caixa (Entradas vs Despesas)
                  </button>
                  <button
                    onClick={() => setChartView("revenue")}
                    className={`px-3 py-1 rounded-md font-medium transition-all ${
                      chartView === "revenue" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    Curva de Receita
                  </button>
                </div>
              </div>
            </div>

            {/* Resumo Financeiro do Gráfico */}
            <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs sm:text-sm">
              <div className="rounded-lg bg-emerald-500/10 p-2.5 border border-emerald-500/20">
                <span className="text-[11px] font-medium text-muted-foreground uppercase">Receita Realizada</span>
                <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {brl(analytics?.revenue ?? 0)}
                </p>
              </div>
              <div className="rounded-lg bg-amber-500/10 p-2.5 border border-amber-500/20">
                <span className="text-[11px] font-medium text-muted-foreground uppercase">Despesas Totais</span>
                <p className="text-base font-bold text-amber-600 dark:text-amber-400">
                  {brl(analytics?.expenses ?? 0)}
                </p>
              </div>
              <div className="rounded-lg bg-primary/10 p-2.5 border border-primary/20">
                <span className="text-[11px] font-medium text-muted-foreground uppercase">Saldo Líquido</span>
                <p className="text-base font-bold text-primary">
                  {brl(analytics?.operatingResult ?? 0)}
                </p>
              </div>
            </div>

            <div className="h-72 w-full" aria-label="Gráfico de fluxo de caixa e faturamento">
              <ResponsiveContainer width="100%" height="100%">
                {chartView === "cashflow" ? (
                  <ComposedChart
                    data={analytics?.cashFlow ?? []}
                    margin={{ top: 10, right: 12, left: 4, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value: string) =>
                        String(value || "").length === 7
                          ? String(value)
                          : new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                            })
                      }
                      minTickGap={20}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      width={68}
                      tickFormatter={(value: number) =>
                        (Number(value) || 0).toLocaleString("pt-BR", {
                          notation: "compact",
                          maximumFractionDigits: 1,
                        })
                      }
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      labelFormatter={(value) =>
                        String(value || "").length === 7
                          ? String(value)
                          : new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR")
                      }
                      formatter={(value: any, name: any) => [
                        brl(Number(value) || 0),
                        name === "revenue"
                          ? "Receitas"
                          : name === "expenses"
                            ? "Despesas"
                            : "Saldo Diário",
                      ]}
                    />
                    <Legend
                      formatter={(value) =>
                        value === "revenue"
                          ? "Receitas (Entradas)"
                          : value === "expenses"
                            ? "Despesas (Saídas)"
                            : "Saldo Diário"
                      }
                    />
                    <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="expenses" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Line
                      type="monotone"
                      dataKey="balance"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </ComposedChart>
                ) : (
                  <LineChart
                    data={analytics?.dailyRevenue ?? []}
                    margin={{ top: 10, right: 12, left: 4, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value: string) =>
                        String(value || "").length === 7
                          ? String(value)
                          : new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                            })
                      }
                      minTickGap={24}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      width={68}
                      tickFormatter={(value: number) =>
                        (Number(value) || 0).toLocaleString("pt-BR", {
                          notation: "compact",
                          maximumFractionDigits: 1,
                        })
                      }
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      labelFormatter={(value) =>
                        String(value || "").length === 7
                          ? String(value)
                          : new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR")
                      }
                      formatter={(value) => [brl(Number(value) || 0), "Receita"]}
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
                )}
              </ResponsiveContainer>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* 3. INDICADORES DE OCUPAÇÃO DA EQUIPE & HORÁRIOS DE PICO (ETAPA 12) */}
          {/* ========================================================================= */}
          <div className="grid gap-5 xl:grid-cols-2">
            {/* Lado A: Taxa de Ocupação por Barbeiro */}
            <section className="rounded-xl border bg-card p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b pb-3 mb-3">
                  <div>
                    <h2 className="font-semibold text-sm sm:text-base">Taxa de Ocupação por Barbeiro</h2>
                    <p className="text-xs text-muted-foreground">
                      Produtividade e aproveitamento de bancada individual.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {(analytics?.proOccupancy?.length ?? 0)} profissionais
                  </Badge>
                </div>

                {(analytics?.proOccupancy?.length ?? 0) > 0 ? (
                  <div className="space-y-4">
                    {(analytics?.proOccupancy ?? []).map((pro: any) => {
                      const rate = Number(pro?.occupationRate ?? 0);
                      return (
                        <div key={pro?.id} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-foreground">{pro?.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">
                                {pro?.cuts ?? 0} cortes · {brl(pro?.revenue ?? 0)}
                              </span>
                              <span
                                className={`font-bold ${
                                  rate >= 70
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : rate >= 40
                                      ? "text-blue-600 dark:text-blue-400"
                                      : "text-amber-600 dark:text-amber-400"
                                }`}
                              >
                                {rate}%
                              </span>
                            </div>
                          </div>
                          <Progress
                            value={rate}
                            className={`h-2 ${
                              rate >= 70
                                ? "[&>div]:bg-emerald-500"
                                : rate >= 40
                                  ? "[&>div]:bg-blue-500"
                                  : "[&>div]:bg-amber-500"
                            }`}
                          />
                          <p className="text-[10px] text-muted-foreground text-right">
                            {Math.round((pro?.occupiedMinutes ?? 0) / 60)}h atendidas de{" "}
                            {Math.round((pro?.availableMinutes ?? 0) / 60)}h de escala
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    Cadastre profissionais e horários para acompanhar a ocupação da equipe.
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t text-xs text-muted-foreground flex items-center justify-between">
                <span>Otimização sugerida: Média ideal entre 65% e 85%</span>
                <Link to="/profissionais" className="text-primary hover:underline font-medium">
                  Gerenciar equipe
                </Link>
              </div>
            </section>

            {/* Lado B: Identificação Gráfica dos Horários de Pico */}
            <section className="rounded-xl border bg-card p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b pb-3 mb-3">
                  <div>
                    <h2 className="font-semibold text-sm sm:text-base flex items-center gap-1.5">
                      <Flame className="h-4 w-4 text-amber-500" />
                      Horários de Pico & Concentração da Agenda
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Distribuição de demanda por faixas horárias do expediente.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {(analytics?.hourlyDistribution ?? []).map((slot: any) => (
                    <div
                      key={slot?.slot}
                      className={`rounded-lg border p-3 flex flex-col justify-between transition-all ${
                        slot?.isPeak
                          ? "border-amber-500/60 bg-amber-500/10 dark:bg-amber-950/20 shadow-xs"
                          : slot?.isLow
                            ? "border-blue-500/30 bg-blue-500/5"
                            : "bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs">{slot?.slot}</span>
                        {slot?.isPeak && (
                          <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[9px] px-1.5 py-0 h-4">
                            🔥 Pico
                          </Badge>
                        )}
                        {slot?.isLow && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-500/40 text-blue-600">
                            Vago
                          </Badge>
                        )}
                      </div>

                      <div className="mt-2.5">
                        <p className="text-lg font-bold text-foreground">{slot?.count ?? 0}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {slot?.percentage ?? 0}% do total de clientes
                        </p>
                      </div>

                      <Progress value={slot?.percentage ?? 0} className="h-1 mt-2" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t text-xs text-muted-foreground">
                Dica Belezi: Crie promoções nas faixas identificadas como "Vago" para equilibrar a demanda semanal.
              </div>
            </section>
          </div>

          {/* ========================================================================= */}
          {/* 4. MÓDULO PUMP & RETENÇÃO DE CLIENTES (ETAPA 12) */}
          {/* ========================================================================= */}
          <section className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <div>
                <h2 className="font-semibold text-base flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Módulo PUMP — Recuperação de Clientes Ausentes (+30 dias)
                </h2>
                <p className="text-xs text-muted-foreground">
                  Identificação automática de clientes em risco de abandono com atalho instantâneo para reativação no WhatsApp.
                </p>
              </div>
              <Badge variant="secondary" className="text-xs">
                {(analytics?.absentClients?.length ?? 0)} clientes precisam de contato
              </Badge>
            </div>

            {(analytics?.absentClients?.length ?? 0) > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3.5 py-2.5">Cliente</th>
                      <th className="px-3.5 py-2.5">Telefone</th>
                      <th className="px-3.5 py-2.5">Tempo sem Retorno</th>
                      <th className="px-3.5 py-2.5">Última Visita</th>
                      <th className="px-3.5 py-2.5 text-right">Ação Rápida PUMP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(analytics?.absentClients ?? []).slice(0, 6).map((c: any) => (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3.5 py-2.5 font-medium text-foreground">{c.name}</td>
                        <td className="px-3.5 py-2.5 text-muted-foreground">{c.phone || "Não informado"}</td>
                        <td className="px-3.5 py-2.5">
                          <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-xs">
                            {c.daysAbsent} dias ausente
                          </Badge>
                        </td>
                        <td className="px-3.5 py-2.5 text-muted-foreground text-xs">
                          {c.lastVisit
                            ? new Date(`${c.lastVisit}T12:00:00`).toLocaleDateString("pt-BR")
                            : "Sem visitas recentes"}
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          {c.whatsappUrl ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                              onClick={() => window.open(c.whatsappUrl, "_blank", "noopener,noreferrer")}
                            >
                              <MessageCircle className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                              Reativar no WhatsApp
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem telefone</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-muted-foreground space-y-1">
                <Check className="h-6 w-6 text-emerald-500 mx-auto" />
                <p className="font-medium text-foreground">Excelente retenção!</p>
                <p>Nenhum cliente está ausente há mais de 30 dias na janela analisada.</p>
              </div>
            )}
          </section>

          {/* ========================================================================= */}
          {/* 5. RECOMENDAÇÕES ESTRATÉGICAS DE PROMOÇÕES (ETAPA 12) */}
          {/* ========================================================================= */}
          <section className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="font-semibold text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  Recomendações Estratégicas de Promoções Automáticas
                </h2>
                <p className="text-xs text-muted-foreground">
                  Campanhas orientadas a dados para preencher horários ociosos e alavancar a receita da barbearia.
                </p>
              </div>
            </div>

            <div className="grid gap-3.5 md:grid-cols-3">
              {(analytics?.idleSlotPromotions ?? []).map((promo: any) => (
                <div
                  key={promo.id}
                  className="rounded-xl border bg-muted/20 p-4 flex flex-col justify-between space-y-3 hover:border-primary/40 transition-all"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-foreground">{promo.title}</h3>
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                        {promo.suggestedDiscount}
                      </Badge>
                    </div>
                    <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3 text-primary" /> {promo.targetSlot}
                    </p>
                    <p className="text-xs text-muted-foreground/90">{promo.description}</p>
                  </div>

                  <div className="pt-2 border-t space-y-2">
                    <div className="rounded bg-background p-2 text-[11px] text-muted-foreground italic border">
                      "{promo.suggestedCopy}"
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs h-7.5"
                      onClick={() => copyPromoText(promo.id, promo.suggestedCopy)}
                    >
                      {copiedPromoId === promo.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 mr-1 text-emerald-500" /> Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 mr-1" /> Copiar Campanha
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ========================================================================= */}
          {/* RANKINGS DE SERVIÇOS E PRODUTOS */}
          {/* ========================================================================= */}
          <div className="grid gap-5 md:grid-cols-2">
            <RankingList
              title="Serviços Mais Vendidos no Período"
              rows={analytics?.bestServices ?? []}
              unit="atendimentos"
            />
            <RankingList
              title="Produtos Mais Vendidos no Período"
              rows={analytics?.bestProducts ?? []}
              unit="unidades"
            />
          </div>

          {/* Agenda de Hoje & Alerta de Estoque Baixo */}
          <section className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold text-sm">Agenda de Hoje ({appointmentToday.length} horários)</h2>
                <Link to="/agenda" className="text-xs text-primary font-medium hover:underline">
                  Abrir agenda completa →
                </Link>
              </div>
              {appointmentToday.length > 0 ? (
                <ul className="divide-y text-xs sm:text-sm">
                  {appointmentToday.slice(0, 5).map((appointment: any, idx: number) => {
                    const rawTime =
                      appointment?.starts_at ||
                      appointment?.appointment_date ||
                      appointment?.scheduled_at ||
                      appointment?.start_time ||
                      appointment?.date;
                    return (
                      <li
                        key={appointment?.id || `app-${idx}`}
                        className="py-2.5 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-foreground">
                            {rawTime ? fmtTime(rawTime) : "--:--"}
                          </span>
                          <span className="truncate">
                            {clientsById.get(appointment?.client_id) ?? "Cliente"}
                            <span className="text-muted-foreground">
                              {" "}
                              · {servicesById.get(appointment?.service_id) ?? "Serviço"}
                            </span>
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {professionalsById.get(appointment?.professional_id) ?? "Profissional"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Nenhum horário marcado para hoje até o momento.
                </p>
              )}
            </div>

            <div className="dashboard-print-hide rounded-xl border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold text-sm">Alertas de Estoque Crítico</h2>
                <Link to="/produtos" className="text-xs text-primary font-medium hover:underline">
                  Gerenciar estoque →
                </Link>
              </div>
              {(data?.lowProducts?.length ?? 0) > 0 ? (
                <ul className="divide-y text-xs sm:text-sm">
                  {(data?.lowProducts ?? []).slice(0, 5).map((product: any, idx: number) => (
                    <li
                      key={product?.id || `prod-${idx}`}
                      className="flex justify-between items-center gap-3 py-2.5"
                    >
                      <span className="font-medium text-foreground">{product?.name ?? "Produto"}</span>
                      <span className="font-bold text-destructive text-xs">
                        {Number(product?.stock ?? 0)} un. (mínimo: {Number(product?.min_stock ?? 0)})
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Nenhum produto abaixo do estoque mínimo.
                </p>
              )}
            </div>
          </section>

          {/* Rodapé Informativo */}
          <div className="dashboard-print-hide flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground pt-2">
            <span>{data?.openOrders ?? 0} comandas em aberto no sistema</span>
            <div className="flex gap-4">
              <Link to="/financeiro" className="text-primary hover:underline font-medium">
                Abrir fluxo financeiro
              </Link>
              <Link to="/agenda" className="text-primary hover:underline font-medium">
                Abrir grade de agendamentos
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-8 text-center">
          <p className="font-semibold text-foreground">A inteligência do salão aparece aqui.</p>
          <p className="mt-1.5 text-xs text-muted-foreground max-w-md mx-auto">
            Assim que existirem comandas, lançamentos e atendimentos, seus indicadores serão
            calculados em tempo real para o período escolhido.
          </p>
          <Button asChild className="mt-4" size="sm">
            <Link to="/profissionais">Configurar equipe</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
export default Painel;
