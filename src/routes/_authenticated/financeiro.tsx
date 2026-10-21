import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Clock,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Filter,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Search,
  Percent,
  CreditCard,
  Building2,
  ShieldCheck,
  Check,
  DollarSign,
  PieChart,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Stat } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { brl, db, fmtDate, todayISO } from "@/lib/db";
import { currentMonth, monthRange } from "@/lib/period";
import { useProfessionals } from "@/lib/lookups";
import {
  calculateCashFlowStats,
  calculateNetTransactionAmount,
  exportTransactionsToCsv,
  FINANCIAL_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/financial-engine";
import {
  loadPodiumPayRates,
  savePodiumPayRates,
  loadPodiumReceivables,
  executeAnticipation,
  simulateAnticipation,
  calculatePaymentSplit,
  type PodiumPayRates,
  type FutureReceivable,
} from "@/services/payments";
import type {
  FinancialCategory,
  FinancialTransactionRecord,
  PaymentMethod,
  TransactionStatus,
  TransactionType,
} from "@/types/financial";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro & Fluxo de Caixa — Belezi" },
      {
        name: "description",
        content:
          "Fluxo de caixa completo da barbearia: receitas, despesas, contas a pagar e receber, previsto vs realizado e taxas.",
      },
    ],
  }),
  component: FinanceiroPage,
});

