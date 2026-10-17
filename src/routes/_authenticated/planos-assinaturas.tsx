import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Crown,
  Sparkles,
  CreditCard,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Scissors,
  Users,
  ShieldCheck,
  Check,
  X,
  Pencil,
  Trash2,
  Calendar,
  AlertCircle,
  HelpCircle,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { db, brl, fmtDate } from "@/lib/db";
import { useClients } from "@/lib/lookups";
import { MODEL_LABELS } from "@/lib/subscription-engine";
import type {
  BillingCycle,
  ClientSubscription,
  SalonClientPlan,
  SubscriptionModel,
  SubscriptionStatus,
} from "@/types/subscription";

export const Route = createFileRoute("/_authenticated/planos-assinaturas")({
  head: () => ({
    meta: [
      { title: "Clube & Assinaturas dos Clientes — Belezi" },
      {
        name: "description",
        content:
          "Gestão de planos e assinaturas para clientes da barbearia: One (1 corte/mês), Recorrente, Ilimitado, VIP e Avulso.",
      },
    ],
  }),
  component: PlanosAssinaturasPage,
});

function PlanosAssinaturasPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"assinaturas" | "planos" | "logs">("assinaturas");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modelFilter, setModelFilter] = useState<string>("all");

  const { data: clients = [] } = useClients();

  // 1. Carregar Planos de Serviços da Barbearia
  const { data: plans = [] } = useQuery<SalonClientPlan[]>({
    queryKey: ["salon-client-plans"],
    queryFn: async () => {
      const { data, error } = await db
        .from("salon_client_plans")
        .select("*")
        .order("price", { ascending: true });
      if (error) console.warn("Erro ao buscar planos:", error);
      return (data ?? []) as SalonClientPlan[];
    },
  });

  // 2. Carregar Assinaturas Ativas dos Clientes
  const { data: subscriptions = [] } = useQuery<ClientSubscription[]>({
    queryKey: ["client-subscriptions"],
    queryFn: async () => {
      const { data, error } = await db
        .from("client_subscriptions")
        .select(`
          *,
          client:clients(id, name, phone),
          plan:salon_client_plans(id, name, model, price, billing_cycle, monthly_credit_limit)
        `)
        .order("created_at", { ascending: false });
      if (error) console.warn("Erro ao buscar assinaturas:", error);
      return (data ?? []) as ClientSubscription[];
    },
  });

  // 3. Carregar Histórico de Uso de Créditos
  const { data: usageLogs = [] } = useQuery<any[]>({
    queryKey: ["subscription-usage-logs"],
    queryFn: async () => {
      const { data, error } = await db
        .from("subscription_usage_logs")
        .select(`
          *,
          client:clients(name),
          service:services(name)
        `)
        .order("used_at", { ascending: false })
        .limit(50);
      if (error) console.warn("Erro ao buscar logs:", error);
      return data ?? [];
    },
  });

  // Métricas do Clube
  const stats = useMemo(() => {
    const activeSubs = subscriptions.filter((s) => s.status === "ativa");
    const mrr = activeSubs.reduce((acc, s) => acc + Number(s.plan?.price || 0), 0);
    const oneSubs = activeSubs.filter((s) => s.plan?.model === "one").length;
    const vipSubs = activeSubs.filter((s) => s.plan?.model === "vip").length;
    const delinquentSubs = subscriptions.filter((s) => s.status === "inadimplente").length;

    return {
      activeCount: activeSubs.length,
      mrr,
      oneSubs,
      vipSubs,
      delinquentSubs,
    };
  }, [subscriptions]);

  // Modais de Criação / Edição
  const [editingPlan, setEditingPlan] = useState<Partial<SalonClientPlan> | null>(null);
  const [editingSub, setEditingSub] = useState<Partial<ClientSubscription> | null>(null);

  // Mutation: Salvar Plano da Barbearia
  const savePlanMutation = useMutation({
    mutationFn: async (planData: Partial<SalonClientPlan>) => {
      const payload: any = {
        name: planData.name,
        model: planData.model || "recorrente",
        price: Number(planData.price || 0),
        billing_cycle: planData.billing_cycle || "mensal",
        monthly_credit_limit:
          planData.model === "one"
            ? 1
            : planData.model === "ilimitado" || planData.model === "vip"
            ? 9999
            : Number(planData.monthly_credit_limit || 2),
        benefits: planData.benefits || [],
        active: planData.active ?? true,
      };

      if (planData.id) {
        const { error } = await db
          .from("salon_client_plans")
          .update(payload)
          .eq("id", planData.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("salon_client_plans").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["salon-client-plans"] });
      setEditingPlan(null);
      toast.success("Plano salvo com sucesso!");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao salvar plano."),
  });

  // Mutation: Excluir Plano
  const deletePlanMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("salon_client_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["salon-client-plans"] });
      toast.success("Plano excluído");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao excluir plano."),
  });

  // Mutation: Salvar Assinatura de Cliente
  const saveSubMutation = useMutation({
    mutationFn: async (subData: Partial<ClientSubscription>) => {
      if (!subData.client_id) throw new Error("Selecione o cliente.");
      if (!subData.plan_id) throw new Error("Selecione o plano.");

      const selectedPlan = plans.find((p) => p.id === subData.plan_id);

      const payload: any = {
        client_id: subData.client_id,
        plan_id: subData.plan_id,
        status: subData.status || "ativa",
        starts_at: subData.starts_at || new Date().toISOString(),
        renews_at: subData.renews_at || new Date(Date.now() + 30 * 86400000).toISOString(),
        credits_used_this_period: Number(subData.credits_used_this_period || 0),
        notes: subData.notes || null,
      };

      if (subData.id) {
        const { error } = await db
          .from("client_subscriptions")
          .update(payload)
          .eq("id", subData.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("client_subscriptions").insert(payload);
        if (error) throw error;
      }

      // Se for plano VIP, atualiza a flag do cliente
      if (selectedPlan?.model === "vip") {
        await db
          .from("clients")
          .update({ is_vip: true, vip_plan_name: selectedPlan.name })
          .eq("id", subData.client_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-subscriptions"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      setEditingSub(null);
      toast.success("Assinatura salva com sucesso!");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao salvar assinatura."),
  });

  // Ações Rápidas na Assinatura (Renovar Ciclo, Pausar, Cancelar)
  const renewCycleMutation = useMutation({
    mutationFn: async (subId: string) => {
      const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString();
      const { error } = await db
        .from("client_subscriptions")
        .update({
          renews_at: nextMonth,
          credits_used_this_period: 0,
          status: "ativa",
        })
        .eq("id", subId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-subscriptions"] });
      toast.success("Ciclo renovado com sucesso! Franquia de créditos reiniciada.");
    },
  });

  const toggleSubStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: SubscriptionStatus }) => {
      const { error } = await db
        .from("client_subscriptions")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-subscriptions"] });
      toast.success("Status da assinatura atualizado.");
    },
  });

  // Filtro de Assinaturas
  const filteredSubs = useMemo(() => {
    return subscriptions.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (modelFilter !== "all" && s.plan?.model !== modelFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const clientName = (s.client?.name || "").toLowerCase();
        const clientPhone = (s.client?.phone || "").toLowerCase();
        const planName = (s.plan?.name || "").toLowerCase();
        if (!clientName.includes(q) && !clientPhone.includes(q) && !planName.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [subscriptions, statusFilter, modelFilter, searchQuery]);

  // Auxiliares de Benefícios
  const [benefitInput, setBenefitInput] = useState("");

  const addBenefitToPlan = () => {
    if (!benefitInput.trim() || !editingPlan) return;
    const current = editingPlan.benefits || [];
    setEditingPlan({ ...editingPlan, benefits: [...current, benefitInput.trim()] });
    setBenefitInput("");
  };

  const removeBenefitFromPlan = (idx: number) => {
    if (!editingPlan) return;
    const current = editingPlan.benefits || [];
    setEditingPlan({ ...editingPlan, benefits: current.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Clube & Assinaturas dos Clientes"
        subtitle="Gerenciamento dos planos de serviço da barbearia (Avulso, Recorrente, Ilimitado, VIP e One)"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setEditingPlan({
                  name: "",
                  model: "one",
                  price: 59.9,
                  billing_cycle: "mensal",
                  monthly_credit_limit: 1,
                  benefits: ["1 Corte masculino no mês", "Finalização premium inclusa"],
                  active: true,
                })
              }
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Novo Plano
            </Button>

            <Button
              size="sm"
              onClick={() =>
                setEditingSub({
                  client_id: clients[0]?.id || "",
                  plan_id: plans[0]?.id || "",
                  status: "ativa",
                  credits_used_this_period: 0,
                  renews_at: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
                })
              }
              disabled={!clients.length || !plans.length}
              className="bg-primary text-primary-foreground shadow-sm"
            >
              <Crown className="mr-1.5 h-3.5 w-3.5" />
              Nova Assinatura
            </Button>
          </div>
        }
      />

      {/* Banner Informativo: Separação Rígida das Assinaturas */}
      <div className="p-3.5 rounded-lg border border-purple-500/30 bg-purple-500/5 text-purple-900 dark:text-purple-200 text-xs flex items-start gap-2.5">
        <Info className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold">Separação Rígida de Modelos de Assinatura:</p>
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            Estes planos são comercializados pela sua barbearia diretamente aos seus clientes finais (créditos de cortes, barbas e clube VIP).
            A assinatura da licença do software BELEZI é paga à parte para a NEXADASH e controlada na central administrativa.
          </p>
        </div>
      </div>

      {/* Métricas do Clube de Assinaturas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border bg-card">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Assinantes Ativos
              </span>
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold">{stats.activeCount}</span>
              <span className="text-xs text-muted-foreground">clientes cadastrados</span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-[11px] text-muted-foreground">
              Base com renovação mensal garantida
            </p>
          </CardContent>
        </Card>

        <Card className="border bg-card">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Receita Recorrente (MRR)
              </span>
              <CreditCard className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {brl(stats.mrr)}
              </span>
              <span className="text-[10px] text-muted-foreground">/mês previsto</span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-[11px] text-muted-foreground">
              Faturamento mensal das mensalidades dos clientes
            </p>
          </CardContent>
        </Card>

        <Card className="border bg-card">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Plano One (1 Corte/mês)
              </span>
              <Scissors className="h-4 w-4 text-blue-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold">{stats.oneSubs}</span>
              <span className="text-xs text-muted-foreground">assinantes One</span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-[11px] text-muted-foreground">
              Controle estrito de 1 atendimento mensal por ciclo
            </p>
          </CardContent>
        </Card>

        <Card className="border bg-card">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Membros Clube VIP
              </span>
              <Sparkles className="h-4 w-4 text-purple-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold">{stats.vipSubs}</span>
              <span className="text-xs text-muted-foreground">VIPs com encaixe</span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-[11px] text-muted-foreground">
              Atendimento prioritário e encaixe simultâneo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Navegação por Abas */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="bg-muted">
          <TabsTrigger value="assinaturas" className="text-xs flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Assinantes ({subscriptions.length})
          </TabsTrigger>
          <TabsTrigger value="planos" className="text-xs flex items-center gap-1.5">
            <Crown className="h-3.5 w-3.5" />
            Planos da Barbearia ({plans.length})
          </TabsTrigger>
          <TabsTrigger value="logs" className="text-xs flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Histórico de Créditos
          </TabsTrigger>
        </TabsList>

        {/* =================================================================== */}
        {/* ABA 1: ASSINANTES DOS CLIENTES */}
        {/* =================================================================== */}
        <TabsContent value="assinaturas" className="space-y-4 pt-2">
          {/* Barra de Filtros */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/40 p-3 rounded-lg border">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-xs w-36 bg-background">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="pausada">Pausada</SelectItem>
                  <SelectItem value="inadimplente">Inadimplente</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>

              <Select value={modelFilter} onValueChange={setModelFilter}>
                <SelectTrigger className="h-9 text-xs w-44 bg-background">
                  <SelectValue placeholder="Modelo de Plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Modelos</SelectItem>
                  <SelectItem value="one">Plano One (1 Corte)</SelectItem>
                  <SelectItem value="recorrente">Recorrente</SelectItem>
                  <SelectItem value="ilimitado">Ilimitado</SelectItem>
                  <SelectItem value="vip">Clube VIP</SelectItem>
                  <SelectItem value="avulso">Pacote Avulso</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar cliente, telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 text-xs bg-background"
              />
            </div>
          </div>

          {/* Lista de Assinaturas */}
          {filteredSubs.length === 0 ? (
            <Card className="border-dashed p-8 text-center space-y-3">
              <Crown className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="text-sm font-semibold">Nenhuma assinatura encontrada</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Cadastre planos de serviços e vincule seus clientes recorrentes para gerenciar franquias de cortes e benefícios VIP.
              </p>
              <Button
                size="sm"
                onClick={() =>
                  setEditingSub({
                    client_id: clients[0]?.id || "",
                    plan_id: plans[0]?.id || "",
                    status: "ativa",
                    credits_used_this_period: 0,
                  })
                }
                disabled={!clients.length || !plans.length}
              >
                Cadastrar Primeira Assinatura
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredSubs.map((sub) => {
                const modelInfo = MODEL_LABELS[sub.plan?.model || "recorrente"];
                const isOne = sub.plan?.model === "one";
                const isUnlimited = sub.plan?.model === "ilimitado" || sub.plan?.model === "vip";
                const limit = sub.plan?.monthly_credit_limit || (isOne ? 1 : 2);
                const used = sub.credits_used_this_period || 0;
                const remaining = isUnlimited ? "Ilimitado" : Math.max(0, limit - used);

                return (
                  <Card key={sub.id} className="border bg-card flex flex-col justify-between">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-sm">{sub.client?.name || "Cliente"}</h4>
                          <p className="text-xs text-muted-foreground">{sub.client?.phone || "Sem telefone"}</p>
                        </div>
                        <Badge
                          variant={
                            sub.status === "ativa"
                              ? "default"
                              : sub.status === "pausada"
                              ? "secondary"
                              : "destructive"
                          }
                          className="text-[10px] uppercase font-bold"
                        >
                          {sub.status}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <Badge className={`${modelInfo.badgeColor} text-[10px]`}>
                          {sub.plan?.name || "Plano"}
                        </Badge>
                        <span className="text-xs font-bold">{brl(sub.plan?.price)}/mês</span>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-2 space-y-3 flex-1">
                      {/* Controle de Franquia / Créditos */}
                      <div className="space-y-1 rounded-md bg-muted/40 p-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Créditos no Ciclo:</span>
                          <span className="font-bold">
                            {isUnlimited
                              ? "Cortes Ilimitados"
                              : `${used} de ${limit} utilizados (${remaining} livres)`}
                          </span>
                        </div>
                        {!isUnlimited && (
                          <Progress
                            value={Math.min(100, Math.round((used / limit) * 100))}
                            className="h-1.5"
                          />
                        )}
                        {isOne && used >= 1 && (
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold pt-1">
                            ⚠️ Franquia do Plano One esgotada neste ciclo (1/1 corte).
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Renovação: {fmtDate(sub.renews_at)}</span>
                        <span>Início: {fmtDate(sub.starts_at)}</span>
                      </div>

                      {/* Ações Rápidas */}
                      <div className="flex items-center justify-between pt-2 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => renewCycleMutation.mutate(sub.id)}
                          className="h-7 text-xs"
                          title="Reinicia a contagem de créditos e estende o vencimento por 30 dias"
                        >
                          <RefreshCw className="h-3 w-3 mr-1" /> Renovar Ciclo
                        </Button>

                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => setEditingSub(sub)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>

                          <Select
                            value={sub.status}
                            onValueChange={(val) =>
                              toggleSubStatusMutation.mutate({
                                id: sub.id,
                                newStatus: val as SubscriptionStatus,
                              })
                            }
                          >
                            <SelectTrigger className="h-7 text-[11px] w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ativa">Ativa</SelectItem>
                              <SelectItem value="pausada">Pausada</SelectItem>
                              <SelectItem value="inadimplente">Inadimplente</SelectItem>
                              <SelectItem value="cancelada">Cancelada</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* =================================================================== */}
        {/* ABA 2: MODELOS E PLANOS DA BARBEARIA */}
        {/* =================================================================== */}
        <TabsContent value="planos" className="space-y-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((p) => {
              const modelInfo = MODEL_LABELS[p.model];
              return (
                <Card key={p.id} className="border bg-card flex flex-col justify-between">
                  <CardHeader className="p-5 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <Badge className={`${modelInfo.badgeColor} text-[10px]`}>
                          {modelInfo.label}
                        </Badge>
                        <CardTitle className="text-base font-bold">{p.name}</CardTitle>
                      </div>
                      <Badge variant={p.active ? "default" : "outline"} className="text-[10px]">
                        {p.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <div className="pt-2">
                      <span className="text-2xl font-bold">{brl(p.price)}</span>
                      <span className="text-xs text-muted-foreground ml-1">/{p.billing_cycle}</span>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 pt-2 space-y-3 text-xs flex-1">
                    <p className="text-muted-foreground">{modelInfo.description}</p>

                    <div className="space-y-1 rounded bg-muted/30 p-2.5">
                      <p className="font-semibold text-foreground">
                        Franquia:{" "}
                        {p.model === "one"
                          ? "Exatamente 1 atendimento por ciclo"
                          : p.model === "ilimitado" || p.model === "vip"
                          ? "Atendimentos Ilimitados"
                          : `${p.monthly_credit_limit} atendimentos no mês`}
                      </p>
                    </div>

                    {/* Benefícios */}
                    {p.benefits && p.benefits.length > 0 && (
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground">Benefícios Inclusos:</p>
                        <ul className="space-y-1 text-muted-foreground">
                          {p.benefits.map((b, idx) => (
                            <li key={idx} className="flex items-center gap-1.5">
                              <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-3 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingPlan(p)}
                        className="text-xs h-7"
                      >
                        <Pencil className="h-3 w-3 mr-1" /> Editar
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Deseja excluir o plano ${p.name}?`)) {
                            deletePlanMutation.mutate(p.id);
                          }
                        }}
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* =================================================================== */}
        {/* ABA 3: HISTÓRICO DE LOGS DE USO */}
        {/* =================================================================== */}
        <TabsContent value="logs" className="space-y-4 pt-2">
          <Card className="border">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold">Registro de Utilização de Créditos</CardTitle>
              <CardDescription className="text-xs">
                Auditoria de cada atendimento coberto por assinaturas e planos da barbearia
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {usageLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  Nenhum débito de crédito registrado ainda.
                </p>
              ) : (
                <div className="divide-y text-xs">
                  {usageLogs.map((log) => (
                    <div key={log.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{log.client?.name || "Cliente"}</p>
                        <p className="text-muted-foreground text-[11px]">{log.description}</p>
                      </div>
                      <span className="text-muted-foreground text-[11px]">
                        {new Date(log.used_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* =================================================================== */}
      {/* DIÁLOGO: CRIAR / EDITAR PLANO DA BARBEARIA */}
      {/* =================================================================== */}
      <Dialog open={!!editingPlan} onOpenChange={(o) => !o && setEditingPlan(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPlan?.id ? "Editar Plano" : "Novo Plano de Assinatura"}</DialogTitle>
            <DialogDescription className="text-xs">
              Configure as regras de cobrança, modelo de créditos e benefícios da barbearia.
            </DialogDescription>
          </DialogHeader>

          {editingPlan && (
            <div className="space-y-3.5 py-2 text-xs">
              <div>
                <Label className="text-xs font-medium">Nome do Plano</Label>
                <Input
                  value={editingPlan.name || ""}
                  onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  placeholder="Ex: Plano One, Clube da Barba, VIP Black"
                  className="text-xs mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Modelo do Plano</Label>
                  <Select
                    value={editingPlan.model || "recorrente"}
                    onValueChange={(val) =>
                      setEditingPlan({
                        ...editingPlan,
                        model: val as SubscriptionModel,
                        monthly_credit_limit: val === "one" ? 1 : editingPlan.monthly_credit_limit,
                      })
                    }
                  >
                    <SelectTrigger className="text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one">Plano One (1 Corte/mês)</SelectItem>
                      <SelectItem value="recorrente">Recorrente (Créditos fixos)</SelectItem>
                      <SelectItem value="ilimitado">Ilimitado</SelectItem>
                      <SelectItem value="vip">Clube VIP (Prioridade)</SelectItem>
                      <SelectItem value="avulso">Pacote Avulso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-medium">Ciclo de Cobrança</Label>
                  <Select
                    value={editingPlan.billing_cycle || "mensal"}
                    onValueChange={(val) =>
                      setEditingPlan({ ...editingPlan, billing_cycle: val as BillingCycle })
                    }
                  >
                    <SelectTrigger className="text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="trimestral">Trimestral</SelectItem>
                      <SelectItem value="semestral">Semestral</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingPlan.price ?? 59.9}
                    onChange={(e) =>
                      setEditingPlan({ ...editingPlan, price: parseFloat(e.target.value) || 0 })
                    }
                    className="text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-medium">Limite Mensal de Cortes</Label>
                  <Input
                    type="number"
                    disabled={
                      editingPlan.model === "one" ||
                      editingPlan.model === "ilimitado" ||
                      editingPlan.model === "vip"
                    }
                    value={
                      editingPlan.model === "one"
                        ? 1
                        : editingPlan.model === "ilimitado" || editingPlan.model === "vip"
                        ? 9999
                        : editingPlan.monthly_credit_limit || 2
                    }
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        monthly_credit_limit: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="text-xs mt-1"
                  />
                  {editingPlan.model === "one" && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Fixo em exatamente 1 corte por mês (Regra One).
                    </p>
                  )}
                </div>
              </div>

              {/* Benefícios */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Benefícios do Plano</Label>
                <div className="flex gap-2">
                  <Input
                    value={benefitInput}
                    onChange={(e) => setBenefitInput(e.target.value)}
                    placeholder="Ex: 10% de desconto em pomadas"
                    className="text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addBenefitToPlan();
                      }
                    }}
                  />
                  <Button type="button" size="sm" onClick={addBenefitToPlan} className="text-xs">
                    + Adicionar
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(editingPlan.benefits || []).map((b, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="text-[10px] flex items-center gap-1 pr-1"
                    >
                      <span>{b}</span>
                      <button
                        type="button"
                        onClick={() => removeBenefitFromPlan(idx)}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Label className="text-xs font-medium">Plano Ativo para Venda</Label>
                <Switch
                  checked={editingPlan.active ?? true}
                  onCheckedChange={(checked) => setEditingPlan({ ...editingPlan, active: checked })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditingPlan(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => editingPlan && savePlanMutation.mutate(editingPlan)}
              disabled={!editingPlan?.name?.trim() || savePlanMutation.isPending}
            >
              Salvar Plano
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* DIÁLOGO: VINCULAR NOVA ASSINATURA AO CLIENTE */}
      {/* =================================================================== */}
      <Dialog open={!!editingSub} onOpenChange={(o) => !o && setEditingSub(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSub?.id ? "Editar Assinatura" : "Nova Assinatura de Cliente"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Vincule um cliente a um dos planos de serviço da barbearia.
            </DialogDescription>
          </DialogHeader>

          {editingSub && (
            <div className="space-y-3.5 py-2 text-xs">
              <div>
                <Label className="text-xs font-medium">Cliente</Label>
                <Select
                  value={editingSub.client_id}
                  onValueChange={(val) => setEditingSub({ ...editingSub, client_id: val })}
                >
                  <SelectTrigger className="text-xs mt-1">
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-medium">Plano Contratado</Label>
                <Select
                  value={editingSub.plan_id}
                  onValueChange={(val) => setEditingSub({ ...editingSub, plan_id: val })}
                >
                  <SelectTrigger className="text-xs mt-1">
                    <SelectValue placeholder="Selecione o plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {brl(p.price)} ({MODEL_LABELS[p.model].label})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Status da Assinatura</Label>
                  <Select
                    value={editingSub.status || "ativa"}
                    onValueChange={(val) =>
                      setEditingSub({ ...editingSub, status: val as SubscriptionStatus })
                    }
                  >
                    <SelectTrigger className="text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativa">Ativa</SelectItem>
                      <SelectItem value="pausada">Pausada</SelectItem>
                      <SelectItem value="inadimplente">Inadimplente</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-medium">Créditos Já Utilizados</Label>
                  <Input
                    type="number"
                    value={editingSub.credits_used_this_period ?? 0}
                    onChange={(e) =>
                      setEditingSub({
                        ...editingSub,
                        credits_used_this_period: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="text-xs mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium">Data de Renovação / Próximo Vencimento</Label>
                <Input
                  type="date"
                  value={
                    editingSub.renews_at
                      ? editingSub.renews_at.slice(0, 10)
                      : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
                  }
                  onChange={(e) =>
                    setEditingSub({
                      ...editingSub,
                      renews_at: new Date(e.target.value + "T12:00:00Z").toISOString(),
                    })
                  }
                  className="text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-medium">Observações Internas</Label>
                <Textarea
                  value={editingSub.notes || ""}
                  onChange={(e) => setEditingSub({ ...editingSub, notes: e.target.value })}
                  placeholder="Ex: Pagamento via Pix recorrente todo dia 10..."
                  rows={2}
                  className="text-xs mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditingSub(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => editingSub && saveSubMutation.mutate(editingSub)}
              disabled={!editingSub?.client_id || !editingSub?.plan_id || saveSubMutation.isPending}
            >
              Salvar Assinatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
