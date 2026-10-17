import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Download,
  FileText,
  Printer,
  Plus,
  Receipt,
  Scissors,
  Package,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Info,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Trash2,
  CreditCard,
  Building2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Stat } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { useProfessionals } from "@/lib/lookups";
import { currentMonth, dayBounds, monthRange } from "@/lib/period";
import {
  ADVANCE_TYPE_LABELS,
  calculateProfessionalCommissions,
  exportCommissionsToCsv,
  printProfessionalStatement,
} from "@/lib/financial-engine";
import type {
  AdvanceType,
  FinancialClosingRecord,
  ProfessionalAdvanceRecord,
  ProfessionalCommissionSummary,
} from "@/types/financial";
import type { SalonSettingsData } from "@/types/salon";

export const Route = createFileRoute("/_authenticated/comissoes")({
  head: () => ({
    meta: [
      { title: "Comissões & Vales — Belezi" },
      {
        name: "description",
        content:
          "Gestão de comissões por barbeiro, adiantamentos, vales, bonificações e prestação de contas com extrato exportável.",
      },
    ],
  }),
  component: ComissoesPage,
});

function ComissoesPage() {
  const m = monthRange(currentMonth());
  const [start, setStart] = useState(m.start);
  const [end, setEnd] = useState(m.end);
  const [activeTab, setActiveTab] = useState<"comissoes" | "vales" | "fechamentos">("comissoes");
  const [expandedProId, setExpandedProId] = useState<string | null>(null);

  const qc = useQueryClient();
  const { data: pros = [] } = useProfessionals();

  // Consulta de dados da barbearia para o cabeçalho do extrato PDF
  const { data: salon = null } = useQuery<SalonSettingsData | null>({
    queryKey: ["salon-settings"],
    queryFn: async () => {
      const { data, error } = await db.from("salon_settings").select("*").maybeSingle();
      if (error) return null;
      return data as SalonSettingsData;
    },
  });

  // 1. Consulta de itens de comandas fechadas no período
  const { data: orderItems = [] } = useQuery({
    queryKey: ["commission-items", start, end],
    queryFn: async () => {
      const { from, to } = dayBounds(start, end);
      const { data, error } = await db
        .from("order_items")
        .select("*, orders!inner(number, status, closed_at)")
        .eq("orders.status", "fechada")
        .gte("orders.closed_at", from)
        .lte("orders.closed_at", to);
      if (error) {
        console.warn("Erro ao buscar itens de comissão:", error);
        return [];
      }
      return data ?? [];
    },
  });

  // 2. Consulta de vales, adiantamentos e bonificações no período
  const { data: advances = [] } = useQuery<ProfessionalAdvanceRecord[]>({
    queryKey: ["professional-advances", start, end],
    queryFn: async () => {
      const { data, error } = await db
        .from("professional_advances")
        .select("*")
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: false });
      if (error) {
        console.warn("Erro ao buscar vales:", error);
        return [];
      }
      return (data ?? []) as ProfessionalAdvanceRecord[];
    },
  });

  // 3. Consulta de assinaturas ativas vinculadas a profissionais
  const { data: subscriptions = [] } = useQuery({
    queryKey: ["client-subscriptions-commissions"],
    queryFn: async () => {
      const { data, error } = await db
        .from("client_subscriptions")
        .select("*, plans:salon_client_plans(*)")
        .eq("status", "ativa");
      if (error) return [];
      return data ?? [];
    },
  });

  // 4. Consulta de fechamentos já registrados
  const { data: closings = [] } = useQuery<FinancialClosingRecord[]>({
    queryKey: ["financial-closings", start, end],
    queryFn: async () => {
      const { data, error } = await db
        .from("financial_closings")
        .select("*")
        .gte("start_date", start)
        .lte("end_date", end)
        .order("created_at", { ascending: false });
      if (error) return [];
      return (data ?? []) as FinancialClosingRecord[];
    },
  });

  // Modal de Lançamento de Vale / Adiantamento / Bonificação
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [advanceForm, setAdvanceForm] = useState<{
    professional_id: string;
    type: AdvanceType;
    amount: string;
    date: string;
    description: string;
    notes: string;
  }>({
    professional_id: "",
    type: "vale",
    amount: "",
    date: todayISO(),
    description: "",
    notes: "",
  });

  // Modal de Extrato e Prestação de Contas
  const [statementSummary, setStatementSummary] = useState<ProfessionalCommissionSummary | null>(null);

  // Modal de Quitação de Comissão
  const [settleModalSummary, setSettleModalSummary] = useState<ProfessionalCommissionSummary | null>(null);
  const [settlePaymentMethod, setSettlePaymentMethod] = useState("pix");
  const [settleNotes, setSettleNotes] = useState("");

  // Salvar vale / adiantamento / bonificação
  const saveAdvanceMutation = useMutation({
    mutationFn: async () => {
      const { error } = await db.from("professional_advances").insert({
        professional_id: advanceForm.professional_id,
        type: advanceForm.type,
        amount: Number(advanceForm.amount),
        date: advanceForm.date || todayISO(),
        status: "pendente",
        description: advanceForm.description.trim(),
        notes: advanceForm.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["professional-advances"] });
      setAdvanceModalOpen(false);
      setAdvanceForm({
        professional_id: "",
        type: "vale",
        amount: "",
        date: todayISO(),
        description: "",
        notes: "",
      });
      toast.success("Lançamento de vale/adiantamento registrado com sucesso!");
    },
    onError: (e: any) => toast.error(`Erro ao lançar vale: ${e.message}`),
  });

  // Excluir vale
  const deleteAdvanceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("professional_advances").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["professional-advances"] });
      toast.success("Lançamento excluído com sucesso.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Quitação e fechamento de comissão via RPC
  const payCommissionMutation = useMutation({
    mutationFn: async (summary: ProfessionalCommissionSummary) => {
      const { data, error } = await db.rpc("pay_professional_commission", {
        _professional_id: summary.professional.id,
        _start_date: start,
        _end_date: end,
        _service_comm: summary.serviceCommission,
        _product_comm: summary.productCommission,
        _subscription_comm: summary.subscriptionCommission,
        _advances_deducted: summary.pendingAdvances,
        _bonuses_added: summary.bonuses,
        _net_payable: summary.netPayableCommission,
        _payment_method: settlePaymentMethod,
        _notes: settleNotes.trim() || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commission-items"] });
      qc.invalidateQueries({ queryKey: ["professional-advances"] });
      qc.invalidateQueries({ queryKey: ["financial-closings"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setSettleModalSummary(null);
      setSettleNotes("");
      toast.success("Comissão quitada, despesa registrada e vales descontados!");
    },
    onError: (e: any) => toast.error(`Erro ao quitar comissão: ${e.message}`),
  });

  // Cálculo das comissões consolidadas por profissional
  const summaries = useMemo(() => {
    return calculateProfessionalCommissions(pros, orderItems, advances, subscriptions);
  }, [pros, orderItems, advances, subscriptions]);

  // Totais consolidados da barbearia
  const totals = useMemo(() => {
    const totalSales = summaries.reduce(
      (sum, s) => sum + s.serviceSales + s.productSales + s.subscriptionSales,
      0,
    );
    const totalGross = summaries.reduce((sum, s) => sum + s.totalGrossCommission, 0);
    const totalAdvances = summaries.reduce((sum, s) => sum + s.pendingAdvances, 0);
    const totalBonuses = summaries.reduce((sum, s) => sum + s.bonuses, 0);
    const totalNetPayable = summaries.reduce((sum, s) => sum + s.netPayableCommission, 0);

    return {
      totalSales,
      totalGross,
      totalAdvances,
      totalBonuses,
      totalNetPayable,
    };
  }, [summaries]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho e Seleção de Período */}
      <PageHeader
        title="Gestão de Comissões & Vales"
        subtitle="Cálculo automático sobre serviços, produtos, assinaturas, controle de adiantamentos e prestação de contas"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1 text-sm shadow-xs">
              <span className="text-xs text-muted-foreground">De:</span>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="bg-transparent text-xs sm:text-sm font-medium outline-hidden"
              />
              <span className="text-xs text-muted-foreground">Até:</span>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="bg-transparent text-xs sm:text-sm font-medium outline-hidden"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCommissionsToCsv(summaries, { start, end })}
              disabled={summaries.length === 0}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar</span> CSV
            </Button>

            <Button
              size="sm"
              onClick={() => {
                setAdvanceForm({
                  professional_id: pros[0]?.id || "",
                  type: "vale",
                  amount: "",
                  date: todayISO(),
                  description: "",
                  notes: "",
                });
                setAdvanceModalOpen(true);
              }}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Lançar Vale / Bonificação
            </Button>
          </div>
        }
      />

      {/* Banner de Isolamento e Separação Rigorosa do Financeiro */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-primary mt-0.5" />
          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-primary">
                Isolamento por salon_id & Conformidade de Prestação de Contas
              </span>
              <Badge variant="outline" className="border-primary/30 text-xs text-primary">
                Etapa 10
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Comissões calculadas estritamente a partir de comandas fechadas da sua barbearia.
              Vales e adiantamentos são abatidos atomicamente no fechamento, gerando o extrato
              imprimível pronto para assinatura do profissional.
            </p>
          </div>
        </div>
      </div>

      {/* Estatísticas Gerais do Período */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-primary shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Total de Vendas Apurado</span>
              <Receipt className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {brl(totals.totalSales)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Serviços, produtos e assinaturas
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Comissões Brutas Geradas</span>
              <Wallet className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
              {brl(totals.totalGross)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Antes de descontos e vales
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Vales & Adiantamentos (-)</span>
              <AlertCircle className="h-4 w-4 text-rose-500" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              {brl(totals.totalAdvances)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              A deduzir do saldo a pagar
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Saldo Líquido a Pagar</span>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {brl(totals.totalNetPayable)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Valor líquido devido à equipe
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Abas: Comissões, Vales e Fechamentos Históricos */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="comissoes" className="gap-1.5 text-xs sm:text-sm">
            <Users className="h-4 w-4" />
            Barbeiros ({summaries.length})
          </TabsTrigger>
          <TabsTrigger value="vales" className="gap-1.5 text-xs sm:text-sm">
            <Wallet className="h-4 w-4" />
            Vales & Bônus ({advances.length})
          </TabsTrigger>
          <TabsTrigger value="fechamentos" className="gap-1.5 text-xs sm:text-sm">
            <Receipt className="h-4 w-4" />
            Fechamentos ({closings.length})
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: Comissões por Barbeiro */}
        <TabsContent value="comissoes" className="space-y-4">
          <div className="overflow-x-auto rounded-lg border bg-card shadow-xs">
            <table className="mobile-table w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Profissional</th>
                  <th className="px-4 py-3 text-right">Serviços</th>
                  <th className="px-4 py-3 text-right">Com. Serviços</th>
                  <th className="px-4 py-3 text-right">Produtos</th>
                  <th className="px-4 py-3 text-right">Com. Produtos</th>
                  <th className="px-4 py-3 text-right">Vales (-)</th>
                  <th className="px-4 py-3 text-right">Bônus (+)</th>
                  <th className="px-4 py-3 text-right font-bold">Líquido a Pagar</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {summaries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-sm text-muted-foreground">
                      Nenhuma comanda fechada ou comissão apurada para este período.
                    </td>
                  </tr>
                ) : (
                  summaries.map((summary) => {
                    const isExpanded = expandedProId === summary.professional.id;

                    return (
                      <Fragment key={summary.professional.id}>
                        <tr
                          className="cursor-pointer border-b hover:bg-muted/30 transition-colors"
                          onClick={() =>
                            setExpandedProId(isExpanded ? null : summary.professional.id)
                          }
                        >
                          <td data-label="Profissional" className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                              <div>
                                <span className="font-semibold text-foreground">
                                  {summary.professional.name}
                                </span>
                                <div className="text-xs text-muted-foreground">
                                  {summary.orderItems.length} itens executados
                                </div>
                              </div>
                            </div>
                          </td>

                          <td data-label="Serviços" className="px-4 py-3 text-right">
                            {brl(summary.serviceSales)}
                          </td>

                          <td data-label="Com. Serviços" className="px-4 py-3 text-right font-medium">
                            {brl(summary.serviceCommission)}
                          </td>

                          <td data-label="Produtos" className="px-4 py-3 text-right">
                            {brl(summary.productSales)}
                          </td>

                          <td data-label="Com. Produtos" className="px-4 py-3 text-right font-medium">
                            {brl(summary.productCommission)}
                          </td>

                          <td
                            data-label="Vales (-)"
                            className="px-4 py-3 text-right font-medium text-rose-600"
                          >
                            {summary.pendingAdvances > 0 ? `-${brl(summary.pendingAdvances)}` : "—"}
                          </td>

                          <td
                            data-label="Bônus (+)"
                            className="px-4 py-3 text-right font-medium text-emerald-600"
                          >
                            {summary.bonuses > 0 ? `+${brl(summary.bonuses)}` : "—"}
                          </td>

                          <td
                            data-label="Líquido"
                            className="px-4 py-3 text-right font-bold text-primary text-base"
                          >
                            {brl(summary.netPayableCommission)}
                          </td>

                          <td data-label="Ações" className="px-4 py-3 text-right">
                            <div
                              className="flex items-center justify-end gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => printProfessionalStatement(salon, summary, { start, end })}
                                title="Imprimir extrato / Gerar PDF"
                                className="h-8 gap-1 text-xs"
                              >
                                <Printer className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Extrato PDF</span>
                              </Button>

                              <Button
                                size="sm"
                                disabled={summary.netPayableCommission <= 0}
                                onClick={() => {
                                  setSettleModalSummary(summary);
                                  setSettlePaymentMethod("pix");
                                  setSettleNotes(
                                    `Fechamento de comissões (${fmtDate(start)} a ${fmtDate(end)})`,
                                  );
                                }}
                                className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Pagar
                              </Button>
                            </div>
                          </td>
                        </tr>

                        {/* Detalhamento expandido dos itens da comanda */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={9} className="p-0">
                              <div className="bg-muted/15 p-4 border-b space-y-4">
                                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  Detalhamento de Atendimentos de {summary.professional.name}
                                </div>

                                <div className="overflow-x-auto rounded-md border bg-card">
                                  <table className="w-full text-xs">
                                    <thead className="bg-muted/40 border-b">
                                      <tr>
                                        <th className="px-3 py-2 text-left">Comanda</th>
                                        <th className="px-3 py-2 text-left">Item / Descrição</th>
                                        <th className="px-3 py-2 text-center">Tipo</th>
                                        <th className="px-3 py-2 text-right">Valor Venda</th>
                                        <th className="px-3 py-2 text-right">% Com.</th>
                                        <th className="px-3 py-2 text-right">Comissão Calculada</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {summary.orderItems.length === 0 ? (
                                        <tr>
                                          <td
                                            colSpan={6}
                                            className="p-4 text-center text-muted-foreground"
                                          >
                                            Nenhum item avulso neste período.
                                          </td>
                                        </tr>
                                      ) : (
                                        summary.orderItems.map((item) => (
                                          <tr key={item.id} className="border-b last:border-0">
                                            <td className="px-3 py-2 font-medium">
                                              #{item.orders?.number || "-"}
                                            </td>
                                            <td className="px-3 py-2">
                                              {item.description} ×{Number(item.qty)}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                              <Badge variant="outline" className="text-[10px]">
                                                {item.kind === "servico" ? "Serviço" : "Produto"}
                                              </Badge>
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                              {brl(Number(item.qty) * Number(item.unit_price))}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                              {Number(item.commission_pct)}%
                                            </td>
                                            <td className="px-3 py-2 text-right font-semibold text-primary">
                                              {brl(
                                                (Number(item.qty) *
                                                  Number(item.unit_price) *
                                                  Number(item.commission_pct)) /
                                                  100,
                                              )}
                                            </td>
                                          </tr>
                                        ))
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Clique na linha de qualquer profissional para expandir o detalhamento analítico de serviços e produtos.
          </p>
        </TabsContent>

        {/* ABA 2: Vales, Adiantamentos e Bonificações */}
        <TabsContent value="vales" className="space-y-4">
          <Card>
            <CardHeader className="p-4 sm:p-6 pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base sm:text-lg">
                    Registro de Vales, Adiantamentos & Bonificações
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Controle de adiantamentos salariais, vales em produtos e prêmios de metas que abatem ou somam na comissão
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setAdvanceForm({
                      professional_id: pros[0]?.id || "",
                      type: "vale",
                      amount: "",
                      date: todayISO(),
                      description: "",
                      notes: "",
                    });
                    setAdvanceModalOpen(true);
                  }}
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Novo Lançamento
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <div className="overflow-x-auto">
                <table className="mobile-table w-full text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Data</th>
                      <th className="px-4 py-3 text-left">Profissional</th>
                      <th className="px-4 py-3 text-left">Tipo</th>
                      <th className="px-4 py-3 text-left">Descrição</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Valor</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advances.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                          Nenhum vale ou adiantamento lançado para o período selecionado.
                        </td>
                      </tr>
                    ) : (
                      advances.map((adv) => {
                        const pro = pros.find((p: any) => p.id === adv.professional_id);
                        const isDeduction = adv.type !== "bonificacao";

                        return (
                          <tr key={adv.id} className="border-b hover:bg-muted/20">
                            <td data-label="Data" className="px-4 py-3 font-medium text-xs whitespace-nowrap">
                              {fmtDate(adv.date)}
                            </td>

                            <td data-label="Profissional" className="px-4 py-3 font-medium">
                              {pro?.name || "Profissional"}
                            </td>

                            <td data-label="Tipo" className="px-4 py-3">
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  adv.type === "bonificacao"
                                    ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/10"
                                    : "border-rose-500/30 text-rose-600 bg-rose-500/10"
                                }`}
                              >
                                {ADVANCE_TYPE_LABELS[adv.type]?.label || adv.type}
                              </Badge>
                            </td>

                            <td data-label="Descrição" className="px-4 py-3 text-foreground">
                              {adv.description}
                              {adv.notes && (
                                <div className="text-xs text-muted-foreground">{adv.notes}</div>
                              )}
                            </td>

                            <td data-label="Status" className="px-4 py-3 text-center">
                              {adv.status === "pendente" ? (
                                <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">
                                  Pendente
                                </Badge>
                              ) : adv.status === "descontado" ? (
                                <Badge className="bg-blue-500/15 text-blue-700 border-blue-500/30">
                                  Descontado
                                </Badge>
                              ) : (
                                <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
                                  Pago
                                </Badge>
                              )}
                            </td>

                            <td
                              data-label="Valor"
                              className={`px-4 py-3 text-right font-bold ${
                                isDeduction ? "text-rose-600" : "text-emerald-600"
                              }`}
                            >
                              {isDeduction ? "-" : "+"}
                              {brl(adv.amount)}
                            </td>

                            <td data-label="Ações" className="px-4 py-3 text-right">
                              {adv.status === "pendente" && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    if (confirm("Excluir este lançamento de vale/bonificação?")) {
                                      deleteAdvanceMutation.mutate(adv.id);
                                    }
                                  }}
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 3: Fechamentos Financeiros Históricos */}
        <TabsContent value="fechamentos" className="space-y-4">
          <Card>
            <CardHeader className="p-4 sm:p-6 pb-2">
              <CardTitle className="text-base sm:text-lg">
                Histórico de Fechamentos & Prestações de Contas
              </CardTitle>
              <CardDescription className="text-xs">
                Auditoria de comissões quitadas com registro atômico de data, barbeiro e valor pago
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <div className="overflow-x-auto">
                <table className="mobile-table w-full text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Data Fechamento</th>
                      <th className="px-4 py-3 text-left">Profissional</th>
                      <th className="px-4 py-3 text-left">Período Apurado</th>
                      <th className="px-4 py-3 text-right">Comissões</th>
                      <th className="px-4 py-3 text-right">Vales Descontados</th>
                      <th className="px-4 py-3 text-right font-bold">Líquido Quitado</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closings.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                          Nenhum fechamento registrado no período.
                        </td>
                      </tr>
                    ) : (
                      closings.map((closing) => {
                        const pro = pros.find((p: any) => p.id === closing.professional_id);

                        return (
                          <tr key={closing.id} className="border-b hover:bg-muted/20">
                            <td data-label="Fechamento" className="px-4 py-3 font-medium text-xs">
                              {fmtDate(closing.closed_at)}
                            </td>

                            <td data-label="Profissional" className="px-4 py-3 font-medium">
                              {pro?.name || "Todos os Barbeiros"}
                            </td>

                            <td data-label="Período" className="px-4 py-3 text-xs text-muted-foreground">
                              {fmtDate(closing.start_date)} a {fmtDate(closing.end_date)}
                            </td>

                            <td data-label="Comissões" className="px-4 py-3 text-right">
                              {brl(closing.total_commissions)}
                            </td>

                            <td data-label="Vales" className="px-4 py-3 text-right text-rose-600">
                              -{brl(closing.total_advances)}
                            </td>

                            <td data-label="Líquido" className="px-4 py-3 text-right font-bold text-emerald-600">
                              {brl(closing.net_payable)}
                            </td>

                            <td data-label="Status" className="px-4 py-3 text-center">
                              <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
                                {closing.status === "pago" ? "Quitado / Pago" : "Fechado"}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL: Lançar Vale / Adiantamento / Bonificação */}
      <Dialog open={advanceModalOpen} onOpenChange={setAdvanceModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Lançar Vale / Bonificação</DialogTitle>
            <DialogDescription>
              Adicione adiantamento salarial, vale de compra ou prêmio de metas para o barbeiro.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label>Barbeiro / Profissional</Label>
              <Select
                value={advanceForm.professional_id}
                onValueChange={(val) =>
                  setAdvanceForm((prev) => ({ ...prev, professional_id: val }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o barbeiro" />
                </SelectTrigger>
                <SelectContent>
                  {pros.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo de Lançamento</Label>
                <Select
                  value={advanceForm.type}
                  onValueChange={(val: AdvanceType) =>
                    setAdvanceForm((prev) => ({ ...prev, type: val }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vale">Vale Compras (-)</SelectItem>
                    <SelectItem value="adiantamento">Adiantamento Pix (-)</SelectItem>
                    <SelectItem value="bonificacao">Bonificação por Meta (+)</SelectItem>
                    <SelectItem value="ajuste">Ajuste / Acerto (-)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  value={advanceForm.amount}
                  onChange={(e) =>
                    setAdvanceForm((prev) => ({ ...prev, amount: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Data do Lançamento</Label>
              <Input
                type="date"
                value={advanceForm.date}
                onChange={(e) => setAdvanceForm((prev) => ({ ...prev, date: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Descrição / Motivo</Label>
              <Input
                placeholder="Ex: Retirada de R$ 150 em dinheiro, Meta de 50 cortes batida..."
                value={advanceForm.description}
                onChange={(e) =>
                  setAdvanceForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Observações Internas (Opcional)</Label>
              <Textarea
                placeholder="Detalhes ou comprovante..."
                value={advanceForm.notes}
                onChange={(e) => setAdvanceForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdvanceModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveAdvanceMutation.mutate()}
              disabled={
                !advanceForm.professional_id ||
                !advanceForm.amount ||
                Number(advanceForm.amount) <= 0 ||
                !advanceForm.description.trim() ||
                saveAdvanceMutation.isPending
              }
            >
              {saveAdvanceMutation.isPending ? "Salvando..." : "Registrar Lançamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Confirmação e Quitação de Comissão */}
      <Dialog
        open={!!settleModalSummary}
        onOpenChange={(open) => !open && setSettleModalSummary(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Quitação de Comissão</DialogTitle>
            <DialogDescription>
              Confirmar o pagamento das comissões apuradas com dedução atômica dos vales pendentes.
            </DialogDescription>
          </DialogHeader>

          {settleModalSummary && (
            <div className="space-y-3 py-2 text-sm">
              <div className="rounded-lg bg-muted/40 p-3 space-y-1.5 border">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Barbeiro:</span>
                  <strong className="text-foreground">{settleModalSummary.professional.name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Período:</span>
                  <span>{fmtDate(start)} a {fmtDate(end)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Comissão Bruta (Serviços + Produtos):</span>
                  <span>{brl(settleModalSummary.totalGrossCommission)}</span>
                </div>
                {settleModalSummary.pendingAdvances > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Vales e Adiantamentos a Descontar:</span>
                    <span>-{brl(settleModalSummary.pendingAdvances)}</span>
                  </div>
                )}
                {settleModalSummary.bonuses > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Bonificações por Metas a Somar:</span>
                    <span>+{brl(settleModalSummary.bonuses)}</span>
                  </div>
                )}
                <div className="border-t pt-1.5 flex justify-between font-bold text-base text-primary">
                  <span>Valor Líquido a Pagar:</span>
                  <span>{brl(settleModalSummary.netPayableCommission)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Forma de Pagamento Utilizada</Label>
                <Select value={settlePaymentMethod} onValueChange={setSettlePaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro em Espécie</SelectItem>
                    <SelectItem value="transferencia">Transferência Bancária</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Observação no Lançamento Financeiro</Label>
                <Input
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  placeholder="Ex: Quitado via PIX"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleModalSummary(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (settleModalSummary) {
                  payCommissionMutation.mutate(settleModalSummary);
                }
              }}
              disabled={payCommissionMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {payCommissionMutation.isPending ? "Processando..." : "Confirmar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