function FinanceiroPage() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const { start, end } = monthRange(month);

  const [activeTab, setActiveTab] = useState<
    "fluxo" | "lancamentos" | "previsao" | "podium_pay"
  >("fluxo");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Podium Pay State
  const [podiumRates, setPodiumRates] = useState<PodiumPayRates>(() => loadPodiumPayRates());
  const [receivables, setReceivables] = useState<FutureReceivable[]>(() => loadPodiumReceivables());
  const [selectedReceivables, setSelectedReceivables] = useState<string[]>([]);
  const [simAmount, setSimAmount] = useState<number>(120);
  const [simCommissionPct, setSimCommissionPct] = useState<number>(50);
  const [simMethod, setSimMethod] = useState<string>("Pix");

  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<TransactionType>("receita");
  const [formData, setFormData] = useState<{
    type: TransactionType;
    category: FinancialCategory | string;
    description: string;
    amount: string;
    card_fee: string;
    date: string;
    due_date: string;
    status: TransactionStatus;
    payment_method: PaymentMethod | string;
    professional_id: string;
    notes: string;
  }>({
    type: "receita",
    category: "atendimento",
    description: "",
    amount: "",
    card_fee: "0",
    date: todayISO(),
    due_date: todayISO(),
    status: "realizado",
    payment_method: "pix",
    professional_id: "",
    notes: "",
  });

  const { data: pros = [] } = useProfessionals();

  // Consulta de transações do mês selecionado
  const { data: transactions = [], isLoading } = useQuery<FinancialTransactionRecord[]>({
    queryKey: ["transactions", month],
    queryFn: async () => {
      const { data, error } = await db
        .from("transactions")
        .select("*")
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) {
        console.warn("Erro ao buscar transações:", error);
        return [];
      }
      return (data ?? []) as FinancialTransactionRecord[];
    },
  });

  // Saldo anterior acumulado antes do mês corrente
  const { data: balanceBefore = 0 } = useQuery<number>({
    queryKey: ["balance-before", month],
    queryFn: async () => {
      const { data, error } = await db
        .from("transactions")
        .select("type, amount, net_amount, status")
        .lt("date", start)
        .eq("status", "realizado");
      if (error) return 0;
      return (data ?? []).reduce(
        (sum: number, t: any) =>
          sum + (t.type === "receita" ? 1 : -1) * Number(t.net_amount ?? t.amount),
        0,
      );
    },
  });

  // Salvar nova transação
  const saveMutation = useMutation({
    mutationFn: async () => {
      const gross = Number(formData.amount) || 0;
      const fee = Number(formData.card_fee) || 0;
      const net = calculateNetTransactionAmount(gross, fee);

      const payload = {
        type: formData.type,
        category: formData.category,
        description: formData.description.trim(),
        amount: gross,
        net_amount: net,
        card_fee: fee,
        date: formData.date || todayISO(),
        due_date: formData.due_date || null,
        status: formData.status,
        payment_method: formData.payment_method,
        professional_id: formData.professional_id ? formData.professional_id : null,
        notes: formData.notes.trim() || null,
      };

      const { error } = await db.from("transactions").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["balance-before"] });
      setFormOpen(false);
      resetForm("receita");
      toast.success("Lançamento financeiro registrado com sucesso!");
    },
    onError: (e: any) => toast.error(`Erro ao salvar: ${e.message}`),
  });

  // Liquidar/Realizar lançamento previsto
  const settleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from("transactions")
        .update({ status: "realizado" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["balance-before"] });
      toast.success("Lançamento marcado como Realizado!");
    },
    onError: (e: any) => toast.error(`Erro ao liquidar: ${e.message}`),
  });

  // Excluir transação
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["balance-before"] });
      toast.success("Lançamento removido");
    },
    onError: (e: any) => toast.error(`Erro ao excluir: ${e.message}`),
  });

  function resetForm(type: TransactionType) {
    setFormType(type);
    setFormData({
      type,
      category: type === "receita" ? "atendimento" : "aluguel",
      description: "",
      amount: "",
      card_fee: "0",
      date: todayISO(),
      due_date: todayISO(),
      status: "realizado",
      payment_method: "pix",
      professional_id: "",
      notes: "",
    });
  }

  function openCreateModal(type: TransactionType) {
    resetForm(type);
    setFormOpen(true);
  }

  // Estatísticas de fluxo de caixa (Realizado vs Previsto)
  const stats = useMemo(() => {
    return calculateCashFlowStats(transactions, balanceBefore);
  }, [transactions, balanceBefore]);

  // Transações filtradas
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const descMatch = (t.description || "").toLowerCase().includes(q);
        const catMatch = (FINANCIAL_CATEGORY_LABELS[t.category] || t.category)
          .toLowerCase()
          .includes(q);
        if (!descMatch && !catMatch) return false;
      }
      return true;
    });
  }, [transactions, statusFilter, typeFilter, categoryFilter, searchQuery]);

  // Contas a pagar e receber (Previstos)
  const pendingTransactions = useMemo(() => {
    return transactions.filter((t) => t.status === "previsto");
  }, [transactions]);

  // Agrupamento diário do fluxo de caixa
  const dailyFlow = useMemo(() => {
    const days: Record<string, { date: string; in: number; out: number; balance: number }> = {};
    for (const t of transactions) {
      if (t.status === "cancelado") continue;
      const d = (days[t.date] ??= { date: t.date, in: 0, out: 0, balance: 0 });
      const val = Number(t.net_amount ?? t.amount) || 0;
      if (t.type === "receita") {
        d.in += val;
      } else {
        d.out += val;
      }
      d.balance = d.in - d.out;
    }
    return Object.values(days).sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions]);

  return (
    <div className="space-y-6">
      {/* Header & Controles de Período */}
      <PageHeader
        title="Financeiro & Fluxo de Caixa"
        subtitle="Controle operacional completo de entradas, saídas, previsto vs realizado e taxas"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1 text-sm shadow-xs">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="bg-transparent text-sm font-medium outline-hidden"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => exportTransactionsToCsv(transactions, `financeiro_${month}.csv`)}
              disabled={transactions.length === 0}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar</span> CSV
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => openCreateModal("receita")}
              className="gap-1.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400"
            >
              <Plus className="h-4 w-4" />
              Receita
            </Button>

            <Button
              size="sm"
              onClick={() => openCreateModal("despesa")}
              className="gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Plus className="h-4 w-4" />
              Despesa
            </Button>
          </div>
        }
      />

      {/* Banner de Separação Rigorosa do Financeiro (Isolamento por salon_id) */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-primary mt-0.5" />
          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-primary">
                Separação Financeira Rigorosa & Isolamento de Dados
              </span>
              <Badge variant="outline" className="border-primary/30 text-xs text-primary">
                Etapa 10 Conforme
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Este módulo gerencia exclusivamente o <strong>caixa operacional da sua barbearia</strong>{" "}
              (atendimentos, venda de produtos, assinaturas de clientes finais, vales e despesas
              locais). As cobranças da licença de software da <strong>NEXADASH</strong> são
              completamente apartadas e não interferem no seu saldo de caixa.
            </p>
          </div>
        </div>
      </div>

      {/* Painel de Indicadores de Caixa: Realizado vs Previsto */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Caixa Atual Realizado */}
        <Card className="relative overflow-hidden border-l-4 border-l-primary shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Saldo em Caixa (Realizado)</span>
              <Wallet className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div
              className={`text-2xl font-bold tracking-tight ${
                stats.realizedBalance >= 0 ? "text-primary" : "text-destructive"
              }`}
            >
              {brl(stats.realizedBalance)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Saldo anterior: <span className="font-medium">{brl(stats.balanceBefore)}</span>
            </p>
          </CardContent>
        </Card>

        {/* Entradas Realizadas */}
        <Card className="relative overflow-hidden border-l-4 border-l-emerald-500 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Entradas Realizadas</span>
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {brl(stats.realizedIncome)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Previstas a receber:{" "}
              <span className="font-medium text-emerald-600">+{brl(stats.projectedIncome)}</span>
            </p>
          </CardContent>
        </Card>

        {/* Saídas Realizadas */}
        <Card className="relative overflow-hidden border-l-4 border-l-rose-500 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Saídas Realizadas</span>
              <ArrowDownRight className="h-4 w-4 text-rose-500" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              {brl(stats.realizedExpense)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Previstas a pagar:{" "}
              <span className="font-medium text-rose-600">-{brl(stats.projectedExpense)}</span>
            </p>
          </CardContent>
        </Card>

        {/* Saldo Projetado (Previsão de Fechamento) */}
        <Card className="relative overflow-hidden border-l-4 border-l-blue-500 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Saldo Projetado (Previsão)</span>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div
              className={`text-2xl font-bold tracking-tight ${
                stats.totalLiquidForecast >= 0 ? "text-blue-600 dark:text-blue-400" : "text-destructive"
              }`}
            >
              {brl(stats.totalLiquidForecast)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Margem operacional:{" "}
              <span className="font-semibold text-foreground">
                {stats.operatingProfitPct}%
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Navegação por Abas Principais */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 max-w-2xl">
          <TabsTrigger value="fluxo" className="gap-1.5 text-xs sm:text-sm">
            <PieChart className="h-4 w-4" />
            Fluxo Diário
          </TabsTrigger>
          <TabsTrigger value="lancamentos" className="gap-1.5 text-xs sm:text-sm">
            <DollarSign className="h-4 w-4" />
            Lançamentos ({filteredTransactions.length})
          </TabsTrigger>
          <TabsTrigger value="previsao" className="gap-1.5 text-xs sm:text-sm">
            <Clock className="h-4 w-4" />
            Previstas ({pendingTransactions.length})
          </TabsTrigger>
          <TabsTrigger
            value="podium_pay"
            className="gap-1.5 text-xs sm:text-sm text-[#FF6500] font-semibold data-[state=active]:bg-[#FF6500]/10 data-[state=active]:text-[#FF6500]"
          >
            <CreditCard className="h-4 w-4 text-[#FF6500]" />
            Podium Pay & Split
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: Fluxo de Caixa Diário */}
        <TabsContent value="fluxo" className="space-y-4">
          <Card>
            <CardHeader className="p-4 sm:p-6 pb-2">
              <CardTitle className="text-base sm:text-lg">Extrato Diário do Fluxo de Caixa</CardTitle>
              <CardDescription className="text-xs">
                Demonstrativo de entradas, saídas e resultado consolidado por data de competência
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <div className="overflow-x-auto">
                <table className="mobile-table w-full text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Data</th>
                      <th className="px-4 py-3 text-right">Entradas (R$)</th>
                      <th className="px-4 py-3 text-right">Saídas (R$)</th>
                      <th className="px-4 py-3 text-right">Saldo do Dia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyFlow.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-sm text-muted-foreground">
                          Nenhuma movimentação financeira registrada neste mês.
                        </td>
                      </tr>
                    ) : (
                      dailyFlow.map((d) => (
                        <tr key={d.date} className="border-b hover:bg-muted/20">
                          <td data-label="Data" className="px-4 py-3 font-medium">
                            {fmtDate(d.date)}
                          </td>
                          <td
                            data-label="Entradas"
                            className="px-4 py-3 text-right font-medium text-emerald-600"
                          >
                            +{brl(d.in)}
                          </td>
                          <td
                            data-label="Saídas"
                            className="px-4 py-3 text-right font-medium text-rose-600"
                          >
                            -{brl(d.out)}
                          </td>
                          <td
                            data-label="Saldo do Dia"
                            className={`px-4 py-3 text-right font-bold ${
                              d.balance >= 0 ? "text-primary" : "text-destructive"
                            }`}
                          >
                            {brl(d.balance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 2: Todos os Lançamentos e Movimentações */}
        <TabsContent value="lancamentos" className="space-y-4">
          {/* Barra de Filtros Rápidos */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 shadow-xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição ou categoria..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs sm:text-sm"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="realizado">Realizado</SelectItem>
                <SelectItem value="previsto">Previsto</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[130px] text-xs">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Receitas & Despesas</SelectItem>
                <SelectItem value="receita">Apenas Receitas</SelectItem>
                <SelectItem value="despesa">Apenas Despesas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px] text-xs">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Categorias</SelectItem>
                {Object.entries(FINANCIAL_CATEGORY_LABELS).map(([cat, label]) => (
                  <SelectItem key={cat} value={cat}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tabela de Lançamentos */}
          <div className="overflow-x-auto rounded-lg border bg-card shadow-xs">
            <table className="mobile-table w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Data</th>
                  <th className="px-4 py-3 text-left">Descrição & Categoria</th>
                  <th className="px-4 py-3 text-center">Pagamento</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Valor Bruto</th>
                  <th className="px-4 py-3 text-right">Taxa / Líquido</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                      Nenhum lançamento encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((t) => {
                    const isIncome = t.type === "receita";
                    const isRealized = t.status === "realizado";
                    const fee = Number(t.card_fee || 0);

                    return (
                      <tr key={t.id} className="border-b hover:bg-muted/20">
                        <td data-label="Data" className="px-4 py-3 font-medium text-xs whitespace-nowrap">
                          {fmtDate(t.date)}
                        </td>

                        <td data-label="Descrição" className="px-4 py-3">
                          <div className="font-medium text-foreground">{t.description}</div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span>{FINANCIAL_CATEGORY_LABELS[t.category] || t.category}</span>
                            {t.due_date && t.status === "previsto" && (
                              <span className="text-amber-600 dark:text-amber-400">
                                · Vence {fmtDate(t.due_date)}
                              </span>
                            )}
                          </div>
                        </td>

                        <td data-label="Pagamento" className="px-4 py-3 text-center">
                          <Badge variant="outline" className="text-xs font-normal">
                            {PAYMENT_METHOD_LABELS[t.payment_method || ""] || t.payment_method || "Dinheiro"}
                          </Badge>
                        </td>

                        <td data-label="Status" className="px-4 py-3 text-center">
                          {isRealized ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/30">
                              Realizado
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300 border-amber-500/30">
                              Previsto
                            </Badge>
                          )}
                        </td>

                        <td
                          data-label="Valor Bruto"
                          className={`px-4 py-3 text-right font-semibold ${
                            isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {isIncome ? "+" : "-"}
                          {brl(t.amount)}
                        </td>

                        <td data-label="Líquido" className="px-4 py-3 text-right text-xs">
                          {fee > 0 ? (
                            <div>
                              <span className="text-muted-foreground line-through mr-1">
                                {brl(t.amount)}
                              </span>
                              <span className="font-semibold text-foreground">
                                {brl(t.net_amount ?? t.amount)}
                              </span>
                              <div className="text-[10px] text-muted-foreground">
                                Taxa: {brl(fee)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">
                              {brl(t.net_amount ?? t.amount)}
                            </span>
                          )}
                        </td>

                        <td data-label="Ações" className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!isRealized && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => settleMutation.mutate(t.id)}
                                className="h-7 text-xs border-emerald-500/30 text-emerald-600 hover:bg-emerald-50"
                                title="Liquidar lançamento (marcar como realizado)"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                Liquidar
                              </Button>
                            )}

                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Deseja realmente excluir "${t.description}"?`)) {
                                  deleteMutation.mutate(t.id);
                                }
                              }}
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              title="Excluir lançamento"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ABA 3: Contas a Pagar & Receber (Previsto vs Realizado) */}
        <TabsContent value="previsao" className="space-y-4">
          <Card>
            <CardHeader className="p-4 sm:p-6 pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base sm:text-lg">
                    Contas a Pagar & Receber Agendadas
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Lançamentos previstos para controle de fluxo de caixa futuro e liquidação com um clique
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-amber-500/30 text-amber-600">
                  {pendingTransactions.length} pendentes
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <div className="overflow-x-auto">
                <table className="mobile-table w-full text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Vencimento</th>
                      <th className="px-4 py-3 text-left">Descrição</th>
                      <th className="px-4 py-3 text-left">Categoria</th>
                      <th className="px-4 py-3 text-center">Tipo</th>
                      <th className="px-4 py-3 text-right">Valor Previsto</th>
                      <th className="px-4 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                          Nenhuma conta a pagar ou receber pendente no período.
                        </td>
                      </tr>
                    ) : (
                      pendingTransactions.map((t) => (
                        <tr key={t.id} className="border-b hover:bg-muted/20">
                          <td data-label="Vencimento" className="px-4 py-3 font-medium text-xs">
                            {t.due_date ? fmtDate(t.due_date) : fmtDate(t.date)}
                          </td>
                          <td data-label="Descrição" className="px-4 py-3 font-medium">
                            {t.description}
                          </td>
                          <td data-label="Categoria" className="px-4 py-3 text-xs text-muted-foreground">
                            {FINANCIAL_CATEGORY_LABELS[t.category] || t.category}
                          </td>
                          <td data-label="Tipo" className="px-4 py-3 text-center">
                            {t.type === "receita" ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
                                A Receber
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-500/15 text-rose-700 border-rose-500/30">
                                A Pagar
                              </Badge>
                            )}
                          </td>
                          <td
                            data-label="Valor"
                            className={`px-4 py-3 text-right font-bold ${
                              t.type === "receita"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {brl(t.net_amount ?? t.amount)}
                          </td>
                          <td data-label="Ação" className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              onClick={() => settleMutation.mutate(t.id)}
                              className="h-8 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Liquidar
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 4: PODIUM PAY, SPLIT DE PAGAMENTO E ANTECIPAÇÃO DE RECEBÍVEIS (ETAPA 13) */}
        <TabsContent value="podium_pay" className="space-y-6">
          {/* Banner de Status da Conta Digital Podium Pay */}
          <div className="relative overflow-hidden rounded-2xl border border-[#FF6500]/40 bg-gradient-to-r from-[#0B192C] via-[#0D2440] to-[#1E3E62] p-6 text-white shadow-lg">
            <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-[#FF6500]/15 blur-3xl pointer-events-none" />
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FF6500] text-white shadow-lg shadow-[#FF6500]/30 font-black text-xl">
                  PP
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-xl font-bold tracking-wide text-white">
                      PODIUM <span className="text-[#FF6500]">PAY</span>
                    </h3>
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                      Ativo · Split Automático
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-white/80">
                    Infraestrutura de pagamentos digitais, recebimento Pix na comanda, split entre barbearia/barbeiro e antecipação D+1.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-right">
                  <span className="text-[10px] text-white/70 uppercase font-semibold block">
                    Saldo Disponível (Pix)
                  </span>
                  <span className="text-xl font-bold text-white">R$ 4.820,00</span>
                </div>
                <div className="rounded-xl border border-[#FF6500]/30 bg-[#FF6500]/10 p-3 text-right">
                  <span className="text-[10px] text-[#FF8C38] uppercase font-semibold block">
                    A Receber (Cartão D+30)
                  </span>
                  <span className="text-xl font-bold text-[#FF6500]">
                    {brl(
                      receivables
                        .filter((r) => r.status === "a_receber")
                        .reduce((acc, r) => acc + Number(r.amount || 0), 0),
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* MÓDULO DE ANTECIPAÇÃO DE RECEBÍVEIS (PODIUM EXPRESS) */}
          <Card className="border shadow-xs">
            <CardHeader className="p-4 sm:p-6 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5 text-[#FF6500]" />
                    Antecipação de Recebíveis Futuros (D+1)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Transforme suas vendas a prazo de cartão de crédito em dinheiro imediato na conta com taxa pro-rata de {podiumRates.anticipationMonthlyRatePct}% a.m.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs border-[#FF6500]/40 text-[#FF6500] self-start sm:self-auto">
                  Liquidação em 24h úteis
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
              {/* Simulador de Antecipação Ativa */}
              {(() => {
                const targetReceivables =
                  selectedReceivables.length > 0
                    ? receivables.filter((r) => selectedReceivables.includes(r.id))
                    : receivables.filter((r) => r.status === "a_receber");
                const sim = simulateAnticipation(
                  targetReceivables,
                  podiumRates.anticipationMonthlyRatePct,
                );

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-xl border bg-muted/20">
                    <div>
                      <span className="text-[11px] text-muted-foreground uppercase font-semibold block">
                        Total Bruto Selecionado
                      </span>
                      <p className="font-display text-xl font-bold text-foreground mt-0.5">
                        {brl(sim.totalGross)}
                      </p>
                      <span className="text-[10px] text-muted-foreground">
                        {sim.eligibleCount} títulos elegíveis
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-muted-foreground uppercase font-semibold block">
                        Prazo Médio Restante
                      </span>
                      <p className="font-display text-xl font-bold text-foreground mt-0.5">
                        {sim.averageDaysAnticipated} dias
                      </p>
                      <span className="text-[10px] text-muted-foreground">
                        Taxa: {podiumRates.anticipationMonthlyRatePct}% a.m.
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-rose-600 dark:text-rose-400 uppercase font-semibold block">
                        Desconto de Antecipação
                      </span>
                      <p className="font-display text-xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                        -{brl(sim.totalDiscount)}
                      </p>
                      <span className="text-[10px] text-muted-foreground">Custo da operação</span>
                    </div>

                    <div className="flex flex-col justify-between">
                      <div>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold block">
                          Líquido a Liberar em D+1
                        </span>
                        <p className="font-display text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {brl(sim.netAmountToReceive)}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        disabled={sim.eligibleCount === 0}
                        className="mt-2 w-full bg-[#FF6500] hover:bg-[#E55B00] text-white font-semibold text-xs gap-1.5 shadow-sm"
                        onClick={() => {
                          const ids = targetReceivables.map((r) => r.id);
                          const result = executeAnticipation(ids);
                          setReceivables(loadPodiumReceivables());
                          setSelectedReceivables([]);
                          toast.success(
                            `Antecipação solicitada com sucesso! ${brl(result.netTotal)} será creditado em D+1.`,
                          );
                        }}
                      >
                        ⚡ Antecipar para D+1
                      </Button>
                    </div>
                  </div>
                );
              })()}

              {/* Tabela de Recebíveis Futuros */}
              <div className="overflow-x-auto rounded-lg border">
                <table className="mobile-table w-full text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left w-10">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={
                            selectedReceivables.length > 0 &&
                            selectedReceivables.length ===
                              receivables.filter((r) => r.status === "a_receber").length
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedReceivables(
                                receivables
                                  .filter((r) => r.status === "a_receber")
                                  .map((r) => r.id),
                              );
                            } else {
                              setSelectedReceivables([]);
                            }
                          }}
                        />
                      </th>
                      <th className="px-4 py-3 text-left">Comanda / Cliente</th>
                      <th className="px-4 py-3 text-left">Data da Venda</th>
                      <th className="px-4 py-3 text-left">Vencimento Original</th>
                      <th className="px-4 py-3 text-left">Forma de Pagamento</th>
                      <th className="px-4 py-3 text-right">Valor Bruto</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receivables.map((rec) => {
                      const isPending = rec.status === "a_receber";
                      const isSelected = selectedReceivables.includes(rec.id);

                      return (
                        <tr key={rec.id} className="border-b hover:bg-muted/20">
                          <td className="px-4 py-3">
                            {isPending ? (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedReceivables([...selectedReceivables, rec.id]);
                                  } else {
                                    setSelectedReceivables(
                                      selectedReceivables.filter((id) => id !== rec.id),
                                    );
                                  }
                                }}
                                className="rounded border-gray-300"
                              />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            )}
                          </td>
                          <td data-label="Cliente" className="px-4 py-3 font-medium">
                            <div>{rec.clientName}</div>
                            <span className="text-xs text-muted-foreground">
                              Comanda #{rec.orderNumber}
                            </span>
                          </td>
                          <td data-label="Data Venda" className="px-4 py-3 text-xs text-muted-foreground">
                            {fmtDate(rec.date)}
                          </td>
                          <td data-label="Vencimento" className="px-4 py-3 font-semibold text-xs">
                            {fmtDate(rec.dueDate)}
                          </td>
                          <td data-label="Forma" className="px-4 py-3 text-xs">
                            <Badge variant="outline">{rec.paymentMethod}</Badge>
                          </td>
                          <td data-label="Valor" className="px-4 py-3 text-right font-bold text-foreground">
                            {brl(rec.amount)}
                          </td>
                          <td data-label="Status" className="px-4 py-3 text-center">
                            {rec.status === "a_receber" && (
                              <Badge variant="outline" className="border-blue-500/40 text-blue-600 bg-blue-500/10 text-xs">
                                A Receber (D+30)
                              </Badge>
                            )}
                            {rec.status === "antecipado" && (
                              <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-xs">
                                Antecipado (D+1)
                              </Badge>
                            )}
                            {rec.status === "liquidado" && (
                              <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-xs">
                                Liquidado
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* GESTÃO DE TAXAS E POLÍTICA DE SPLIT */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Configuração de Taxas Podium Pay */}
            <Card className="border shadow-xs">
              <CardHeader className="p-4 sm:p-6 pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Percent className="h-4 w-4 text-primary" />
                  Taxas de Transação Podium Pay
                </CardTitle>
                <CardDescription className="text-xs">
                  Defina as taxas acordadas para processamento de pagamentos e política de dedução
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <Label className="text-xs">Taxa Pix (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 text-xs mt-1"
                      value={podiumRates.pixFeePct}
                      onChange={(e) =>
                        setPodiumRates({ ...podiumRates, pixFeePct: Number(e.target.value || 0) })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Taxa Cartão Débito (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 text-xs mt-1"
                      value={podiumRates.debitoFeePct}
                      onChange={(e) =>
                        setPodiumRates({
                          ...podiumRates,
                          debitoFeePct: Number(e.target.value || 0),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Cartão Crédito à Vista (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 text-xs mt-1"
                      value={podiumRates.creditoVistaFeePct}
                      onChange={(e) =>
                        setPodiumRates({
                          ...podiumRates,
                          creditoVistaFeePct: Number(e.target.value || 0),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Cartão Parcelado 2x-6x (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 text-xs mt-1"
                      value={podiumRates.creditoParceladoFeePct}
                      onChange={(e) =>
                        setPodiumRates({
                          ...podiumRates,
                          creditoParceladoFeePct: Number(e.target.value || 0),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Taxa Antecipação (% a.m.)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 text-xs mt-1"
                      value={podiumRates.anticipationMonthlyRatePct}
                      onChange={(e) =>
                        setPodiumRates({
                          ...podiumRates,
                          anticipationMonthlyRatePct: Number(e.target.value || 0),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Política de Taxa no Split</Label>
                    <Select
                      value={podiumRates.feePolicy}
                      onValueChange={(v: any) =>
                        setPodiumRates({ ...podiumRates, feePolicy: v })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="salon_absorbs">Salão absorve 100%</SelectItem>
                        <SelectItem value="proportional">Divisão proporcional</SelectItem>
                        <SelectItem value="split_half">50% Salão / 50% Equipe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    savePodiumPayRates(podiumRates);
                    toast.success("Taxas e regras do Podium Pay atualizadas!");
                  }}
                >
                  Salvar Parâmetros de Pagamento
                </Button>
              </CardContent>
            </Card>

            {/* Simulador de Split de Pagamento */}
            <Card className="border shadow-xs">
              <CardHeader className="p-4 sm:p-6 pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-emerald-600" />
                  Simulador de Split (Barbearia vs Barbeiro)
                </CardTitle>
                <CardDescription className="text-xs">
                  Teste em tempo real como o valor é dividido para qualquer serviço ou produto
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <Label className="text-xs">Valor Total (R$)</Label>
                    <Input
                      type="number"
                      className="h-8 text-xs mt-1"
                      value={simAmount}
                      onChange={(e) => setSimAmount(Number(e.target.value || 0))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Comissão Barbeiro (%)</Label>
                    <Input
                      type="number"
                      className="h-8 text-xs mt-1"
                      value={simCommissionPct}
                      onChange={(e) => setSimCommissionPct(Number(e.target.value || 0))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Forma de Pagamento</Label>
                    <Select value={simMethod} onValueChange={setSimMethod}>
                      <SelectTrigger className="h-8 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pix">Pix ({podiumRates.pixFeePct}%)</SelectItem>
                        <SelectItem value="Cartão de débito">
                          Débito ({podiumRates.debitoFeePct}%)
                        </SelectItem>
                        <SelectItem value="Cartão de crédito">
                          Crédito 1x ({podiumRates.creditoVistaFeePct}%)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Resultado do Split Simulado */}
                {(() => {
                  const items: any = [
                    {
                      qty: 1,
                      unit_price: simAmount,
                      commission_pct: simCommissionPct,
                      professional_id: "p1",
                      professional_name: "Barbeiro Demonstração",
                    },
                  ];
                  const split = calculatePaymentSplit(items, simAmount, simMethod, podiumRates);

                  return (
                    <div className="p-3.5 rounded-xl border bg-muted/20 space-y-2 text-xs">
                      <div className="flex justify-between font-semibold border-b pb-2">
                        <span>Valor Bruto da Venda:</span>
                        <span>{brl(split.grossTotal)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Taxa do Gateway ({split.feePct}%):</span>
                        <span className="text-rose-600 font-medium">-{brl(split.feeAmount)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Total Líquido Gerado:</span>
                        <span className="font-semibold text-foreground">{brl(split.netTotal)}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t font-medium">
                        <div className="p-2 rounded-lg bg-card border">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                            Salão / Barbearia
                          </span>
                          <span className="font-display text-base font-bold text-primary mt-0.5 block">
                            {brl(split.salonNet)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Taxa absorvida: {brl(split.salonFeeShare)}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-card border">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                            Barbeiro / Comissão
                          </span>
                          <span className="font-display text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                            {brl(split.professionals[0]?.netCommission ?? 0)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Taxa absorvida: {brl(split.professionals[0]?.feeShare ?? 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal de Novo Lançamento (Receita ou Despesa) */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {formData.type === "receita" ? (
                <>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                    <ArrowUpRight className="h-4 w-4" />
                  </div>
                  Nova Receita Operacional
                </>
              ) : (
                <>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/15 text-rose-600">
                    <ArrowDownRight className="h-4 w-4" />
                  </div>
                  Nova Despesa Operacional
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {formData.type === "receita"
                ? "Registre uma entrada proveniente de serviços, produtos, assinaturas ou outros."
                : "Registre uma saída para aluguel, luz, taxas de cartão, comissões, vales ou insumos."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo de Lançamento</Label>
                <Select
                  value={formData.type}
                  onValueChange={(val: TransactionType) => {
                    setFormData((prev) => ({
                      ...prev,
                      type: val,
                      category: val === "receita" ? "atendimento" : "aluguel",
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receita">Receita (+)</SelectItem>
                    <SelectItem value="despesa">Despesa (-)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Status do Caixa</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val: TransactionStatus) =>
                    setFormData((prev) => ({ ...prev, status: val }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realizado">Realizado (Já liquidado)</SelectItem>
                    <SelectItem value="previsto">Previsto (A vencer/receber)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select
                value={formData.category}
                onValueChange={(val) => setFormData((prev) => ({ ...prev, category: val }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FINANCIAL_CATEGORY_LABELS).map(([cat, label]) => (
                    <SelectItem key={cat} value={cat}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input
                placeholder="Ex: Corte e Barba VIP, Compra de Pomadas, Aluguel do mês..."
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor Bruto (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={formData.amount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Taxa da Maquininha (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={formData.card_fee}
                  onChange={(e) => setFormData((prev) => ({ ...prev, card_fee: e.target.value }))}
                />
              </div>
            </div>

            {Number(formData.card_fee) > 0 && (
              <div className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground flex justify-between">
                <span>Valor Líquido no Caixa:</span>
                <strong className="text-foreground">
                  {brl(
                    calculateNetTransactionAmount(
                      Number(formData.amount),
                      Number(formData.card_fee),
                    ),
                  )}
                </strong>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Forma de Pagamento</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(val) =>
                    setFormData((prev) => ({ ...prev, payment_method: val }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Barbeiro Vinculado (Opcional)</Label>
                <Select
                  value={formData.professional_id || "none"}
                  onValueChange={(val) =>
                    setFormData((prev) => ({
                      ...prev,
                      professional_id: val === "none" ? "" : val,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum profissional</SelectItem>
                    {pros.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data de Competência</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Data de Vencimento</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Observações Adicionais</Label>
              <Textarea
                placeholder="Detalhes adicionais, número de nota ou comprovante..."
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!formData.description.trim() || !formData.amount || Number(formData.amount) <= 0 || saveMutation.isPending}
              className={formData.type === "receita" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
            >
              {saveMutation.isPending ? "Salvando..." : "Confirmar Lançamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
