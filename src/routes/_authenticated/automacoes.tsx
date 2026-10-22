import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageCircle,
  Clock,
  Sparkles,
  Cake,
  Repeat,
  AlertTriangle,
  Settings,
  Send,
  History,
  CheckCircle2,
  Users,
  Search,
  ExternalLink,
  ShieldAlert,
  Save,
  ShoppingBag,
  DollarSign,
  UserX,
  CreditCard,
  Building2,
  ShieldCheck,
  Calendar,
  Lock,
  Unlock,
  Star,
  Bell,
  ThumbsUp,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Stat } from "@/components/AppShell";
import { useProfessionals, useServices } from "@/lib/lookups";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { brl, db, fmtDate, todayISO } from "@/lib/db";
import {
  buildAutomatedWhatsAppMessage,
  DEFAULT_AUTOMATION_SETTINGS,
  detectInactiveClients,
  detectProductReorders,
  detectUpcomingBirthdays,
  detectUpcomingSubscriptionDues,
  formatWhatsAppPhone,
  generateWhatsAppUrl,
} from "@/lib/automation-engine";
import type {
  AutomationMessageLog,
  AutomationSettingsData,
  AutomationTriggerType,
  BirthdayClientCandidate,
  InactiveClientCandidate,
  ProductReorderCandidate,
  SubscriptionDueCandidate,
} from "@/types/automation";
import type { SalonSettingsData } from "@/types/salon";

export const Route = createFileRoute("/_authenticated/automacoes")({
  head: () => ({
    meta: [
      { title: "Automações & WhatsApp — Belezi" },
      {
        name: "description",
        content:
          "Motor de automação de relacionamento para barbearias: lembretes de agendamento, recuperação de inativos, recompra e gestão de faltas.",
      },
    ],
  }),
  component: AutomacoesPage,
});

function AutomacoesPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<
    | "lembretes"
    | "pos_atendimento"
    | "inativos"
    | "recompra"
    | "aniversarios"
    | "cobranca"
    | "faltas"
    | "templates"
    | "logs"
  >("lembretes");
  const [inactiveRangeFilter, setInactiveRangeFilter] = useState<
    "all" | "30_60" | "60_90" | "90_plus"
  >("all");

  const [searchQuery, setSearchQuery] = useState("");

  // Modal de Disparo de WhatsApp
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [messageData, setMessageData] = useState<{
    trigger_type: AutomationTriggerType;
    client_id?: string;
    client_name: string;
    phone: string;
    message: string;
  }>({
    trigger_type: "recuperacao_inativo",
    client_name: "",
    phone: "",
    message: "",
  });

  // 1. Dados da Barbearia
  const { data: salon = null } = useQuery<SalonSettingsData | null>({
    queryKey: ["salon-settings"],
    queryFn: async () => {
      const { data, error } = await db.from("salon_settings").select("*").maybeSingle();
      if (error) return null;
      return data as SalonSettingsData;
    },
  });

  // 2. Configurações de Automação
  const { data: settings = DEFAULT_AUTOMATION_SETTINGS } = useQuery<AutomationSettingsData>({
    queryKey: ["salon-automation-settings"],
    queryFn: async () => {
      const { data, error } = await db
        .from("salon_automation_settings")
        .select("*")
        .maybeSingle();
      if (error) return DEFAULT_AUTOMATION_SETTINGS;
      if (!data) return DEFAULT_AUTOMATION_SETTINGS;
      return {
        ...DEFAULT_AUTOMATION_SETTINGS,
        ...data,
        custom_templates: {
          ...DEFAULT_AUTOMATION_SETTINGS.custom_templates,
          ...(data.custom_templates || {}),
        },
      };
    },
  });

  // Estado local para o formulário de configurações/templates
  const [formSettings, setFormSettings] = useState<AutomationSettingsData>(settings);

  // Sincronizar formSettings quando settings for carregado
  useMemo(() => {
    if (settings) {
      setFormSettings(settings);
    }
  }, [settings]);

  // 3. Consulta de Clientes
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await db.from("clients").select("*").order("name");
      if (error) return [];
      return data ?? [];
    },
  });

  // 4. Consulta de Comandas Fechadas
  const { data: orders = [] } = useQuery({
    queryKey: ["orders-automation"],
    queryFn: async () => {
      const { data, error } = await db
        .from("orders")
        .select("id, number, client_id, total, status, closed_at, created_at")
        .eq("status", "fechada")
        .order("closed_at", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });

  // 5. Consulta de Itens de Comandas (para recompra de produtos)
  const { data: orderItems = [] } = useQuery({
    queryKey: ["order-items-automation"],
    queryFn: async () => {
      const { data, error } = await db
        .from("order_items")
        .select("id, order_id, kind, description, qty, unit_price, created_at")
        .eq("kind", "produto");
      if (error) return [];
      return data ?? [];
    },
  });

  // 6. Consulta de Assinaturas Ativas
  const { data: subscriptions = [] } = useQuery({
    queryKey: ["client-subscriptions-automation"],
    queryFn: async () => {
      const { data, error } = await db
        .from("client_subscriptions")
        .select("*, clients:clients(name, phone), plans:salon_client_plans(name, price)")
        .eq("status", "ativa");
      if (error) return [];
      return data ?? [];
    },
  });

  // 7. Consulta de Histórico de Disparos
  const { data: logs = [] } = useQuery<AutomationMessageLog[]>({
    queryKey: ["automation-logs"],
    queryFn: async () => {
      const { data, error } = await db
        .from("automation_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return [];
      return (data ?? []) as AutomationMessageLog[];
    },
  });

  // 8. Consultas para Lembretes e Pós-Atendimento
  const { data: pros = [] } = useProfessionals();
  const { data: services = [] } = useServices();

  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments-automation"],
    queryFn: async () => {
      try {
        const { data, error } = await db
          .from("appointments")
          .select("*")
          .order("starts_at", { ascending: true });
        if (error) return [];
        return data ?? [];
      } catch {
        return [];
      }
    },
  });

  const todayStr = todayISO();

  // Detecção de Lembretes Pré-Atendimento (2 horas antes)
  const upcomingReminders = useMemo(() => {
    const todayAppts = appointments.filter((a: any) => {
      if (!a.starts_at) return false;
      const apptDate = a.starts_at.slice(0, 10);
      const isNotDone = a.status !== "cancelado" && a.status !== "bloqueado";
      return apptDate === todayStr && isNotDone;
    });

    const now = new Date();
    return todayAppts.map((a: any) => {
      const client = clients.find((c: any) => c.id === a.client_id);
      const pro = pros.find((p: any) => p.id === a.professional_id);
      const srv = services.find((s: any) => s.id === a.service_id);
      const starts = new Date(a.starts_at);
      const diffMs = starts.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      const diffMinutes = Math.round(diffMs / (1000 * 60));

      const isWithinWindow = diffHours > 0 && diffHours <= (settings.reminder_hours_before || 2);
      const isPast = diffMinutes < 0;

      return {
        id: a.id,
        appointment_id: a.id,
        client_id: a.client_id,
        name: client?.name || "Cliente Agendado",
        phone: client?.phone || "",
        starts_at: a.starts_at,
        date: apptDate,
        time: `${starts.getHours().toString().padStart(2, "0")}:${starts.getMinutes().toString().padStart(2, "0")}`,
        professional_name: pro?.name || "Barbeiro",
        service_name: srv?.name || "Corte e Barba",
        status: a.status,
        isWithinWindow,
        isPast,
        diffMinutes,
      };
    });
  }, [appointments, clients, pros, services, todayStr, settings.reminder_hours_before]);

  // Detecção de Pós-Atendimento (Pesquisa de Satisfação de atendimentos concluídos)
  const postServiceCandidates = useMemo(() => {
    const completed = appointments.filter(
      (a: any) => a.status === "concluido" && a.starts_at,
    );

    return completed.slice(-30).map((a: any) => {
      const client = clients.find((c: any) => c.id === a.client_id);
      const pro = pros.find((p: any) => p.id === a.professional_id);
      const srv = services.find((s: any) => s.id === a.service_id);
      const starts = new Date(a.starts_at);

      return {
        id: a.id,
        client_id: a.client_id,
        name: client?.name || "Cliente",
        phone: client?.phone || "",
        date: a.starts_at.slice(0, 10),
        time: `${starts.getHours().toString().padStart(2, "0")}:${starts.getMinutes().toString().padStart(2, "0")}`,
        professional_name: pro?.name || "Equipe",
        service_name: srv?.name || "Atendimento",
      };
    });
  }, [appointments, clients, pros, services]);

  // 9. Detecções Inteligentes
  const inactiveCandidates = useMemo(() => {
    return detectInactiveClients(clients, orders, settings.inactive_clients_days);
  }, [clients, orders, settings.inactive_clients_days]);

  const filteredInactiveCandidates = useMemo(() => {
    return inactiveCandidates.filter((c) => {
      if (inactiveRangeFilter === "30_60") return c.days_inactive >= 30 && c.days_inactive <= 60;
      if (inactiveRangeFilter === "60_90") return c.days_inactive > 60 && c.days_inactive <= 90;
      if (inactiveRangeFilter === "90_plus") return c.days_inactive > 90;
      return true;
    });
  }, [inactiveCandidates, inactiveRangeFilter]);

  const productReorderCandidates = useMemo(() => {
    return detectProductReorders(orderItems, orders, clients, settings.product_reorder_days);
  }, [orderItems, orders, clients, settings.product_reorder_days]);

  const birthdayCandidates = useMemo(() => {
    return detectUpcomingBirthdays(clients);
  }, [clients]);

  const subscriptionDueCandidates = useMemo(() => {
    return detectUpcomingSubscriptionDues(subscriptions, settings.subscription_notice_days_before);
  }, [subscriptions, settings.subscription_notice_days_before]);

  // Clientes com faltas registradas ou bloqueados
  const penalizedClients = useMemo(() => {
    return clients.filter((c: any) => c.no_shows_count > 0 || c.is_blocked_booking);
  }, [clients]);

  // Salvar configurações e templates
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        reminder_enabled: formSettings.reminder_enabled,
        reminder_hours_before: Number(formSettings.reminder_hours_before),
        birthday_enabled: formSettings.birthday_enabled,
        birthday_coupon_text: formSettings.birthday_coupon_text,
        inactive_clients_days: Number(formSettings.inactive_clients_days),
        inactive_coupon_text: formSettings.inactive_coupon_text,
        product_reorder_enabled: formSettings.product_reorder_enabled,
        product_reorder_days: Number(formSettings.product_reorder_days),
        product_reorder_message: formSettings.product_reorder_message,
        subscription_notice_enabled: formSettings.subscription_notice_enabled,
        subscription_notice_days_before: Number(formSettings.subscription_notice_days_before),
        no_show_tolerance_minutes: Number(formSettings.no_show_tolerance_minutes),
        max_no_shows_before_block: Number(formSettings.max_no_shows_before_block),
        no_show_fee: Number(formSettings.no_show_fee),
        require_advance_payment_blocked: formSettings.require_advance_payment_blocked,
        custom_templates: formSettings.custom_templates,
        updated_at: new Date().toISOString(),
      };

      const { error } = await db
        .from("salon_automation_settings")
        .upsert(payload, { onConflict: "owner_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["salon-automation-settings"] });
      toast.success("Regras e templates de automação salvos com sucesso!");
    },
    onError: (e: any) => toast.error(`Erro ao salvar: ${e.message}`),
  });

  // Desbloquear ou abonar faltas de cliente
  const unblockClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await db
        .from("clients")
        .update({
          is_blocked_booking: false,
          no_shows_count: 0,
          block_reason: null,
        })
        .eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente desbloqueado e faltas abonadas!");
    },
    onError: (e: any) => toast.error(`Erro ao desbloquear: ${e.message}`),
  });

  // Registrar disparo no log e abrir WhatsApp
  const dispatchWhatsAppMutation = useMutation({
    mutationFn: async () => {
      // Registrar log no banco
      const { error } = await db.from("automation_logs").insert({
        trigger_type: messageData.trigger_type,
        client_id: messageData.client_id || null,
        phone: messageData.phone,
        recipient_name: messageData.client_name,
        message_body: messageData.message,
        status: "enviado",
        channel: "whatsapp",
      });
      if (error) console.warn("Erro ao gravar log:", error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation-logs"] });
      setSendModalOpen(false);

      // Abrir o WhatsApp via link inteligente com a mensagem formatada
      const url = generateWhatsAppUrl(messageData.phone, messageData.message);
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success(`WhatsApp aberto com a mensagem para ${messageData.client_name}!`);
    },
  });

  // Preparar mensagem para envio rápido
  function prepareMessage(
    triggerType: AutomationTriggerType,
    candidate: {
      id?: string;
      name: string;
      phone?: string | null;
      extra?: any;
    },
  ) {
    const barbearia = salon?.name || "Belezi Barbearia";
    let body = "";

    if (triggerType === "recuperacao_inativo") {
      body = buildAutomatedWhatsAppMessage(triggerType, settings.custom_templates, {
        cliente: candidate.name,
        barbearia,
        cupom: settings.inactive_coupon_text,
      });
    } else if (triggerType === "recompra_produto") {
      body = buildAutomatedWhatsAppMessage(triggerType, settings.custom_templates, {
        cliente: candidate.name,
        barbearia,
        produto: candidate.extra?.product_name || "produto",
      });
    } else if (triggerType === "aniversario") {
      body = buildAutomatedWhatsAppMessage(triggerType, settings.custom_templates, {
        cliente: candidate.name,
        barbearia,
        cupom: settings.birthday_coupon_text,
      });
    } else if (triggerType === "cobranca_plano") {
      body = buildAutomatedWhatsAppMessage(triggerType, settings.custom_templates, {
        cliente: candidate.name,
        barbearia,
        plano: candidate.extra?.plan_name,
        valor: candidate.extra?.plan_price ? brl(candidate.extra.plan_price) : "",
        vencimento: candidate.extra?.renews_at ? fmtDate(candidate.extra.renews_at) : "",
        pix: salon?.phone || barbearia,
      });
    } else if (triggerType === "aviso_falta") {
      body = buildAutomatedWhatsAppMessage(triggerType, settings.custom_templates, {
        cliente: candidate.name,
        barbearia,
        data: candidate.extra?.date || todayISO(),
      });
    } else if (triggerType === "lembrete_agendamento") {
      body = buildAutomatedWhatsAppMessage(triggerType, settings.custom_templates, {
        cliente: candidate.name,
        barbearia,
        horario: candidate.extra?.time || "10:00",
        barbeiro: candidate.extra?.professional || "nossa equipe",
        servico: candidate.extra?.service || "corte",
        data: candidate.extra?.date || todayISO(),
      });
    } else if (triggerType === "pos_atendimento") {
      body = buildAutomatedWhatsAppMessage(triggerType, settings.custom_templates, {
        cliente: candidate.name,
        barbearia,
        barbeiro: candidate.extra?.professional || "nossa equipe",
        servico: candidate.extra?.service || "atendimento",
      });
    }

    setMessageData({
      trigger_type: triggerType,
      client_id: candidate.id,
      client_name: candidate.name,
      phone: candidate.phone || "",
      message: body,
    });

    setSendModalOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automações & WhatsApp"
        subtitle="Lembretes, recuperação de clientes inativos, recompra de produtos, cobrança de planos e regras de faltas"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab("templates")}
              className="gap-1.5"
            >
              <Settings className="h-4 w-4" />
              Configurar Regras & Textos
            </Button>
          </div>
        }
      />

      {/* Banner de Isolamento e Segurança por salon_id */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-primary mt-0.5" />
          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-primary">
                Motor de Automação Inteligente & Isolamento por salon_id
              </span>
              <Badge variant="outline" className="border-primary/30 text-xs text-primary">
                Etapa 11
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Todas as regras, gatilhos de reengajamento, templates e histórico de mensagens operam
              estritamente sobre a base de clientes da sua barbearia. Os links gerados abrem diretamente
              o WhatsApp Web ou celular com os dados pré-preenchidos para disparo com 1 clique.
            </p>
          </div>
        </div>
      </div>

      {/* Indicadores de Oportunidades & Alertas */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          className="border-l-4 border-l-amber-500 shadow-xs cursor-pointer hover:bg-muted/10 transition-colors"
          onClick={() => setActiveTab("inativos")}
        >
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Clientes Inativos (&gt;{settings.inactive_clients_days} dias)</span>
              <UserX className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {inactiveCandidates.length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Oportunidades de reengajamento</p>
          </CardContent>
        </Card>

        <Card
          className="border-l-4 border-l-blue-500 shadow-xs cursor-pointer hover:bg-muted/10 transition-colors"
          onClick={() => setActiveTab("recompra")}
        >
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Recompra de Produtos</span>
              <ShoppingBag className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
              {productReorderCandidates.length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Reposição de pomadas e óleos</p>
          </CardContent>
        </Card>

        <Card
          className="border-l-4 border-l-emerald-500 shadow-xs cursor-pointer hover:bg-muted/10 transition-colors"
          onClick={() => setActiveTab("aniversarios")}
        >
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Aniversariantes do Mês</span>
              <Cake className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {birthdayCandidates.length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {birthdayCandidates.filter((b) => b.is_today).length} celebrando hoje!
            </p>
          </CardContent>
        </Card>

        <Card
          className="border-l-4 border-l-rose-500 shadow-xs cursor-pointer hover:bg-muted/10 transition-colors"
          onClick={() => setActiveTab("faltas")}
        >
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Gestão de Faltas & No-Shows</span>
              <AlertTriangle className="h-4 w-4 text-rose-500" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              {penalizedClients.length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {penalizedClients.filter((c: any) => c.is_blocked_booking).length} clientes bloqueados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Abas Principais de Automações */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 max-w-full overflow-x-auto">
          <TabsTrigger value="lembretes" className="gap-1 text-xs text-primary font-semibold">
            <Clock className="h-3.5 w-3.5" />
            Lembretes ({upcomingReminders.length})
          </TabsTrigger>
          <TabsTrigger value="pos_atendimento" className="gap-1 text-xs text-emerald-600 font-semibold">
            <Star className="h-3.5 w-3.5" />
            Pós-Atendimento ({postServiceCandidates.length})
          </TabsTrigger>
          <TabsTrigger value="inativos" className="gap-1 text-xs">
            <UserX className="h-3.5 w-3.5" />
            Inativos ({inactiveCandidates.length})
          </TabsTrigger>
          <TabsTrigger value="recompra" className="gap-1 text-xs">
            <ShoppingBag className="h-3.5 w-3.5" />
            Recompra ({productReorderCandidates.length})
          </TabsTrigger>
          <TabsTrigger value="aniversarios" className="gap-1 text-xs">
            <Cake className="h-3.5 w-3.5" />
            Aniversários ({birthdayCandidates.length})
          </TabsTrigger>
          <TabsTrigger value="cobranca" className="gap-1 text-xs">
            <CreditCard className="h-3.5 w-3.5" />
            Cobrança ({subscriptionDueCandidates.length})
          </TabsTrigger>
          <TabsTrigger value="faltas" className="gap-1 text-xs">
            <ShieldAlert className="h-3.5 w-3.5" />
            Faltas ({penalizedClients.length})
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1 text-xs">
            <Settings className="h-3.5 w-3.5" />
            Regras & Textos
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1 text-xs">
            <History className="h-3.5 w-3.5" />
            Histórico ({logs.length})
          </TabsTrigger>
        </TabsList>

        {/* ABA 0: Lembretes Pré-Atendimento (2 horas antes) */}
        <TabsContent value="lembretes" className="space-y-4">
          <Card>
            <CardHeader className="p-4 sm:p-6 pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Lembretes Automáticos Pré-Atendimento
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Disparo de confirmação e lembrete {settings.reminder_hours_before || 2} horas antes do horário marcado para reduzir no-shows.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    {upcomingReminders.length} horários hoje
                  </Badge>
                  {upcomingReminders.length > 0 && (
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 text-xs bg-primary text-primary-foreground font-semibold"
                      onClick={() => {
                        upcomingReminders.forEach((r, idx) => {
                          if (r.phone) {
                            setTimeout(() => {
                              const url = generateWhatsAppUrl(
                                r.phone,
                                buildAutomatedWhatsAppMessage("lembrete_agendamento", settings.custom_templates, {
                                  cliente: r.name,
                                  barbearia: salon?.name || "Belezi",
                                  horario: r.time,
                                  barbeiro: r.professional_name,
                                  servico: r.service_name,
                                  data: r.date,
                                }),
                              );
                              window.open(url, "_blank", "noopener,noreferrer");
                            }, idx * 400);
                          }
                        });
                        toast.success(`Disparo em lote iniciado para ${upcomingReminders.length} clientes!`);
                      }}
                    >
                      <Zap className="h-3.5 w-3.5" /> Disparar Todos de Hoje
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <div className="overflow-x-auto">
                <table className="mobile-table w-full text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Horário</th>
                      <th className="px-4 py-3 text-left">Cliente</th>
                      <th className="px-4 py-3 text-left">Barbeiro</th>
                      <th className="px-4 py-3 text-left">Serviço</th>
                      <th className="px-4 py-3 text-center">Janela de Envio</th>
                      <th className="px-4 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingReminders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                          Nenhum agendamento pendente para a data de hoje.
                        </td>
                      </tr>
                    ) : (
                      upcomingReminders.map((r) => (
                        <tr key={r.id} className="border-b hover:bg-muted/20">
                          <td data-label="Horário" className="px-4 py-3 font-bold text-foreground">
                            {r.time}
                          </td>
                          <td data-label="Cliente" className="px-4 py-3">
                            <span className="font-semibold block">{r.name}</span>
                            <span className="text-xs text-muted-foreground">{r.phone || "Sem telefone"}</span>
                          </td>
                          <td data-label="Barbeiro" className="px-4 py-3 text-xs">
                            {r.professional_name}
                          </td>
                          <td data-label="Serviço" className="px-4 py-3 text-xs">
                            <Badge variant="outline">{r.service_name}</Badge>
                          </td>
                          <td data-label="Janela" className="px-4 py-3 text-center">
                            {r.isWithinWindow ? (
                              <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[11px]">
                                🔥 Janela Ideal (Faltam {r.diffMinutes} min)
                              </Badge>
                            ) : r.isPast ? (
                              <Badge variant="outline" className="text-muted-foreground text-[11px]">
                                Atendimento em curso
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground text-[11px]">
                                Em {r.diffMinutes} min
                              </Badge>
                            )}
                          </td>
                          <td data-label="Ação" className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              disabled={!r.phone}
                              onClick={() =>
                                prepareMessage("lembrete_agendamento", {
                                  id: r.client_id || r.id,
                                  name: r.name,
                                  phone: r.phone,
                                  extra: {
                                    time: r.time,
                                    professional: r.professional_name,
                                    service: r.service_name,
                                    date: r.date,
                                  },
                                })
                              }
                              className="h-8 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              Lembrar WhatsApp
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

        {/* ABA 0.5: Pós-Atendimento e Pesquisa de Satisfação */}
        <TabsContent value="pos_atendimento" className="space-y-4">
          <Card>
            <CardHeader className="p-4 sm:p-6 pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                    Pós-Atendimento & Pesquisa de Satisfação
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Disparo de pesquisa de satisfação (nota 1 a 5) para clientes que concluíram atendimento recentemente.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">
                  {postServiceCandidates.length} concluídos recentemente
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <div className="overflow-x-auto">
                <table className="mobile-table w-full text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Data / Hora</th>
                      <th className="px-4 py-3 text-left">Cliente</th>
                      <th className="px-4 py-3 text-left">Barbeiro</th>
                      <th className="px-4 py-3 text-left">Serviço Realizado</th>
                      <th className="px-4 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {postServiceCandidates.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                          Nenhum atendimento concluído registrado recentemente.
                        </td>
                      </tr>
                    ) : (
                      postServiceCandidates.map((c) => (
                        <tr key={c.id} className="border-b hover:bg-muted/20">
                          <td data-label="Data / Hora" className="px-4 py-3 text-xs font-semibold">
                            {fmtDate(c.date)} às {c.time}
                          </td>
                          <td data-label="Cliente" className="px-4 py-3">
                            <span className="font-semibold block">{c.name}</span>
                            <span className="text-xs text-muted-foreground">{c.phone || "Sem telefone"}</span>
                          </td>
                          <td data-label="Barbeiro" className="px-4 py-3 text-xs font-medium">
                            {c.professional_name}
                          </td>
                          <td data-label="Serviço" className="px-4 py-3 text-xs">
                            <Badge variant="outline">{c.service_name}</Badge>
                          </td>
                          <td data-label="Ação" className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              disabled={!c.phone}
                              onClick={() =>
                                prepareMessage("pos_atendimento", {
                                  id: c.client_id || c.id,
                                  name: c.name,
                                  phone: c.phone,
                                  extra: {
                                    professional: c.professional_name,
                                    service: c.service_name,
                                  },
                                })
                              }
                              className="h-8 gap-1.5 bg-amber-600 text-white hover:bg-amber-700 text-xs font-semibold"
                            >
                              <Star className="h-3.5 w-3.5" />
                              Pedir Avaliação
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

        {/* ABA 1: Recuperação de Inativos */}
        <TabsContent value="inativos" className="space-y-4">
          <Card>
            <CardHeader className="p-4 sm:p-6 pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base sm:text-lg">
                    Campanha de Recuperação de Clientes Inativos
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Clientes sem cortar cabelo há mais de {settings.inactive_clients_days} dias.
                    Envie um convite personalizado com incentivo de retorno.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    size="sm"
                    variant={inactiveRangeFilter === "all" ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => setInactiveRangeFilter("all")}
                  >
                    Todos ({inactiveCandidates.length})
                  </Button>
                  <Button
                    size="sm"
                    variant={inactiveRangeFilter === "30_60" ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => setInactiveRangeFilter("30_60")}
                  >
                    30-60 dias
                  </Button>
                  <Button
                    size="sm"
                    variant={inactiveRangeFilter === "60_90" ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => setInactiveRangeFilter("60_90")}
                  >
                    60-90 dias
                  </Button>
                  <Button
                    size="sm"
                    variant={inactiveRangeFilter === "90_plus" ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => setInactiveRangeFilter("90_plus")}
                  >
                    90+ dias
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <div className="overflow-x-auto">
                <table className="mobile-table w-full text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Cliente</th>
                      <th className="px-4 py-3 text-left">WhatsApp</th>
                      <th className="px-4 py-3 text-center">Última Visita</th>
                      <th className="px-4 py-3 text-center">Dias Inativo</th>
                      <th className="px-4 py-3 text-right">Total Investido</th>
                      <th className="px-4 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInactiveCandidates.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                          Nenhum cliente inativo encontrado nesta faixa de dias.
                        </td>
                      </tr>
                    ) : (
                      filteredInactiveCandidates.map((c) => (
                        <tr key={c.id} className="border-b hover:bg-muted/20">
                          <td data-label="Cliente" className="px-4 py-3 font-semibold text-foreground">
                            {c.name}
                          </td>
                          <td data-label="WhatsApp" className="px-4 py-3 text-xs text-muted-foreground">
                            {c.phone || "Sem telefone"}
                          </td>
                          <td data-label="Última Visita" className="px-4 py-3 text-center text-xs">
                            {c.last_service_date ? fmtDate(c.last_service_date) : "—"}
                          </td>
                          <td data-label="Inativo" className="px-4 py-3 text-center">
                            <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 font-semibold">
                              {c.days_inactive} dias
                            </Badge>
                          </td>
                          <td data-label="Total Gasto" className="px-4 py-3 text-right font-medium">
                            {brl(c.total_spent || 0)}
                          </td>
                          <td data-label="Ação" className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              onClick={() => prepareMessage("recuperacao_inativo", c)}
                              disabled={!c.phone}
                              className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              WhatsApp
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

        {/* ABA 2: Recompra de Produtos */}
        <TabsContent value="recompra" className="space-y-4">
          <Card>
            <CardHeader className="p-4 sm:p-6 pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base sm:text-lg">
                    Lembretes de Recompra e Reposição de Produtos
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Clientes que compraram pomadas, tônicos e óleos há mais de {settings.product_reorder_days} dias.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-blue-500/30 text-blue-600">
                  {productReorderCandidates.length} reposições previstas
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <div className="overflow-x-auto">
                <table className="mobile-table w-full text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Cliente</th>
                      <th className="px-4 py-3 text-left">Produto Comprado</th>
                      <th className="px-4 py-3 text-center">Data da Compra</th>
                      <th className="px-4 py-3 text-center">Dias Corridos</th>
                      <th className="px-4 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productReorderCandidates.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                          Nenhum cliente com produto prestes a acabar no momento.
                        </td>
                      </tr>
                    ) : (
                      productReorderCandidates.map((p) => (
                        <tr key={p.id} className="border-b hover:bg-muted/20">
                          <td data-label="Cliente" className="px-4 py-3 font-semibold text-foreground">
                            {p.client_name}
                          </td>
                          <td data-label="Produto" className="px-4 py-3 font-medium text-primary">
                            {p.product_name}
                          </td>
                          <td data-label="Data da Compra" className="px-4 py-3 text-center text-xs">
                            {fmtDate(p.purchase_date)}
                          </td>
                          <td data-label="Dias Corridos" className="px-4 py-3 text-center">
                            <Badge className="bg-blue-500/15 text-blue-700 border-blue-500/30">
                              {p.days_since_purchase} dias atrás
                            </Badge>
                          </td>
                          <td data-label="Ação" className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              onClick={() =>
                                prepareMessage("recompra_produto", {
                                  name: p.client_name,
                                  phone: p.client_phone,
                                  extra: { product_name: p.product_name },
                                })
                              }
                              disabled={!p.client_phone}
                              className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              Sugerir Reposição
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

        {/* ABA 3: Aniversariantes */}
        <TabsContent value="aniversarios" className="space-y-4">
          <Card>
            <CardHeader className="p-4 sm:p-6 pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base sm:text-lg">
                    Aniversariantes & Felicitações com Presente
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Clientes celebrando aniversário neste mês. Envie parabéns e fidelize com um presente especial.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-600">
                  {birthdayCandidates.length} aniversariantes
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <div className="overflow-x-auto">
                <table className="mobile-table w-full text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Cliente</th>
                      <th className="px-4 py-3 text-left">Data de Nascimento</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {birthdayCandidates.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-sm text-muted-foreground">
                          Nenhum aniversariante cadastrado com data neste mês.
                        </td>
                      </tr>
                    ) : (
                      birthdayCandidates.map((b) => (
                        <tr key={b.id} className="border-b hover:bg-muted/20">
                          <td data-label="Cliente" className="px-4 py-3 font-semibold text-foreground">
                            {b.name}
                          </td>
                          <td data-label="Data" className="px-4 py-3 text-xs">
                            {fmtDate(b.birth_date)} {b.age ? `(${b.age} anos)` : ""}
                          </td>
                          <td data-label="Status" className="px-4 py-3 text-center">
                            {b.is_today ? (
                              <Badge className="bg-emerald-600 text-white animate-pulse">
                                🎉 É HOJE!
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                Neste Mês
                              </Badge>
                            )}
                          </td>
                          <td data-label="Ação" className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              onClick={() =>
                                prepareMessage("aniversario", {
                                  id: b.id,
                                  name: b.name,
                                  phone: b.phone,
                                })
                              }
                              disabled={!b.phone}
                              className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                            >
                              <Cake className="h-3.5 w-3.5" />
                              Enviar Parabéns
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

        {/* ABA 4: Vencimento e Cobrança de Planos */}
        <TabsContent value="cobranca" className="space-y-4">
          <Card>
            <CardHeader className="p-4 sm:p-6 pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base sm:text-lg">
                    Cobrança e Vencimento de Assinaturas dos Clientes
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Assinaturas com renovação nos próximos {settings.subscription_notice_days_before} dias.
                    Envie mensagem com a chave PIX e valor.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-primary/30 text-primary">
                  {subscriptionDueCandidates.length} a vencer
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <div className="overflow-x-auto">
                <table className="mobile-table w-full text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Cliente</th>
                      <th className="px-4 py-3 text-left">Plano do Clube</th>
                      <th className="px-4 py-3 text-right">Valor Mensal</th>
                      <th className="px-4 py-3 text-center">Vencimento</th>
                      <th className="px-4 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptionDueCandidates.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                          Nenhuma assinatura com vencimento nos próximos dias.
                        </td>
                      </tr>
                    ) : (
                      subscriptionDueCandidates.map((sub) => (
                        <tr key={sub.id} className="border-b hover:bg-muted/20">
                          <td data-label="Cliente" className="px-4 py-3 font-semibold text-foreground">
                            {sub.client_name}
                          </td>
                          <td data-label="Plano" className="px-4 py-3 font-medium text-primary">
                            {sub.plan_name}
                          </td>
                          <td data-label="Valor" className="px-4 py-3 text-right font-bold">
                            {brl(sub.plan_price)}
                          </td>
                          <td data-label="Vencimento" className="px-4 py-3 text-center text-xs">
                            {fmtDate(sub.renews_at)} (em {sub.days_until_due} dias)
                          </td>
                          <td data-label="Ação" className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              onClick={() =>
                                prepareMessage("cobranca_plano", {
                                  name: sub.client_name,
                                  phone: sub.client_phone,
                                  extra: sub,
                                })
                              }
                              disabled={!sub.client_phone}
                              className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              Cobrar PIX
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

        {/* ABA 5: Gestão de Faltas & Penalizações */}
        <TabsContent value="faltas" className="space-y-4">
          <Card>
            <CardHeader className="p-4 sm:p-6 pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base sm:text-lg">
                    Gestão de Faltas (No-Show) e Bloqueios
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Regra configurada: tolerância de {settings.no_show_tolerance_minutes} minutos e bloqueio automático após {settings.max_no_shows_before_block} faltas injustificadas.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <div className="overflow-x-auto">
                <table className="mobile-table w-full text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Cliente</th>
                      <th className="px-4 py-3 text-left">Telefone</th>
                      <th className="px-4 py-3 text-center">Faltas Acumuladas</th>
                      <th className="px-4 py-3 text-center">Status de Agendamento</th>
                      <th className="px-4 py-3 text-left">Motivo / Observação</th>
                      <th className="px-4 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {penalizedClients.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                          Nenhum cliente com histórico de faltas ou bloqueios.
                        </td>
                      </tr>
                    ) : (
                      penalizedClients.map((c: any) => (
                        <tr key={c.id} className="border-b hover:bg-muted/20">
                          <td data-label="Cliente" className="px-4 py-3 font-semibold text-foreground">
                            {c.name}
                          </td>
                          <td data-label="Telefone" className="px-4 py-3 text-xs text-muted-foreground">
                            {c.phone || "—"}
                          </td>
                          <td data-label="Faltas" className="px-4 py-3 text-center">
                            <Badge className="bg-rose-500/15 text-rose-700 border-rose-500/30 font-bold">
                              {c.no_shows_count} falta(s)
                            </Badge>
                          </td>
                          <td data-label="Status" className="px-4 py-3 text-center">
                            {c.is_blocked_booking ? (
                              <Badge className="bg-destructive text-destructive-foreground gap-1">
                                <Lock className="h-3 w-3" />
                                Bloqueado Online
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600 border-amber-500/30">
                                Em Observação
                              </Badge>
                            )}
                          </td>
                          <td data-label="Motivo" className="px-4 py-3 text-xs text-muted-foreground">
                            {c.block_reason || "Faltas registradas"}
                          </td>
                          <td data-label="Ação" className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {c.phone && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    prepareMessage("aviso_falta", {
                                      id: c.id,
                                      name: c.name,
                                      phone: c.phone,
                                    })
                                  }
                                  className="h-8 gap-1 text-xs"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                  Notificar
                                </Button>
                              )}
                              <Button
                                size="sm"
                                onClick={() => unblockClientMutation.mutate(c.id)}
                                className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                              >
                                <Unlock className="h-3.5 w-3.5" />
                                Abonar / Liberar
                              </Button>
                            </div>
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

        {/* ABA 6: Configurações & Templates de Mensagens */}
        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader className="p-4 sm:p-6 pb-2">
              <CardTitle className="text-base sm:text-lg">
                Templates de Mensagens & Parâmetros de Disparo
              </CardTitle>
              <CardDescription className="text-xs">
                Personalize os textos do WhatsApp e os intervalos dos gatilhos automáticos.
                Use marcadores dinâmicos como <code>{"{{cliente}}"}</code>, <code>{"{{barbearia}}"}</code>, <code>{"{{horario}}"}</code>, <code>{"{{cupom}}"}</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-4 sm:p-6 sm:pt-0">
              {/* Parâmetros Numéricos */}
              <div className="grid gap-4 sm:grid-cols-3 border-b pb-4">
                <div className="space-y-1.5">
                  <Label>Lembrete de Horário (Horas antes)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="48"
                    value={formSettings.reminder_hours_before}
                    onChange={(e) =>
                      setFormSettings((prev) => ({
                        ...prev,
                        reminder_hours_before: Number(e.target.value),
                      }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Inatividade (Dias sem corte)</Label>
                  <Input
                    type="number"
                    min="15"
                    max="180"
                    value={formSettings.inactive_clients_days}
                    onChange={(e) =>
                      setFormSettings((prev) => ({
                        ...prev,
                        inactive_clients_days: Number(e.target.value),
                      }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Recompra de Produtos (Dias após compra)</Label>
                  <Input
                    type="number"
                    min="15"
                    max="180"
                    value={formSettings.product_reorder_days}
                    onChange={(e) =>
                      setFormSettings((prev) => ({
                        ...prev,
                        product_reorder_days: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>

              {/* Faltas e Penalidades */}
              <div className="grid gap-4 sm:grid-cols-2 border-b pb-4">
                <div className="space-y-1.5">
                  <Label>Tolerância de Atraso (Minutos)</Label>
                  <Input
                    type="number"
                    min="5"
                    max="60"
                    value={formSettings.no_show_tolerance_minutes}
                    onChange={(e) =>
                      setFormSettings((prev) => ({
                        ...prev,
                        no_show_tolerance_minutes: Number(e.target.value),
                      }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Máximo de Faltas antes de Bloquear</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={formSettings.max_no_shows_before_block}
                    onChange={(e) =>
                      setFormSettings((prev) => ({
                        ...prev,
                        max_no_shows_before_block: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>

              {/* Textos dos Cupons */}
              <div className="grid gap-4 sm:grid-cols-2 border-b pb-4">
                <div className="space-y-1.5">
                  <Label>Texto do Presente de Aniversário</Label>
                  <Input
                    value={formSettings.birthday_coupon_text}
                    onChange={(e) =>
                      setFormSettings((prev) => ({
                        ...prev,
                        birthday_coupon_text: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Texto do Cupom de Retorno (Inativos)</Label>
                  <Input
                    value={formSettings.inactive_coupon_text}
                    onChange={(e) =>
                      setFormSettings((prev) => ({
                        ...prev,
                        inactive_coupon_text: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              {/* Templates de Mensagens */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm">Modelos de Mensagens do WhatsApp</h4>

                <div className="space-y-1.5">
                  <Label>Lembrete de Horário</Label>
                  <Textarea
                    rows={2}
                    value={formSettings.custom_templates?.lembrete || ""}
                    onChange={(e) =>
                      setFormSettings((prev) => ({
                        ...prev,
                        custom_templates: {
                          ...prev.custom_templates,
                          lembrete: e.target.value,
                        },
                      }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Recuperação de Inativos</Label>
                  <Textarea
                    rows={2}
                    value={formSettings.custom_templates?.recuperacao || ""}
                    onChange={(e) =>
                      setFormSettings((prev) => ({
                        ...prev,
                        custom_templates: {
                          ...prev.custom_templates,
                          recuperacao: e.target.value,
                        },
                      }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Recompra de Produtos</Label>
                  <Textarea
                    rows={2}
                    value={formSettings.custom_templates?.recompra_produto || ""}
                    onChange={(e) =>
                      setFormSettings((prev) => ({
                        ...prev,
                        custom_templates: {
                          ...prev.custom_templates,
                          recompra_produto: e.target.value,
                        },
                      }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Cobrança de Plano do Clube (com PIX)</Label>
                  <Textarea
                    rows={2}
                    value={formSettings.custom_templates?.cobranca_plano || ""}
                    onChange={(e) =>
                      setFormSettings((prev) => ({
                        ...prev,
                        custom_templates: {
                          ...prev.custom_templates,
                          cobranca_plano: e.target.value,
                        },
                      }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Aviso de Falta / No-Show</Label>
                  <Textarea
                    rows={2}
                    value={formSettings.custom_templates?.falta_aviso || ""}
                    onChange={(e) =>
                      setFormSettings((prev) => ({
                        ...prev,
                        custom_templates: {
                          ...prev.custom_templates,
                          falta_aviso: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => saveSettingsMutation.mutate()}
                  disabled={saveSettingsMutation.isPending}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  {saveSettingsMutation.isPending ? "Salvando..." : "Salvar Configurações"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 7: Histórico de Disparos */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader className="p-4 sm:p-6 pb-2">
              <CardTitle className="text-base sm:text-lg">Histórico de Disparos WhatsApp</CardTitle>
              <CardDescription className="text-xs">
                Auditoria de todas as mensagens e campanhas geradas pela barbearia
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <div className="overflow-x-auto">
                <table className="mobile-table w-full text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Data & Hora</th>
                      <th className="px-4 py-3 text-left">Destinatário</th>
                      <th className="px-4 py-3 text-left">Gatilho</th>
                      <th className="px-4 py-3 text-left">Mensagem</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                          Nenhum disparo registrado no histórico até o momento.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} className="border-b hover:bg-muted/20">
                          <td data-label="Data" className="px-4 py-3 font-medium text-xs whitespace-nowrap">
                            {fmtDate(log.created_at)}
                          </td>
                          <td data-label="Destinatário" className="px-4 py-3 font-medium">
                            {log.recipient_name || "Cliente"}
                            <div className="text-xs text-muted-foreground">{log.phone}</div>
                          </td>
                          <td data-label="Gatilho" className="px-4 py-3">
                            <Badge variant="outline" className="text-xs">
                              {log.trigger_type}
                            </Badge>
                          </td>
                          <td data-label="Mensagem" className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                            {log.message_body}
                          </td>
                          <td data-label="Status" className="px-4 py-3 text-center">
                            <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
                              Enviado
                            </Badge>
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
      </Tabs>

      {/* MODAL: Enviar WhatsApp Direto */}
      <Dialog open={sendModalOpen} onOpenChange={setSendModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                <MessageCircle className="h-4 w-4" />
              </div>
              Enviar WhatsApp para {messageData.client_name}
            </DialogTitle>
            <DialogDescription>
              A mensagem foi montada com os dados personalizados. Você pode editar o texto antes de abrir o WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Número do WhatsApp</Label>
              <Input
                value={messageData.phone}
                onChange={(e) => setMessageData((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="Ex: (11) 99999-9999"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Mensagem a Enviar</Label>
              <Textarea
                rows={6}
                value={messageData.message}
                onChange={(e) => setMessageData((prev) => ({ ...prev, message: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSendModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => dispatchWhatsAppMutation.mutate()}
              disabled={!messageData.phone || !messageData.message.trim() || dispatchWhatsAppMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              <ExternalLink className="h-4 w-4" />
              {dispatchWhatsAppMutation.isPending ? "Abrindo..." : "Abrir WhatsApp & Gravar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
