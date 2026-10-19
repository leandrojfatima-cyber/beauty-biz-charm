import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  Scissors,
  Flame,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Plus,
  Receipt,
  X,
  Lock,
  Search,
  Star,
  RefreshCw,
  Play,
  Check,
  Ban,
  CalendarDays,
  CalendarRange,
  Columns,
  Sparkles,
  ShieldCheck,
  Coffee,
} from "lucide-react";
import { WhatsAppDialog, type WaAppointment } from "@/components/WhatsAppDialog";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { db, brl, fmtDate, fmtTime, todayISO } from "@/lib/db";
import { openOrder, useClients, useProfessionals, useServices } from "@/lib/lookups";
import { cn } from "@/lib/utils";
import {
  checkAppointmentConflict,
  calculateDayOccupancyStats,
  getDayKeyFromDate,
  getProfessionalWorkingHoursForDate,
  isSalonOpenOnDate,
  validateBookingLeadTime,
  DAY_NAMES_PT,
} from "@/lib/agenda-engine";
import type { AppointmentRecord, AppointmentStatus, AgendaViewMode } from "@/types/agenda";
import type { SalonSettingsData, ProfessionalData, ServiceData } from "@/types/salon";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda Inteligente — Belezi" },
      {
        name: "description",
        content:
          "Sistema completo de agendamentos operacionais para barbearias: visualizações diária, semanal e mensal, prevenção rigorosa de conflitos, regras de expediente e suporte a planos VIP.",
      },
      { property: "og:title", content: "Agenda Inteligente — Belezi" },
      {
        property: "og:description",
        content:
          "Agendamentos inteligentes com prevenção de conflitos, regras VIP e controle de horários de pico.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgendaInteligentePage,
});

function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  target.setDate(target.getDate() + days);
  return target.toISOString().slice(0, 10);
}

function getWeekDays(centerDate: string): string[] {
  const [y, m, d] = centerDate.split("-").map(Number);
  const current = new Date(y, m - 1, d);
  const dayOfWeek = current.getDay(); // 0 is Sunday
  // Vamos começar na Segunda-feira (1)
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(current);
  monday.setDate(current.getDate() + diffToMonday);

  const week: string[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    week.push(day.toISOString().slice(0, 10));
  }
  return week;
}

function getMonthDays(year: number, month: number): { dateStr: string; dayNumber: number; isCurrentMonth: boolean }[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startDayOfWeek = firstDay.getDay(); // 0 = Sun
  const totalDays = lastDay.getDate();

  const days: { dateStr: string; dayNumber: number; isCurrentMonth: boolean }[] = [];

  // Dias do mês anterior para preencher a primeira semana
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    const prevDate = new Date(year, month - 1, d);
    days.push({
      dateStr: prevDate.toISOString().slice(0, 10),
      dayNumber: d,
      isCurrentMonth: false,
    });
  }

  // Dias do mês atual
  for (let i = 1; i <= totalDays; i++) {
    const currDate = new Date(year, month, i);
    days.push({
      dateStr: currDate.toISOString().slice(0, 10),
      dayNumber: i,
      isCurrentMonth: true,
    });
  }

  // Preencher até múltiplo de 7 (semanas completas)
  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const nextDate = new Date(year, month + 1, i);
    days.push({
      dateStr: nextDate.toISOString().slice(0, 10),
      dayNumber: i,
      isCurrentMonth: false,
    });
  }

  return days;
}

function AgendaInteligentePage() {
  const [date, setDate] = useState(todayISO());
  const [viewMode, setViewMode] = useState<AgendaViewMode>("daily");
  const [selectedProId, setSelectedProId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const qc = useQueryClient();
  const navigate = useNavigate();

  // Lookups básicos
  const { data: pros = [] } = useProfessionals();
  const { data: clients = [] } = useClients();
  const { data: services = [] } = useServices();

  const activePros: ProfessionalData[] = useMemo(
    () => pros.filter((p: any) => p.active),
    [pros],
  );

  // Configurações do Salão (horários de funcionamento, regras de agendamento, limite de dias)
  const { data: salonSettings } = useQuery<SalonSettingsData | null>({
    queryKey: ["salon-settings-full"],
    queryFn: async () => {
      const { data, error } = await db.from("salon_settings").select("*").maybeSingle();
      if (error) {
        console.warn("Could not load salon settings:", error);
        return null;
      }
      return data;
    },
  });

  // Janela de datas a carregar de acordo com o modo de visualização
  const queryDateRange = useMemo(() => {
    if (viewMode === "daily") {
      return {
        start: new Date(date + "T00:00:00").toISOString(),
        end: new Date(date + "T23:59:59").toISOString(),
      };
    } else if (viewMode === "weekly") {
      const week = getWeekDays(date);
      return {
        start: new Date(week[0] + "T00:00:00").toISOString(),
        end: new Date(week[6] + "T23:59:59").toISOString(),
      };
    } else {
      // Mensal: carregar mês inteiro
      const [y, m] = date.split("-").map(Number);
      const firstOfMonth = new Date(y, m - 1, 1);
      const lastOfMonth = new Date(y, m, 0);
      return {
        start: new Date(firstOfMonth.toISOString().slice(0, 10) + "T00:00:00").toISOString(),
        end: new Date(lastOfMonth.toISOString().slice(0, 10) + "T23:59:59").toISOString(),
      };
    }
  }, [date, viewMode]);

  // Consulta de agendamentos isolados
  const { data: appts = [] } = useQuery<AppointmentRecord[]>({
    queryKey: ["appointments", queryDateRange.start, queryDateRange.end],
    queryFn: async () => {
      try {
        const query = db
          .from("appointments")
          .select("*")
          .gte("starts_at", queryDateRange.start)
          .lte("starts_at", queryDateRange.end)
          .order("starts_at");

        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          return data as AppointmentRecord[];
        }
        if (error) {
          console.warn("[Agenda] Consulta de agendamentos avisou:", error.message);
          const { data: fallbackData } = await db.from("appointments").select("*").limit(500);
          if (Array.isArray(fallbackData)) return fallbackData as AppointmentRecord[];
        }
        return [];
      } catch (err) {
        console.warn("[Agenda] Exceção ao consultar agendamentos:", err);
        return [];
      }
    },
  });

  // Modal de Agendamento / Edição / Bloqueio
  interface AppointmentFormData {
    id?: string;
    date: string;
    time: string;
    professional_id: string;
    client_id: string;
    service_id: string;
    notes: string;
    is_vip: boolean;
    vip_simultaneous_override: boolean;
    is_blocked: boolean;
    block_reason: string;
  }

  const [form, setForm] = useState<AppointmentFormData | null>(null);
  const [wa, setWa] = useState<WaAppointment | null>(null);

  // Auxiliares de busca de nomes
  const getClient = useCallback((id: string | null) => clients.find((c: any) => c.id === id), [clients]);
  const getPro = useCallback((id: string | null) => pros.find((p: any) => p.id === id), [pros]);
  const getService = useCallback((id: string | null) => services.find((s: any) => s.id === id), [services]);

  // Estatísticas de Ocupação do dia atual selecionado
  const occupancyStats = useMemo(() => {
    return calculateDayOccupancyStats({
      dateStr: date,
      appointments: appts,
      professionals: activePros,
      salonHours: salonSettings?.business_hours,
    });
  }, [date, appts, activePros, salonSettings]);

  // Checagem em tempo real de conflitos no formulário
  const formConflictCheck = useMemo(() => {
    if (!form || !form.professional_id || !form.date || !form.time) return null;

    const s = getService(form.service_id);
    const duration = form.is_blocked ? 60 : (s?.duration_min ?? 45);

    const starts = new Date(`${form.date}T${form.time}:00`);
    const ends = new Date(starts.getTime() + duration * 60000);

    return checkAppointmentConflict({
      professionalId: form.professional_id,
      startsAt: starts,
      endsAt: ends,
      excludeId: form.id || null,
      existingAppointments: appts,
      isCandidateVip: form.is_vip,
      allowVipSimultaneousOverride: form.vip_simultaneous_override,
    });
  }, [form, appts, getService]);

  // Salvar agendamento (Insert ou Update) com validação de conflito
  const saveAppointment = useMutation({
    mutationFn: async () => {
      if (!form) return;

      const starts = new Date(`${form.date}T${form.time}:00`);
      const s = getService(form.service_id);
      const duration = form.is_blocked ? 60 : (s?.duration_min ?? 45);
      const ends = new Date(starts.getTime() + duration * 60000);

      // Validação de conflito rigorosa
      const conflict = checkAppointmentConflict({
        professionalId: form.professional_id,
        startsAt: starts,
        endsAt: ends,
        excludeId: form.id || null,
        existingAppointments: appts,
        isCandidateVip: form.is_vip,
        allowVipSimultaneousOverride: form.vip_simultaneous_override,
      });

      if (conflict.hasConflict && !conflict.isSimultaneousVipAllowed) {
        throw new Error(`Conflito de agenda: ${conflict.conflictReason}`);
      }

      const payload: any = {
        professional_id: form.professional_id,
        client_id: form.is_blocked ? null : form.client_id || null,
        service_id: form.is_blocked ? null : form.service_id || null,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        notes: form.notes || null,
        is_vip: form.is_vip,
        vip_simultaneous_override: form.vip_simultaneous_override,
        is_blocked: form.is_blocked,
        block_reason: form.is_blocked ? form.block_reason || "Bloqueio Operacional" : null,
        status: form.is_blocked ? "bloqueado" : "agendado",
      };

      if (salonSettings?.id) {
        payload.salon_id = salonSettings.id;
      }

      if (form.id) {
        const { error } = await db.from("appointments").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("appointments").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      setForm(null);
      toast.success(form?.id ? "Agendamento atualizado com sucesso!" : "Agendamento confirmado!");
    },
    onError: (e: any) => {
      toast.error(e.message || "Erro ao salvar agendamento.");
    },
  });

  // Atualizar status rápido (iniciar atendimento, concluir, cancelar)
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AppointmentStatus }) => {
      const { error } = await db.from("appointments").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      const statusLabels: Record<AppointmentStatus, string> = {
        agendado: "Agendamento reaberto",
        em_andamento: "Atendimento iniciado",
        concluido: "Atendimento concluído com sucesso!",
        cancelado: "Agendamento cancelado",
        bloqueado: "Horário bloqueado",
      };
      toast.success(statusLabels[vars.status] || "Status atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Excluir agendamento
  const deleteAppointment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Agendamento excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Abrir comanda
  const toOrder = useMutation({
    mutationFn: (a: any) => openOrder({ appointment: a, services }),
    onSuccess: (id) => navigate({ to: "/comandas/$id", params: { id } }),
    onError: (e: any) => toast.error(e.message),
  });

  // Registrar falta (no-show) de cliente com aplicação de regras de penalidade
  const registerNoShow = useMutation({
    mutationFn: async ({ clientId, apptId }: { clientId: string; apptId: string }) => {
      const { data, error } = await db.rpc("register_client_no_show", {
        _client_id: clientId,
        _appointment_id: apptId,
        _reason: "Cliente não compareceu ao horário sem aviso prévio",
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      if (res?.is_blocked) {
        toast.error(
          `Falta registrada! O cliente ${res?.client_name} atingiu o limite e foi BLOQUEADO para agendamentos online.`,
        );
      } else {
        toast.warning(
          `Falta registrada para ${res?.client_name} (${res?.new_no_shows_count} falta(s) acumuladas).`,
        );
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Filtro de agendamentos visíveis
  const filteredAppts = useMemo(() => {
    return appts.filter((a) => {
      if (selectedProId !== "all" && a.professional_id !== selectedProId) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "vip" && !a.is_vip) return false;
        if (statusFilter !== "vip" && a.status !== statusFilter) return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const client = getClient(a.client_id)?.name?.toLowerCase() ?? "";
        const pro = getPro(a.professional_id)?.name?.toLowerCase() ?? "";
        const service = getService(a.service_id)?.name?.toLowerCase() ?? "";
        const reason = (a.block_reason ?? "").toLowerCase();
        if (
          !client.includes(query) &&
          !pro.includes(query) &&
          !service.includes(query) &&
          !reason.includes(query)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [appts, selectedProId, statusFilter, searchQuery, getClient, getPro, getService]);

  // Formatar rótulo de data atual
  const [currentYear, currentMonth] = date.split("-").map(Number);
  const dateObj = new Date(currentYear, currentMonth - 1, Number(date.split("-")[2]), 12, 0, 0);
  const dateFormattedLabel = dateObj.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Prepara novo agendamento com cliente / VIP automático
  const openNewAppointment = (overrideTime?: string, overrideProId?: string) => {
    const defaultProId = overrideProId || (activePros[0]?.id ?? "");
    setForm({
      date,
      time: overrideTime || "10:00",
      professional_id: defaultProId,
      client_id: "",
      service_id: services[0]?.id ?? "",
      notes: "",
      is_vip: false,
      vip_simultaneous_override: false,
      is_blocked: false,
      block_reason: "",
    });
  };

  const openBlockSlot = (overrideTime?: string, overrideProId?: string) => {
    const defaultProId = overrideProId || (activePros[0]?.id ?? "");
    setForm({
      date,
      time: overrideTime || "12:00",
      professional_id: defaultProId,
      client_id: "",
      service_id: "",
      notes: "Intervalo para almoço / manutenção",
      is_vip: false,
      vip_simultaneous_override: false,
      is_blocked: true,
      block_reason: "Almoço / Intervalo",
    });
  };

  const openEditAppointment = (a: AppointmentRecord) => {
    const starts = new Date(a.starts_at);
    const dateStr = a.starts_at.slice(0, 10);
    const timeStr = `${starts.getHours().toString().padStart(2, "0")}:${starts.getMinutes().toString().padStart(2, "0")}`;
    setForm({
      id: a.id,
      date: dateStr,
      time: timeStr,
      professional_id: a.professional_id,
      client_id: a.client_id || "",
      service_id: a.service_id || "",
      notes: a.notes || "",
      is_vip: !!a.is_vip,
      vip_simultaneous_override: !!a.vip_simultaneous_override,
      is_blocked: !!a.is_blocked,
      block_reason: a.block_reason || "",
    });
  };

  // Quando escolhe cliente no form, detecta se o cliente é VIP
  const handleClientSelect = (clientId: string) => {
    if (!form) return;
    const client = clients.find((c: any) => c.id === clientId);
    const isVipClient = !!(client?.is_vip || client?.vip_plan_name);
    setForm({
      ...form,
      client_id: clientId,
      is_vip: isVipClient ? true : form.is_vip,
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho Principal da Agenda */}
      <PageHeader
        title="Agenda Inteligente"
        subtitle={dateFormattedLabel}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Modo de Visualização */}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as AgendaViewMode)}>
              <TabsList className="bg-muted">
                <TabsTrigger value="daily" className="flex items-center gap-1.5 text-xs">
                  <Columns className="h-3.5 w-3.5" />
                  Diária
                </TabsTrigger>
                <TabsTrigger value="weekly" className="flex items-center gap-1.5 text-xs">
                  <CalendarRange className="h-3.5 w-3.5" />
                  Semanal
                </TabsTrigger>
                <TabsTrigger value="monthly" className="flex items-center gap-1.5 text-xs">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Mensal
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Navegador de Data */}
            <div className="flex items-center gap-1 bg-card border rounded-lg p-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Anterior"
                onClick={() =>
                  setDate(shiftDate(date, viewMode === "weekly" ? -7 : viewMode === "monthly" ? -30 : -1))
                }
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-8 w-36 border-0 text-xs px-2 shadow-none focus-visible:ring-0"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Próximo"
                onClick={() =>
                  setDate(shiftDate(date, viewMode === "weekly" ? 7 : viewMode === "monthly" ? 30 : 1))
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Button variant="outline" size="sm" onClick={() => setDate(todayISO())}>
              Hoje
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => openBlockSlot()}
              disabled={!activePros.length}
              className="border-dashed"
            >
              <Lock className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
              Bloquear Horário
            </Button>

            <Button
              size="sm"
              onClick={() => openNewAppointment()}
              disabled={!activePros.length}
              className="bg-primary text-primary-foreground shadow-sm"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Novo Agendamento
            </Button>
          </div>
        }
      />

      {/* Barra de Inteligência Operacional & Ocupação do Salão */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Taxa de Ocupação */}
        <Card className="border bg-card/70 backdrop-blur-sm">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Taxa de Ocupação ({DAY_NAMES_PT[getDayKeyFromDate(date)]})
              </span>
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold">{occupancyStats.occupancyPercentage}%</span>
              {occupancyStats.isPeakDay && (
                <Badge variant="destructive" className="text-[10px] uppercase font-bold flex items-center gap-1">
                  <Flame className="h-3 w-3" /> Dia de Pico
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <Progress value={occupancyStats.occupancyPercentage} className="h-2" />
            <p className="text-[11px] text-muted-foreground mt-2">
              {occupancyStats.totalAppointments} atendimentos marcados hoje ({occupancyStats.completedAppointments} concluídos)
            </p>
          </CardContent>
        </Card>

        {/* Horários de Pico Detectados */}
        <Card className="border bg-card/70 backdrop-blur-sm">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Horários de Alta Demanda
              </span>
              <Flame className="h-4 w-4 text-amber-500" />
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {occupancyStats.peakHourSlots.length > 0 ? (
                occupancyStats.peakHourSlots.map((h) => (
                  <Badge
                    key={h}
                    variant="outline"
                    className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium text-xs"
                  >
                    🔥 {h}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">Demanda equilibrada</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-[11px] text-muted-foreground">
              Slots de alta procura identificados pelo Belezi Engine para otimizar encaixes.
            </p>
          </CardContent>
        </Card>

        {/* Agendamentos VIP & Fidelidade */}
        <Card className="border bg-card/70 backdrop-blur-sm">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Clientes VIP & Planos
              </span>
              <Sparkles className="h-4 w-4 text-purple-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold">{occupancyStats.vipAppointments}</span>
              <span className="text-xs text-muted-foreground">agendamentos VIP</span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-[11px] text-muted-foreground">
              Clientes com planos ativos recebem prioridade de encaixe e agendamento simultâneo.
            </p>
          </CardContent>
        </Card>

        {/* Política & Janela Pública */}
        <Card className="border bg-card/70 backdrop-blur-sm">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Janela de Agendamento
              </span>
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold">{salonSettings?.max_advance_days ?? 30} dias</span>
              <Badge variant="outline" className="text-[10px]">
                Mín: {salonSettings?.min_advance_minutes ?? 30} min
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-[11px] text-muted-foreground">
              Prevenção ativa contra reservas duplas e conflitos de bancada.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Busca Rápida */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/40 p-3 rounded-lg border">
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro por Profissional */}
          <div className="w-48">
            <Select value={selectedProId} onValueChange={setSelectedProId}>
              <SelectTrigger className="h-9 text-xs bg-background">
                <SelectValue placeholder="Todos os barbeiros" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Barbeiros ({activePros.length})</SelectItem>
                {activePros.map((p) => (
                  <SelectItem key={p.id} value={p.id || ""}>
                    {p.name} ({p.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por Status */}
          <div className="w-40">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 text-xs bg-background">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="agendado">📅 Agendados</SelectItem>
                <SelectItem value="em_andamento">⏳ Em Atendimento</SelectItem>
                <SelectItem value="concluido">✅ Concluídos</SelectItem>
                <SelectItem value="vip">👑 Apenas VIP</SelectItem>
                <SelectItem value="bloqueado">🔒 Bloqueios</SelectItem>
                <SelectItem value="cancelado">❌ Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Campo de Busca Rápida */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar cliente, serviço..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9 text-xs bg-background"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Estado Vazio de Profissionais */}
      {!activePros.length && (
        <Card className="border-dashed p-8 text-center">
          <div className="max-w-md mx-auto space-y-3">
            <Users className="h-10 w-10 text-muted-foreground mx-auto" />
            <h3 className="text-base font-semibold">Nenhum barbeiro ativo cadastrado</h3>
            <p className="text-sm text-muted-foreground">
              Cadastre sua equipe na aba de Configurações da Barbearia para liberar a agenda inteligente.
            </p>
            <Button onClick={() => navigate({ to: "/profissionais" })}>Cadastrar Barbeiros</Button>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* MODO 1: VISUALIZAÇÃO DIÁRIA (DAILY) POR COLUNAS DE PROFISSIONAL */}
      {/* ========================================================================= */}
      {viewMode === "daily" && activePros.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {activePros
            .filter((p) => selectedProId === "all" || p.id === selectedProId)
            .map((pro) => {
              const workingDetails = getProfessionalWorkingHoursForDate(
                date,
                pro,
                salonSettings?.business_hours,
              );
              const proAppts = filteredAppts.filter((a) => a.professional_id === pro.id);
              const activeCount = proAppts.filter((a) => a.status !== "cancelado").length;

              return (
                <Card
                  key={pro.id}
                  className={cn(
                    "flex flex-col border transition-all duration-200",
                    !workingDetails.isWorking && "opacity-75 bg-muted/30 border-dashed",
                  )}
                >
                  {/* Cabeçalho do Barbeiro */}
                  <CardHeader className="p-3.5 border-b bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="h-9 w-9 border">
                          <AvatarImage src={pro.photo_url || ""} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {pro.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-sm truncate">{pro.name}</h4>
                          <p className="text-[11px] text-muted-foreground truncate">{pro.role}</p>
                        </div>
                      </div>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-primary hover:bg-primary/10"
                        title="Agendar neste barbeiro"
                        onClick={() => openNewAppointment("10:00", pro.id)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Badge de Horário de Expediente / Folga */}
                    <div className="flex items-center justify-between pt-2 text-[11px]">
                      {workingDetails.isWorking ? (
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3 text-emerald-500" />
                          {workingDetails.start} – {workingDetails.end}
                        </span>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">
                          <Coffee className="h-3 w-3 mr-1" /> {workingDetails.reason || "Folga"}
                        </Badge>
                      )}
                      <span className="font-medium text-muted-foreground">
                        {activeCount} {activeCount === 1 ? "horário" : "horários"}
                      </span>
                    </div>
                  </CardHeader>

                  {/* Lista de Slots & Agendamentos do Barbeiro */}
                  <CardContent className="p-3 space-y-2.5 flex-1 overflow-y-auto max-h-[600px]">
                    {proAppts.length === 0 ? (
                      <div className="py-8 text-center space-y-2">
                        <p className="text-xs text-muted-foreground">Nenhum atendimento marcado</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => openNewAppointment("10:00", pro.id)}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Agendar Horário
                        </Button>
                      </div>
                    ) : (
                      proAppts.map((appt) => {
                        const client = getClient(appt.client_id);
                        const service = getService(appt.service_id);

                        return (
                          <div
                            key={appt.id}
                            className={cn(
                              "relative rounded-lg border p-3 text-xs shadow-xs transition-all",
                              appt.status === "agendado" && "bg-card border-l-4 border-l-blue-500 hover:border-blue-400",
                              appt.status === "em_andamento" &&
                                "bg-amber-500/5 border-l-4 border-l-amber-500 border-amber-500/30",
                              appt.status === "concluido" &&
                                "bg-emerald-500/5 border-l-4 border-l-emerald-500 border-emerald-500/30 opacity-80",
                              appt.status === "cancelado" &&
                                "bg-muted/40 border-l-4 border-l-destructive border-dashed opacity-50 line-through",
                              appt.is_blocked && "bg-muted/60 border-l-4 border-l-slate-500 border-dashed",
                              appt.is_vip && "border-r-4 border-r-purple-500/60 shadow-purple-500/5",
                            )}
                          >
                            {/* Linha 1: Horário, Duração e Badges */}
                            <div className="flex items-center justify-between gap-1 mb-1.5">
                              <span className="font-bold text-sm tracking-tight flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                {fmtTime(appt.starts_at)} – {fmtTime(appt.ends_at)}
                              </span>

                              <div className="flex items-center gap-1">
                                {appt.is_vip && (
                                  <Badge className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] px-1.5 py-0 h-4 font-bold flex items-center gap-0.5">
                                    <Sparkles className="h-2.5 w-2.5" /> VIP
                                  </Badge>
                                )}
                                {appt.status === "em_andamento" && (
                                  <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0 h-4 animate-pulse">
                                    Em Atendimento
                                  </Badge>
                                )}
                                {appt.status === "concluido" && (
                                  <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0 h-4">
                                    Concluído
                                  </Badge>
                                )}
                                {appt.is_blocked && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                    Bloqueado
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* Linha 2: Cliente & Serviço */}
                            {appt.is_blocked ? (
                              <div className="space-y-1 my-1">
                                <p className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                  <Lock className="h-3 w-3" /> {appt.block_reason || "Horário Indisponível"}
                                </p>
                                {appt.notes && (
                                  <p className="text-[11px] text-muted-foreground">{appt.notes}</p>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-0.5 my-1">
                                <p className="font-semibold text-foreground text-sm flex items-center justify-between">
                                  <span>{client?.name ?? "Cliente sem cadastro"}</span>
                                  {service?.price && (
                                    <span className="text-muted-foreground font-normal text-xs">
                                      {brl(service.price)}
                                    </span>
                                  )}
                                </p>
                                <p className="text-muted-foreground text-[11px] flex items-center gap-1">
                                  <Scissors className="h-3 w-3" />
                                  {service?.name ?? "Serviço personalizado"} · {service?.duration_min ?? 45} min
                                </p>
                                {appt.notes && (
                                  <p className="text-[11px] text-muted-foreground/90 italic bg-muted/40 p-1 rounded mt-1">
                                    "{appt.notes}"
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Linha 3: Barra de Ações Rápidas */}
                            {appt.status !== "cancelado" && (
                              <div className="flex items-center justify-between pt-2 mt-2 border-t border-border/60">
                                {/* Mudar status de atendimento */}
                                <div className="flex items-center gap-1">
                                  {appt.status === "agendado" && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-1.5 text-[11px] text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                      title="Iniciar atendimento"
                                      onClick={() => updateStatus.mutate({ id: appt.id, status: "em_andamento" })}
                                    >
                                      <Play className="h-3 w-3 mr-1" /> Iniciar
                                    </Button>
                                  )}

                                  {appt.status === "em_andamento" && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-1.5 text-[11px] text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                      title="Concluir atendimento"
                                      onClick={() => updateStatus.mutate({ id: appt.id, status: "concluido" })}
                                    >
                                      <Check className="h-3 w-3 mr-1" /> Concluir
                                    </Button>
                                  )}

                                  {!appt.is_blocked && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-1.5 text-[11px] text-primary"
                                      title="Abrir comanda no caixa"
                                      onClick={() => toOrder.mutate(appt)}
                                    >
                                      <Receipt className="h-3 w-3 mr-1" /> Comanda
                                    </Button>
                                  )}
                                </div>

                                {/* Ações secundárias: WhatsApp, Editar, Cancelar */}
                                <div className="flex items-center gap-0.5">
                                  {!appt.is_blocked && client?.phone && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                      title="WhatsApp do Cliente"
                                      onClick={() =>
                                        setWa({
                                          startsAt: appt.starts_at,
                                          client: client.name,
                                          phone: client.phone,
                                          service: service?.name,
                                          professional: pro.name,
                                        })
                                      }
                                    >
                                      <MessageCircle className="h-3.5 w-3.5" />
                                    </Button>
                                  )}

                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                    title="Editar horário"
                                    onClick={() => openEditAppointment(appt)}
                                  >
                                    <RefreshCw className="h-3 w-3" />
                                  </Button>

                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                    title="Cancelar agendamento"
                                    onClick={() => {
                                      if (confirm("Deseja realmente cancelar este agendamento?")) {
                                        updateStatus.mutate({ id: appt.id, status: "cancelado" });
                                      }
                                    }}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODO 2: VISUALIZAÇÃO SEMANAL (WEEKLY) */}
      {/* ========================================================================= */}
      {viewMode === "weekly" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {getWeekDays(date).map((dayStr) => {
              const dayKey = getDayKeyFromDate(dayStr);
              const [y, m, d] = dayStr.split("-").map(Number);
              const dayObj = new Date(y, m - 1, d, 12, 0, 0);
              const isToday = dayStr === todayISO();
              const isSelected = dayStr === date;

              const dayStats = calculateDayOccupancyStats({
                dateStr: dayStr,
                appointments: appts,
                professionals: activePros,
                salonHours: salonSettings?.business_hours,
              });

              const dayAppts = appts.filter((a) => {
                const aDate = a.starts_at.slice(0, 10);
                if (aDate !== dayStr) return false;
                if (selectedProId !== "all" && a.professional_id !== selectedProId) return false;
                if (statusFilter !== "all") {
                  if (statusFilter === "vip" && !a.is_vip) return false;
                  if (statusFilter !== "vip" && a.status !== statusFilter) return false;
                }
                return true;
              });

              return (
                <div
                  key={dayStr}
                  onClick={() => setDate(dayStr)}
                  className={cn(
                    "rounded-lg border p-3 cursor-pointer transition-all flex flex-col justify-between min-h-[220px]",
                    isSelected ? "border-primary bg-primary/5 shadow-xs" : "bg-card hover:border-muted-foreground/40",
                    isToday && "ring-1 ring-primary/40",
                  )}
                >
                  {/* Cabeçalho do Dia */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs capitalize">{DAY_NAMES_PT[dayKey].slice(0, 3)}</span>
                      {isToday && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-primary text-primary">
                          Hoje
                        </Badge>
                      )}
                    </div>
                    <p className="text-xl font-bold">{dayObj.getDate()}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">
                      {dayObj.toLocaleDateString("pt-BR", { month: "short" })}
                    </p>

                    {/* Barra de Ocupação do dia */}
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{dayStats.occupancyPercentage}% ocupado</span>
                        <span>{dayAppts.length} slots</span>
                      </div>
                      <Progress value={dayStats.occupancyPercentage} className="h-1.5" />
                    </div>
                  </div>

                  {/* Prévia de Atendimentos */}
                  <div className="mt-3 space-y-1.5 flex-1">
                    {dayAppts.slice(0, 3).map((a) => (
                      <div
                        key={a.id}
                        className={cn(
                          "rounded p-1.5 text-[10px] border truncate",
                          a.status === "agendado" && "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300",
                          a.status === "concluido" && "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300",
                          a.is_blocked && "bg-slate-500/10 border-slate-500/20 text-slate-700 dark:text-slate-300",
                          a.is_vip && "border-purple-500/40 font-semibold",
                        )}
                      >
                        {fmtTime(a.starts_at)} {a.is_blocked ? "🔒 " + (a.block_reason || "Bloqueio") : getClient(a.client_id)?.name ?? "Cliente"}
                      </div>
                    ))}

                    {dayAppts.length > 3 && (
                      <p className="text-[10px] text-muted-foreground text-center font-medium">
                        +{dayAppts.length - 3} outros horários
                      </p>
                    )}
                  </div>

                  {/* Ação rápida para agendar neste dia */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs h-7 mt-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDate(dayStr);
                      openNewAppointment();
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Agendar
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODO 3: VISUALIZAÇÃO MENSAL (MONTHLY) */}
      {/* ========================================================================= */}
      {viewMode === "monthly" && (
        <Card className="border">
          <CardHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold capitalize">
                {dateObj.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setDate(shiftDate(date, -30))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setDate(shiftDate(date, 30))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {/* Cabeçalho dos Dias da Semana */}
            <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-semibold text-muted-foreground">
              <span>Dom</span>
              <span>Seg</span>
              <span>Ter</span>
              <span>Qua</span>
              <span>Qui</span>
              <span>Sex</span>
              <span>Sáb</span>
            </div>

            {/* Grid dos Dias do Mês */}
            <div className="grid grid-cols-7 gap-2">
              {getMonthDays(currentYear, currentMonth - 1).map((cell) => {
                const dayAppts = appts.filter(
                  (a) => a.starts_at.slice(0, 10) === cell.dateStr && a.status !== "cancelado",
                );
                const isSelected = cell.dateStr === date;
                const isToday = cell.dateStr === todayISO();

                return (
                  <div
                    key={cell.dateStr}
                    onClick={() => {
                      setDate(cell.dateStr);
                      setViewMode("daily");
                    }}
                    className={cn(
                      "min-h-[85px] p-2 rounded-lg border text-left cursor-pointer transition-all flex flex-col justify-between",
                      !cell.isCurrentMonth && "opacity-40 bg-muted/20",
                      cell.isCurrentMonth && "bg-card hover:border-primary/50",
                      isSelected && "border-primary ring-2 ring-primary/20",
                      isToday && "border-primary/60 font-bold",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn("text-xs font-semibold", isToday && "text-primary")}>
                        {cell.dayNumber}
                      </span>
                      {dayAppts.length > 0 && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px] px-1 py-0 h-4",
                            dayAppts.length >= 8 && "bg-destructive/10 text-destructive font-bold",
                          )}
                        >
                          {dayAppts.length}
                        </Badge>
                      )}
                    </div>

                    {dayAppts.length > 0 ? (
                      <div className="space-y-0.5 mt-1">
                        <div className="flex items-center gap-1">
                          {dayAppts.some((a) => a.is_vip) && (
                            <span className="h-1.5 w-1.5 rounded-full bg-purple-500" title="Possui agendamento VIP" />
                          )}
                          {dayAppts.some((a) => a.status === "concluido") && (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Atendimentos concluídos" />
                          )}
                          {dayAppts.some((a) => a.status === "agendado") && (
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" title="Atendimentos agendados" />
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {dayAppts.length} {dayAppts.length === 1 ? "cliente" : "clientes"}
                        </p>
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/60">Livre</span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* DIÁLOGO INTELIGENTE DE NOVO AGENDAMENTO / EDIÇÃO COM PREVENÇÃO DE CONFLITO */}
      {/* ========================================================================= */}
      <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle>
                {form?.id
                  ? "Editar Agendamento"
                  : form?.is_blocked
                  ? "Bloquear Horário na Agenda"
                  : "Novo Agendamento Inteligente"}
              </DialogTitle>
              {form?.is_vip && (
                <Badge className="bg-purple-600 text-white text-[11px] font-bold flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Cliente VIP
                </Badge>
              )}
            </div>
            <DialogDescription>
              {form?.is_blocked
                ? "Interdite uma faixa de horário para almoço, folga ou manutenção."
                : "Selecione barbeiro, serviço e horário com prevenção automática de conflitos."}
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="space-y-4 py-2">
              {/* Alerta de Conflito em Tempo Real */}
              {formConflictCheck?.hasConflict && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Conflito de Horário Detectado!</span>
                  </div>
                  <p className="text-xs text-destructive/90">{formConflictCheck.conflictReason}</p>
                </div>
              )}

              {/* Alerta de Encaixe VIP Autorizado */}
              {formConflictCheck?.isSimultaneousVipAllowed && (
                <div className="rounded-lg border border-purple-500/40 bg-purple-500/10 p-3 text-purple-700 dark:text-purple-300 space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-xs">
                    <Sparkles className="h-4 w-4 shrink-0" />
                    <span>Encaixe VIP Simultâneo Autorizado!</span>
                  </div>
                  <p className="text-xs">
                    Agendamento sobreposto permitido pelas diretrizes do Plano Clube VIP.
                  </p>
                </div>
              )}

              {/* Alternador: Agendamento de Cliente vs Bloqueio de Horário */}
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">Tipo de Registro</Label>
                  <p className="text-[11px] text-muted-foreground">
                    {form.is_blocked ? "Bloqueio operacional / intervalo" : "Atendimento para cliente da barbearia"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={!form.is_blocked ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => setForm({ ...form, is_blocked: false })}
                  >
                    Atendimento
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={form.is_blocked ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => setForm({ ...form, is_blocked: true })}
                  >
                    <Lock className="h-3 w-3 mr-1" /> Bloqueio
                  </Button>
                </div>
              </div>

              {/* Data e Horário */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Data</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Horário de Início</Label>
                  <Input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Barbeiro / Profissional */}
              <div>
                <Label className="text-xs font-medium">Profissional / Barbeiro</Label>
                <Select
                  value={form.professional_id}
                  onValueChange={(val) => setForm({ ...form, professional_id: val })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o profissional" />
                  </SelectTrigger>
                  <SelectContent>
                    {activePros.map((p) => {
                      const working = getProfessionalWorkingHoursForDate(form.date, p, salonSettings?.business_hours);
                      return (
                        <SelectItem key={p.id} value={p.id || ""}>
                          {p.name} ({p.role}) {working.isWorking ? `· ${working.start} às ${working.end}` : "· [FOLGA]"}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Campos específicos quando NÃO é bloqueio */}
              {!form.is_blocked && (
                <>
                  {/* Cliente */}
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Cliente</Label>
                      <button
                        type="button"
                        onClick={() => navigate({ to: "/clientes" })}
                        className="text-[11px] text-primary hover:underline"
                      >
                        + Novo cliente
                      </button>
                    </div>
                    <Select value={form.client_id} onValueChange={handleClientSelect}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} {c.phone ? `(${c.phone})` : ""}{" "}
                            {c.vip_plan_name ? `· 👑 ${c.vip_plan_name}` : c.is_vip ? "⭐ VIP" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {getClient(form.client_id)?.vip_plan_name && (
                      <div className="mt-1.5 p-2 rounded bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 text-[11px] flex items-center gap-1.5 font-medium">
                        <Sparkles className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                        <span>Assinatura Ativa: {getClient(form.client_id)?.vip_plan_name} (Coberto pela franquia do plano)</span>
                      </div>
                    )}
                  </div>

                  {/* Serviço & Duração Automática */}
                  <div>
                    <Label className="text-xs font-medium">Serviço Principal</Label>
                    <Select
                      value={form.service_id}
                      onValueChange={(val) => setForm({ ...form, service_id: val })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione o serviço" />
                      </SelectTrigger>
                      <SelectContent>
                        {services
                          .filter((s: any) => s.active)
                          .map((s: any) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name} — {brl(s.price)} ({s.duration_min} min)
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Configurações VIP & Encaixe Simultâneo */}
                  <div className="p-3 rounded-lg border bg-purple-500/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="h-4 w-4 text-purple-600" />
                          <Label className="text-xs font-semibold">Atendimento VIP</Label>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Marca este agendamento como prioritário / Clube VIP.
                        </p>
                      </div>
                      <Switch
                        checked={form.is_vip}
                        onCheckedChange={(checked) => setForm({ ...form, is_vip: checked })}
                      />
                    </div>

                    {form.is_vip && (
                      <div className="flex items-center justify-between pt-2 border-t border-purple-500/20">
                        <div className="space-y-0.5">
                          <Label className="text-xs font-medium text-purple-800 dark:text-purple-300">
                            Autorizar Encaixe Simultâneo VIP
                          </Label>
                          <p className="text-[11px] text-muted-foreground">
                            Permite sobreposição de horário para o mesmo barbeiro através de regras VIP.
                          </p>
                        </div>
                        <Switch
                          checked={form.vip_simultaneous_override}
                          onCheckedChange={(checked) =>
                            setForm({ ...form, vip_simultaneous_override: checked })
                          }
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Campos específicos quando É BLOQUEIO */}
              {form.is_blocked && (
                <div>
                  <Label className="text-xs font-medium">Motivo do Bloqueio</Label>
                  <Select
                    value={form.block_reason}
                    onValueChange={(val) => setForm({ ...form, block_reason: val })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione o motivo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Almoço / Intervalo">☕ Almoço / Intervalo</SelectItem>
                      <SelectItem value="Folga / Ausência">🏖️ Folga / Ausência</SelectItem>
                      <SelectItem value="Reunião de Equipe">👥 Reunião de Equipe</SelectItem>
                      <SelectItem value="Manutenção de Bancada">🔧 Manutenção de Equipamento</SelectItem>
                      <SelectItem value="Treinamento / Workshop">🎓 Treinamento Técnico</SelectItem>
                      <SelectItem value="Outro">Outro Motivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Observações Gerais */}
              <div>
                <Label className="text-xs font-medium">Observações Internas</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Preferências do cliente, detalhes do corte, toalha quente..."
                  rows={2}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between gap-2">
            <div>
              {form?.id && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm("Excluir este agendamento definitivamente?")) {
                      deleteAppointment.mutate(form.id!);
                      setForm(null);
                    }
                  }}
                >
                  Excluir
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setForm(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => saveAppointment.mutate()}
                disabled={
                  !form?.professional_id ||
                  (!form?.is_blocked && !form?.service_id) ||
                  saveAppointment.isPending ||
                  (formConflictCheck?.hasConflict && !formConflictCheck.isSimultaneousVipAllowed)
                }
                className="bg-primary text-primary-foreground"
              >
                {saveAppointment.isPending
                  ? "Salvando..."
                  : form?.id
                  ? "Atualizar Agendamento"
                  : "Confirmar Agendamento"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Disparo WhatsApp */}
      <WhatsAppDialog appt={wa} onClose={() => setWa(null)} />
    </div>
  );
}
