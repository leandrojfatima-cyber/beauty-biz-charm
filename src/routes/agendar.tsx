import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  Scissors,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  X,
  Search,
  Sparkles,
  MapPin,
  Phone,
  Instagram,
  Check,
  ShoppingBag,
  ExternalLink,
  Crown,
  History,
  Info,
  CalendarCheck,
  ArrowRight,
  Store,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PWAInstallButton } from "@/components/PWAInstallButton";
import { db, brl, fmtDate, fmtTime, todayISO } from "@/lib/db";
import {
  getDayKeyFromDate,
  isSalonOpenOnDate,
  getProfessionalWorkingHoursForDate,
  checkAppointmentConflict,
  validateBookingLeadTime,
  DAY_NAMES_PT,
} from "@/lib/agenda-engine";
import type { SalonSettingsData, ProfessionalData, ServiceData, SalonPhoto } from "@/types/salon";
import type { AppointmentRecord } from "@/types/agenda";
import type { SalonClientPlan } from "@/types/subscription";
import { MODEL_LABELS } from "@/lib/subscription-engine";

export const Route = createFileRoute("/agendar")({
  head: () => ({
    meta: [
      { title: "Agendamento Online — Belezi Barbearia" },
      {
        name: "description",
        content:
          "Agende seu horário na barbearia de forma rápida, escolha seu barbeiro favorito e consulte serviços e produtos online.",
      },
      { property: "og:title", content: "Agendamento Online — Belezi Barbearia" },
      {
        property: "og:description",
        content:
          "Escolha barbeiro, serviços e horário em tempo real. Instale o app no seu celular.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClientBookingPortal,
});

type TabView = "inicio" | "servicos" | "agendar" | "portal" | "vip";

function ClientBookingPortal() {
  const [activeTab, setActiveTab] = useState<TabView>("inicio");
  const qc = useQueryClient();

  // 1. Carregar Configurações e Identidade da Barbearia
  const { data: salon } = useQuery<SalonSettingsData>({
    queryKey: ["public-salon-settings"],
    queryFn: async () => {
      const { data, error } = await db.from("salon_settings").select("*").limit(1).maybeSingle();
      if (error) console.warn("Error loading salon info:", error);
      return data ?? null;
    },
  });

  // 2. Carregar Fotos do Espaço
  const { data: photos = [] } = useQuery<SalonPhoto[]>({
    queryKey: ["public-salon-photos"],
    queryFn: async () => {
      const { data, error } = await db
        .from("salon_photos")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) console.warn("Error loading photos:", error);
      return data ?? [];
    },
  });

  // 3. Carregar Barbeiros Ativos
  const { data: professionals = [] } = useQuery<ProfessionalData[]>({
    queryKey: ["public-professionals"],
    queryFn: async () => {
      const { data, error } = await db
        .from("professionals")
        .select("*")
        .eq("active", true)
        .order("name");
      if (error) console.warn("Error loading pros:", error);
      return data ?? [];
    },
  });

  // 4. Carregar Serviços Ativos
  const { data: services = [] } = useQuery<ServiceData[]>({
    queryKey: ["public-services"],
    queryFn: async () => {
      const { data, error } = await db
        .from("services")
        .select("*")
        .eq("active", true)
        .order("highlight", { ascending: false })
        .order("price");
      if (error) console.warn("Error loading services:", error);
      return data ?? [];
    },
  });

  // 5. Carregar Produtos para venda/exibição
  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["public-products"],
    queryFn: async () => {
      const { data, error } = await db
        .from("products")
        .select("*")
        .eq("active", true)
        .eq("for_sale", true)
        .order("name");
      if (error) console.warn("Error loading products:", error);
      return data ?? [];
    },
  });

  // 6. Carregar Planos do Clube da Barbearia
  const { data: clientPlans = [] } = useQuery<SalonClientPlan[]>({
    queryKey: ["public-client-plans"],
    queryFn: async () => {
      const { data, error } = await db
        .from("salon_client_plans")
        .select("*")
        .eq("active", true)
        .order("price", { ascending: true });
      if (error) console.warn("Error loading plans:", error);
      return (data ?? []) as SalonClientPlan[];
    },
  });

  // =========================================================================
  // FLUXO DE AGENDAMENTO
  // =========================================================================
  const [selectedServices, setSelectedServices] = useState<ServiceData[]>([]);
  const [selectedProId, setSelectedProId] = useState<string>("any");
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientNotes, setClientNotes] = useState("");
  const [bookingConfirmed, setBookingConfirmed] = useState<any | null>(null);

  // Carregar agendamentos do dia para cálculo de slots livres em tempo real
  const { data: dayAppointments = [] } = useQuery<AppointmentRecord[]>({
    queryKey: ["public-day-appointments", selectedDate],
    queryFn: async () => {
      const start = `${selectedDate}T00:00:00.000Z`;
      const end = `${selectedDate}T23:59:59.999Z`;
      const { data, error } = await db
        .from("appointments")
        .select("id, professional_id, starts_at, ends_at, status, is_blocked, is_vip")
        .gte("starts_at", start)
        .lte("starts_at", end);
      if (error) console.warn("Error loading occupied slots:", error);
      return (data ?? []) as AppointmentRecord[];
    },
  });

  // Totais do Agendamento
  const totalDurationMin = useMemo(
    () => selectedServices.reduce((acc, s) => acc + (s.duration_min || 45), 0) || 45,
    [selectedServices],
  );

  const totalPrice = useMemo(
    () => selectedServices.reduce((acc, s) => acc + Number(s.price || 0), 0),
    [selectedServices],
  );

  // Status de funcionamento do dia
  const salonDayStatus = useMemo(
    () => isSalonOpenOnDate(selectedDate, salon?.business_hours),
    [selectedDate, salon],
  );

  // Geração inteligente de horários disponíveis no dia
  const availableSlots = useMemo(() => {
    if (!salonDayStatus.isOpen) return [];

    const slots: { time: string; isAvailable: boolean; reason?: string }[] = [];
    const [openH, openM] = salonDayStatus.openTime.split(":").map(Number);
    const [closeH, closeM] = salonDayStatus.closeTime.split(":").map(Number);

    const startMinutes = openH * 60 + openM;
    const endMinutes = closeH * 60 + closeM;

    // Verificar para cada intervalo de 30 minutos
    for (let m = startMinutes; m + totalDurationMin <= endMinutes; m += 30) {
      const hStr = Math.floor(m / 60).toString().padStart(2, "0");
      const mStr = (m % 60).toString().padStart(2, "0");
      const timeStr = `${hStr}:${mStr}`;

      const slotStart = new Date(`${selectedDate}T${timeStr}:00`);
      const slotEnd = new Date(slotStart.getTime() + totalDurationMin * 60000);

      // Validação de antecedência mínima
      const leadCheck = validateBookingLeadTime({
        dateStr: selectedDate,
        timeStr,
        settings: salon,
      });

      if (!leadCheck.isValid) {
        slots.push({ time: timeStr, isAvailable: false, reason: leadCheck.message });
        continue;
      }

      // Se o cliente escolheu um barbeiro específico
      if (selectedProId !== "any") {
        const pro = professionals.find((p) => p.id === selectedProId);
        const proHours = getProfessionalWorkingHoursForDate(
          selectedDate,
          pro,
          salon?.business_hours,
        );

        if (!proHours.isWorking) {
          slots.push({ time: timeStr, isAvailable: false, reason: "Folga do profissional" });
          continue;
        }

        const conflict = checkAppointmentConflict({
          professionalId: selectedProId,
          startsAt: slotStart,
          endsAt: slotEnd,
          existingAppointments: dayAppointments,
        });

        slots.push({
          time: timeStr,
          isAvailable: !conflict.hasConflict,
          reason: conflict.hasConflict ? "Horário indisponível" : undefined,
        });
      } else {
        // Se escolheu "qualquer barbeiro", basta ter pelo menos um barbeiro livre
        const hasAnyProFree = professionals.some((pro) => {
          const proHours = getProfessionalWorkingHoursForDate(
            selectedDate,
            pro,
            salon?.business_hours,
          );
          if (!proHours.isWorking) return false;

          const conflict = checkAppointmentConflict({
            professionalId: pro.id!,
            startsAt: slotStart,
            endsAt: slotEnd,
            existingAppointments: dayAppointments,
          });
          return !conflict.hasConflict;
        });

        slots.push({
          time: timeStr,
          isAvailable: hasAnyProFree,
          reason: !hasAnyProFree ? "Lotado" : undefined,
        });
      }
    }

    return slots;
  }, [selectedDate, salonDayStatus, totalDurationMin, selectedProId, professionals, dayAppointments, salon]);

  // Mutation para confirmar o agendamento
  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTime) throw new Error("Selecione um horário.");
      if (!clientName.trim()) throw new Error("Informe o seu nome.");
      if (!clientPhone.trim()) throw new Error("Informe seu WhatsApp.");
      if (selectedServices.length === 0) throw new Error("Selecione pelo menos um serviço.");

      // Determinar o barbeiro (se for 'any', escolhe o primeiro barbeiro livre no horário)
      let finalProId = selectedProId;
      const slotStart = new Date(`${selectedDate}T${selectedTime}:00`);
      const slotEnd = new Date(slotStart.getTime() + totalDurationMin * 60000);

      if (finalProId === "any") {
        const freePro = professionals.find((pro) => {
          const proHours = getProfessionalWorkingHoursForDate(selectedDate, pro, salon?.business_hours);
          if (!proHours.isWorking) return false;
          const conflict = checkAppointmentConflict({
            professionalId: pro.id!,
            startsAt: slotStart,
            endsAt: slotEnd,
            existingAppointments: dayAppointments,
          });
          return !conflict.hasConflict;
        });

        if (!freePro) {
          throw new Error("Nenhum barbeiro disponível neste horário. Por favor, escolha outro.");
        }
        finalProId = freePro.id!;
      }

      // Tenta chamar a RPC segura do Supabase book_client_appointment
      const cleanPhone = clientPhone.replace(/\D/g, "");
      const primaryService = selectedServices[0];
      const allServiceNames = selectedServices.map((s) => s.name).join(" + ");
      const combinedNotes = [
        selectedServices.length > 1 ? `Serviços: ${allServiceNames} (Total: ${brl(totalPrice)})` : null,
        clientNotes.trim() ? `Obs do cliente: ${clientNotes}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      const { data: rpcRes, error: rpcErr } = await db.rpc("book_client_appointment", {
        p_salon_id: salon?.id || null,
        p_professional_id: finalProId,
        p_service_id: primaryService.id,
        p_starts_at: slotStart.toISOString(),
        p_client_name: clientName.trim(),
        p_client_phone: cleanPhone,
        p_client_notes: combinedNotes,
      });

      if (rpcErr) {
        // Fallback: se RPC não estiver instalada, insere diretamente na tabela appointments
        console.warn("RPC fallback, inserting directly:", rpcErr);

        // Localizar ou criar cliente
        let clientId: string | null = null;
        let isVip = false;
        let vipPlan: string | null = null;

        const { data: existingClient } = await db
          .from("clients")
          .select("id, is_vip, vip_plan_name")
          .or(`phone.eq.${cleanPhone},phone.eq.${clientPhone}`)
          .maybeSingle();

        if (existingClient) {
          clientId = existingClient.id;
          isVip = !!existingClient.is_vip;
          vipPlan = existingClient.vip_plan_name;
        } else {
          const { data: newClient } = await db
            .from("clients")
            .insert({
              name: clientName.trim(),
              phone: cleanPhone,
              salon_id: salon?.id || null,
              notes: "Cadastrado via App de Agendamento Online",
            })
            .select("id")
            .single();
          clientId = newClient?.id || null;
        }

        const { data: appt, error: apptErr } = await db
          .from("appointments")
          .insert({
            salon_id: salon?.id || null,
            client_id: clientId,
            professional_id: finalProId,
            service_id: primaryService.id,
            starts_at: slotStart.toISOString(),
            ends_at: slotEnd.toISOString(),
            status: "agendado",
            notes: combinedNotes,
            is_vip: isVip,
          })
          .select("id")
          .single();

        if (apptErr) throw apptErr;

        return {
          appointment_id: appt?.id,
          professional: professionals.find((p) => p.id === finalProId),
          services: selectedServices,
          starts_at: slotStart.toISOString(),
          ends_at: slotEnd.toISOString(),
          is_vip: isVip,
          vip_plan_name: vipPlan,
        };
      }

      return {
        ...rpcRes,
        professional: professionals.find((p) => p.id === finalProId),
        services: selectedServices,
      };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["public-day-appointments"] });
      qc.invalidateQueries({ queryKey: ["appointments"] });
      setBookingConfirmed(res);
      toast.success("Agendamento realizado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao realizar agendamento.");
    },
  });

  // =========================================================================
  // PORTAL DO CLIENTE (CONSULTA POR TELEFONE)
  // =========================================================================
  const [portalPhone, setPortalPhone] = useState("");
  const [portalSearchDone, setPortalSearchDone] = useState(false);

  const {
    data: portalData,
    refetch: refetchPortal,
    isLoading: isLoadingPortal,
  } = useQuery({
    queryKey: ["client-portal-data", portalPhone],
    enabled: false,
    queryFn: async () => {
      const clean = portalPhone.replace(/\D/g, "");
      if (!clean) return null;

      // Tenta a RPC get_client_portal_data
      const { data, error } = await db.rpc("get_client_portal_data", { p_phone: clean });
      if (!error && data?.found) return data;

      // Fallback manual se RPC não estiver ativa
      const { data: client } = await db
        .from("clients")
        .select("*")
        .or(`phone.eq.${clean},phone.eq.${portalPhone}`)
        .maybeSingle();

      if (!client) return { found: false, message: "Nenhum cadastro encontrado com este telefone." };

      const { data: appts } = await db
        .from("appointments")
        .select(`
          id, starts_at, ends_at, status, notes, is_vip,
          service:services(name, price, duration_min),
          professional:professionals(name, photo_url)
        `)
        .eq("client_id", client.id)
        .order("starts_at", { ascending: false });

      const mappedAppts = (appts ?? []).map((a: any) => ({
        id: a.id,
        starts_at: a.starts_at,
        ends_at: a.ends_at,
        status: a.status,
        notes: a.notes,
        is_vip: a.is_vip,
        service_name: a.service?.name || "Serviço",
        service_price: a.service?.price || 0,
        service_duration: a.service?.duration_min || 45,
        professional_name: a.professional?.name || "Barbeiro",
        professional_photo: a.professional?.photo_url,
      }));

      // Buscar assinatura ativa do cliente
      const { data: sub } = await db
        .from("client_subscriptions")
        .select(`
          *,
          plan:salon_client_plans(*)
        `)
        .eq("client_id", client.id)
        .eq("status", "ativa")
        .maybeSingle();

      return {
        found: true,
        client,
        subscription: sub || null,
        appointments: mappedAppts,
      };
    },
  });

  const handlePortalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalPhone.trim()) {
      toast.error("Informe seu telefone / WhatsApp");
      return;
    }
    setPortalSearchDone(true);
    refetchPortal();
  };

  // Cancelamento pelo cliente
  const cancelPortalAppt = useMutation({
    mutationFn: async (appointmentId: string) => {
      const clean = portalPhone.replace(/\D/g, "");
      const { data, error } = await db.rpc("cancel_client_appointment", {
        p_appointment_id: appointmentId,
        p_phone: clean,
      });

      if (error || !data?.success) {
        // Fallback direto
        const { error: updErr } = await db
          .from("appointments")
          .update({ status: "cancelado" })
          .eq("id", appointmentId);
        if (updErr) throw updErr;
      }
    },
    onSuccess: () => {
      toast.success("Agendamento cancelado com sucesso.");
      refetchPortal();
      qc.invalidateQueries({ queryKey: ["public-day-appointments"] });
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao cancelar."),
  });

  // Salvar no calendário (ICS download)
  const downloadCalendarFile = () => {
    if (!bookingConfirmed) return;
    const sDate = new Date(bookingConfirmed.starts_at);
    const eDate = new Date(bookingConfirmed.ends_at);

    const pad = (n: number) => n.toString().padStart(2, "0");
    const fmtICS = (d: Date) =>
      `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;

    const title = `Corte no ${salon?.name || "Belezi Barbearia"}`;
    const desc = `Agendamento com ${bookingConfirmed.professional?.name || "Barbeiro"}. Endereço: ${salon?.address || "Barbearia"}`;

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Belezi//App//PT",
      "BEGIN:VEVENT",
      `SUMMARY:${title}`,
      `DESCRIPTION:${desc}`,
      `DTSTART:${fmtICS(sDate)}`,
      `DTEND:${fmtICS(eDate)}`,
      `LOCATION:${salon?.full_address || salon?.address || "Barbearia"}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute("download", "agendamento-belezi.ics");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const barberName = salon?.name || "Barbearia Imperial Belezi";
  const barberTagline = salon?.tagline || "Tradição, estilo e cuidado masculino de alto padrão.";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
      {/* Barra de Topo / Header Mobile-First */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {salon?.logo_url ? (
              <img
                src={salon.logo_url}
                alt={barberName}
                className="h-9 w-9 rounded-full object-cover border"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm">
                💈
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold truncate leading-tight">{barberName}</h1>
              <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                <MapPin className="h-3 w-3 text-primary shrink-0" />
                {salon?.city || "São Paulo"} · {salon?.neighborhood || "Centro"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PWAInstallButton />
            <Link
              to="/"
              className="text-xs text-muted-foreground hover:text-foreground hidden sm:inline-flex items-center gap-1"
            >
              <span>Sobre o Sistema</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Navegação por Abas (Desktop & Mobile Superior) */}
      <div className="border-b bg-card/60 backdrop-blur-xs">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between overflow-x-auto scrollbar-none py-1.5 gap-1">
          <Button
            variant={activeTab === "inicio" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("inicio")}
            className="text-xs shrink-0"
          >
            <Store className="h-3.5 w-3.5 mr-1 text-primary" /> Barbearia
          </Button>

          <Button
            variant={activeTab === "servicos" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("servicos")}
            className="text-xs shrink-0"
          >
            <Scissors className="h-3.5 w-3.5 mr-1 text-primary" /> Serviços
          </Button>

          <Button
            variant={activeTab === "agendar" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("agendar")}
            className="text-xs shrink-0 font-semibold"
          >
            <CalendarCheck className="h-3.5 w-3.5 mr-1" /> Agendar Horário
          </Button>

          <Button
            variant={activeTab === "portal" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("portal")}
            className="text-xs shrink-0"
          >
            <History className="h-3.5 w-3.5 mr-1 text-primary" /> Meus Agendamentos
          </Button>

          <Button
            variant={activeTab === "vip" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("vip")}
            className="text-xs shrink-0 text-purple-600 dark:text-purple-400 font-medium"
          >
            <Crown className="h-3.5 w-3.5 mr-1 text-purple-500" /> Clube VIP
          </Button>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* =================================================================== */}
        {/* ABA 1: INÍCIO / VISUAL DA BARBEARIA & GALERIA */}
        {/* =================================================================== */}
        {activeTab === "inicio" && (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
            {/* Banner & Identidade da Barbearia */}
            <div className="relative rounded-2xl overflow-hidden border bg-card">
              {salon?.banner_url ? (
                <img
                  src={salon.banner_url}
                  alt={barberName}
                  className="w-full h-44 sm:h-64 object-cover"
                />
              ) : (
                <div className="w-full h-44 sm:h-64 bg-linear-to-r from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6 text-center">
                  <div className="space-y-2">
                    <span className="text-4xl">💈</span>
                    <h2 className="text-xl sm:text-2xl font-bold text-white">{barberName}</h2>
                    <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">{barberTagline}</p>
                  </div>
                </div>
              )}

              <div className="p-4 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold">{barberName}</h2>
                    <p className="text-xs text-muted-foreground">{barberTagline}</p>
                  </div>

                  <Button
                    size="lg"
                    onClick={() => setActiveTab("agendar")}
                    className="bg-primary text-primary-foreground font-semibold shadow-md w-full sm:w-auto"
                  >
                    <CalendarCheck className="h-4 w-4 mr-2" /> Agendar Agora
                  </Button>
                </div>

                {/* Localização & Contatos */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t text-xs">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Localização</p>
                      <p className="text-muted-foreground">
                        {salon?.full_address || salon?.address || "Consulte o salão para detalhes de endereço"}
                      </p>
                      {salon?.maps_link && (
                        <a
                          href={salon.maps_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline text-[11px] inline-flex items-center gap-1 mt-0.5"
                        >
                          Ver no Mapa <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Horário de Atendimento</p>
                      <p className="text-muted-foreground">
                        {salon?.business_hours?.monday
                          ? `Seg–Sex: ${salon.business_hours.monday.open} às ${salon.business_hours.monday.close}`
                          : "Segunda a Sábado, 09h às 20h"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Sáb: {salon?.business_hours?.saturday?.open || "08:00"} às {salon?.business_hours?.saturday?.close || "19:00"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Phone className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Contato Direto</p>
                      <p className="text-muted-foreground">{salon?.whatsapp || salon?.phone || "(11) 99999-8888"}</p>
                      {salon?.whatsapp && (
                        <a
                          href={`https://wa.me/55${salon.whatsapp.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-600 dark:text-emerald-400 hover:underline text-[11px] inline-flex items-center gap-1 mt-0.5"
                        >
                          Falar no WhatsApp <MessageCircle className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Galeria de Fotos do Espaço */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base">Nosso Espaço</h3>
                  <p className="text-xs text-muted-foreground">
                    Ambiente climatizado, café espresso e bancadas vintage
                  </p>
                </div>
              </div>

              {photos.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="group relative rounded-xl overflow-hidden border bg-muted aspect-4/3"
                    >
                      <img
                        src={photo.url}
                        alt={photo.title || "Espaço da Barbearia"}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {photo.title && (
                        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent flex items-end p-2.5">
                          <p className="text-white text-xs font-medium truncate">{photo.title}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl overflow-hidden border bg-muted aspect-4/3 relative">
                    <img
                      src="https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=800&q=80"
                      alt="Lounge da barbearia"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent flex items-end p-2.5">
                      <span className="text-white text-xs font-medium">Lounge & Recepção</span>
                    </div>
                  </div>
                  <div className="rounded-xl overflow-hidden border bg-muted aspect-4/3 relative">
                    <img
                      src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80"
                      alt="Bancadas de corte"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent flex items-end p-2.5">
                      <span className="text-white text-xs font-medium">Estações de Corte</span>
                    </div>
                  </div>
                  <div className="rounded-xl overflow-hidden border bg-muted aspect-4/3 relative">
                    <img
                      src="https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=800&q=80"
                      alt="Barboterapia"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent flex items-end p-2.5">
                      <span className="text-white text-xs font-medium">Barboterapia com Toalha Quente</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Equipe de Barbeiros */}
            <div className="space-y-3">
              <h3 className="font-bold text-base">Nossa Equipe de Barbeiros</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {professionals.map((pro) => (
                  <Card key={pro.id} className="border bg-card">
                    <CardContent className="p-4 flex items-center gap-3">
                      <Avatar className="h-12 w-12 border">
                        <AvatarImage src={pro.photo_url || ""} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">
                          {pro.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-sm truncate">{pro.name}</h4>
                        <p className="text-xs text-muted-foreground truncate">{pro.role}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(pro.specialties || ["Corte Masculino"]).slice(0, 2).map((s, idx) => (
                            <Badge key={idx} variant="outline" className="text-[9px] px-1 py-0">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedProId(pro.id || "any");
                          setActiveTab("agendar");
                        }}
                        className="text-xs text-primary"
                      >
                        Agendar
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Políticas de Atendimento */}
            <Card className="border bg-muted/30">
              <CardContent className="p-4 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Info className="h-4 w-4 text-primary" />
                  Regras e Políticas da Barbearia
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  {salon?.scheduling_rules || "Agendamentos confirmados instantaneamente. Tolerância de 15 minutos."}
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  <strong>Cancelamentos:</strong>{" "}
                  {salon?.cancellation_policy || "Cancelamento gratuito com até 2 horas de antecedência."}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* =================================================================== */}
        {/* ABA 2: CATÁLOGO DE SERVIÇOS & PRODUTOS */}
        {/* =================================================================== */}
        {activeTab === "servicos" && (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
            <div>
              <h2 className="text-lg font-bold">Cardápio de Serviços</h2>
              <p className="text-xs text-muted-foreground">
                Selecione os serviços desejados para agendar com nossa equipe
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {services.map((srv) => {
                const isSelected = selectedServices.some((s) => s.id === srv.id);
                return (
                  <Card
                    key={srv.id}
                    className={`border transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-xs"
                        : "bg-card hover:border-primary/40"
                    }`}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedServices(selectedServices.filter((s) => s.id !== srv.id));
                      } else {
                        setSelectedServices([...selectedServices, srv]);
                      }
                    }}
                  >
                    <CardContent className="p-4 flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm">{srv.name}</h4>
                          {srv.highlight && (
                            <Badge className="bg-amber-500 hover:bg-amber-600 text-[9px] px-1 py-0 text-white font-bold">
                              Destaque
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {srv.description || "Atendimento completo com produtos de acabamento premium."}
                        </p>
                        <div className="flex items-center gap-3 pt-1 text-xs">
                          <span className="font-bold text-foreground text-sm">{brl(srv.price)}</span>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {srv.duration_min} min
                          </span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        className="text-xs h-8 shrink-0"
                      >
                        {isSelected ? <Check className="h-3.5 w-3.5" /> : "+ Escolher"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {selectedServices.length > 0 && (
              <div className="sticky bottom-16 sm:bottom-4 z-30 p-4 rounded-xl border bg-card/95 backdrop-blur-md shadow-lg flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold">
                    {selectedServices.length} {selectedServices.length === 1 ? "serviço escolhido" : "serviços escolhidos"}
                  </p>
                  <p className="text-sm font-bold text-primary">
                    {brl(totalPrice)} · {totalDurationMin} min
                  </p>
                </div>
                <Button onClick={() => setActiveTab("agendar")} className="bg-primary text-primary-foreground font-semibold">
                  Continuar Agendamento <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}

            {/* Vitrine de Produtos */}
            {products.length > 0 && (
              <div className="space-y-3 pt-6 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-primary" /> Produtos para Cuidado Masculino
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Disponíveis para compra e retirada direta na barbearia
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {products.map((p) => (
                    <Card key={p.id} className="border bg-card">
                      <CardContent className="p-3 space-y-1.5 text-xs">
                        <div className="h-24 rounded bg-muted/60 flex items-center justify-center text-2xl">
                          🧴
                        </div>
                        <h4 className="font-semibold truncate">{p.name}</h4>
                        <p className="font-bold text-primary">{brl(p.price)}</p>
                        <Badge variant="outline" className="text-[9px]">
                          Pronta Entrega
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* ABA 3: FLUXO DE AGENDAMENTO COMPLETO */}
        {/* =================================================================== */}
        {activeTab === "agendar" && (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
            <div>
              <h2 className="text-lg font-bold">Agendamento de Horário</h2>
              <p className="text-xs text-muted-foreground">
                Escolha o serviço, barbeiro e o melhor horário para você
              </p>
            </div>

            {/* Passo 1: Serviços Selecionados */}
            <Card className="border">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                      1
                    </span>
                    Serviços Selecionados
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 text-primary"
                    onClick={() => setActiveTab("servicos")}
                  >
                    Alterar serviços
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                {selectedServices.length === 0 ? (
                  <div className="text-center py-4 space-y-2 border border-dashed rounded-lg">
                    <p className="text-xs text-muted-foreground">Nenhum serviço selecionado ainda.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setActiveTab("servicos")}
                      className="text-xs"
                    >
                      Ver Catálogo de Serviços
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedServices.map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-xs border-b pb-1.5 last:border-0">
                        <div>
                          <span className="font-semibold">{s.name}</span>
                          <span className="text-muted-foreground ml-2">({s.duration_min} min)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{brl(s.price)}</span>
                          <button
                            onClick={() => setSelectedServices(selectedServices.filter((x) => x.id !== s.id))}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-2 font-bold text-xs">
                      <span>Total Previsto:</span>
                      <span className="text-primary text-sm">
                        {brl(totalPrice)} · {totalDurationMin} minutos
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Passo 2: Escolha do Profissional */}
            <Card className="border">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                    2
                  </span>
                  Escolha o Barbeiro
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div
                    onClick={() => setSelectedProId("any")}
                    className={`rounded-lg border p-3 text-center cursor-pointer transition-all ${
                      selectedProId === "any"
                        ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                        : "bg-card hover:border-muted-foreground/40"
                    }`}
                  >
                    <div className="h-10 w-10 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg mb-1">
                      💈
                    </div>
                    <p className="text-xs font-semibold">Qualquer Barbeiro</p>
                    <p className="text-[10px] text-muted-foreground">Primeiro disponível</p>
                  </div>

                  {professionals.map((pro) => (
                    <div
                      key={pro.id}
                      onClick={() => setSelectedProId(pro.id || "")}
                      className={`rounded-lg border p-3 text-center cursor-pointer transition-all ${
                        selectedProId === pro.id
                          ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                          : "bg-card hover:border-muted-foreground/40"
                      }`}
                    >
                      <Avatar className="h-10 w-10 mx-auto border mb-1">
                        <AvatarImage src={pro.photo_url || ""} />
                        <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                          {pro.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-xs font-semibold truncate">{pro.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{pro.role}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Passo 3: Data e Horário */}
            <Card className="border">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                    3
                  </span>
                  Data e Horário
                </CardTitle>
                <CardDescription className="text-xs">
                  Horários calculados em tempo real sem conflito de agenda
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-4">
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setSelectedTime("");
                    }}
                    className="w-48 text-xs"
                  />
                  <span className="text-xs text-muted-foreground capitalize">
                    {DAY_NAMES_PT[getDayKeyFromDate(selectedDate)]}
                  </span>
                </div>

                {!salonDayStatus.isOpen ? (
                  <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs">
                    A barbearia está fechada neste dia ({DAY_NAMES_PT[getDayKeyFromDate(selectedDate)]}). Por favor, escolha outra data.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Horários Disponíveis ({DAY_NAMES_PT[getDayKeyFromDate(selectedDate)]}):</Label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={!slot.isAvailable}
                          onClick={() => setSelectedTime(slot.time)}
                          className={`rounded-md p-2 text-xs font-medium border transition-all ${
                            !slot.isAvailable
                              ? "opacity-40 bg-muted/50 cursor-not-allowed line-through"
                              : selectedTime === slot.time
                              ? "border-primary bg-primary text-primary-foreground font-bold shadow-xs"
                              : "bg-card hover:border-primary"
                          }`}
                          title={slot.reason || "Disponível"}
                        >
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Passo 4: Dados do Cliente */}
            <Card className="border">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                    4
                  </span>
                  Seus Dados para Contato
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium">Nome Completo *</Label>
                    <Input
                      type="text"
                      placeholder="Ex: João da Silva"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">WhatsApp / Telefone *</Label>
                    <Input
                      type="tel"
                      placeholder="(11) 98765-4321"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className="text-xs mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium">Observações para o Barbeiro (Opcional)</Label>
                  <Textarea
                    placeholder="Ex: Não tirar muito na parte de cima, barba bem desenhada..."
                    value={clientNotes}
                    onChange={(e) => setClientNotes(e.target.value)}
                    rows={2}
                    className="text-xs mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Botão de Finalização */}
            <div className="pt-2">
              <Button
                size="lg"
                onClick={() => bookMutation.mutate()}
                disabled={
                  selectedServices.length === 0 ||
                  !selectedTime ||
                  !clientName.trim() ||
                  !clientPhone.trim() ||
                  bookMutation.isPending
                }
                className="w-full bg-primary text-primary-foreground font-bold shadow-md text-sm h-12"
              >
                {bookMutation.isPending ? "Confirmando..." : `Confirmar Agendamento · ${brl(totalPrice)}`}
              </Button>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* ABA 4: PORTAL DO CLIENTE (CONSULTA, REMARCAR E CANCELAR) */}
        {/* =================================================================== */}
        {activeTab === "portal" && (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
            <div>
              <h2 className="text-lg font-bold">Portal do Cliente</h2>
              <p className="text-xs text-muted-foreground">
                Consulte seus agendamentos, histórico de visitas e status do Clube VIP
              </p>
            </div>

            {/* Busca por Telefone */}
            <Card className="border">
              <CardContent className="p-4">
                <form onSubmit={handlePortalSearch} className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <Label className="text-xs font-medium mb-1 block">Digite seu WhatsApp / Telefone</Label>
                    <Input
                      type="tel"
                      placeholder="(11) 99999-9999"
                      value={portalPhone}
                      onChange={(e) => setPortalPhone(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div className="sm:self-end">
                    <Button type="submit" disabled={isLoadingPortal} className="w-full sm:w-auto text-xs">
                      <Search className="h-3.5 w-3.5 mr-1" />
                      {isLoadingPortal ? "Buscando..." : "Buscar Meus Horários"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Resultado da Busca */}
            {portalSearchDone && portalData && (
              <div className="space-y-4">
                {!portalData.found ? (
                  <Card className="border-dashed p-6 text-center text-muted-foreground text-xs">
                    Nenhum agendamento encontrado para o telefone informado.
                  </Card>
                ) : (
                  <>
                    {/* Cartão de Identificação do Cliente & VIP */}
                    <Card className="border bg-card">
                      <CardContent className="p-4 flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm">{portalData.client?.name}</h3>
                            {portalData.client?.is_vip && (
                              <Badge className="bg-purple-600 text-white font-bold text-[10px] flex items-center gap-1">
                                <Sparkles className="h-2.5 w-2.5" /> Membro VIP
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {portalData.client?.phone} · Cliente cadastrado no {barberName}
                          </p>
                          {portalData.client?.vip_plan_name && (
                            <p className="text-xs text-purple-700 dark:text-purple-300 font-semibold">
                              Plano Ativo: {portalData.client.vip_plan_name}
                            </p>
                          )}
                        </div>

                        <Button size="sm" variant="outline" onClick={() => setActiveTab("agendar")}>
                          + Novo Horário
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Cartão de Assinatura Ativa (Clube da Barbearia) */}
                    {portalData.subscription && (
                      <Card className="border-2 border-purple-500/40 bg-purple-500/5">
                        <CardHeader className="p-4 pb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Crown className="h-4 w-4 text-purple-600" />
                              <CardTitle className="text-sm font-bold text-foreground">
                                Assinatura: {portalData.subscription.plan?.name}
                              </CardTitle>
                            </div>
                            <Badge className="bg-purple-600 text-white text-[10px] font-bold">
                              {MODEL_LABELS[portalData.subscription.plan?.model as keyof typeof MODEL_LABELS]?.label || "Plano"}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-1 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Franquia no Ciclo Atual:</span>
                            <span className="font-bold text-foreground">
                              {portalData.subscription.plan?.model === "one"
                                ? `${portalData.subscription.credits_used_this_period} de 1 corte utilizado`
                                : portalData.subscription.plan?.model === "ilimitado" || portalData.subscription.plan?.model === "vip"
                                ? "Cortes Ilimitados"
                                : `${portalData.subscription.credits_used_this_period} de ${portalData.subscription.plan?.monthly_credit_limit} créditos utilizados`}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t">
                            <span>Próxima Renovação: {fmtDate(portalData.subscription.renews_at)}</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Mensalidade em dia</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Lista de Agendamentos */}
                    <div className="space-y-3">
                      <h4 className="font-bold text-sm">Seus Agendamentos</h4>
                      {(portalData.appointments || []).length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhum agendamento registrado.</p>
                      ) : (
                        portalData.appointments.map((appt: any) => {
                          const isFuture = new Date(appt.starts_at) >= new Date();
                          return (
                            <Card
                              key={appt.id}
                              className={`border ${
                                appt.status === "agendado" && isFuture
                                  ? "border-l-4 border-l-primary"
                                  : "opacity-75"
                              }`}
                            >
                              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm">
                                      {fmtDate(appt.starts_at)} às {fmtTime(appt.starts_at)}
                                    </span>
                                    <Badge
                                      variant={
                                        appt.status === "agendado"
                                          ? "default"
                                          : appt.status === "concluido"
                                          ? "secondary"
                                          : "destructive"
                                      }
                                      className="text-[10px]"
                                    >
                                      {appt.status === "agendado"
                                        ? "Agendado"
                                        : appt.status === "concluido"
                                        ? "Concluído"
                                        : "Cancelado"}
                                    </Badge>
                                  </div>
                                  <p className="font-medium text-foreground">
                                    {appt.service_name} · {brl(appt.service_price)}
                                  </p>
                                  <p className="text-muted-foreground">
                                    Barbeiro: {appt.professional_name}
                                  </p>
                                </div>

                                {appt.status === "agendado" && isFuture && (
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        if (confirm("Deseja cancelar este agendamento?")) {
                                          cancelPortalAppt.mutate(appt.id);
                                        }
                                      }}
                                      className="text-xs text-destructive hover:bg-destructive/10"
                                    >
                                      Cancelar
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setActiveTab("agendar");
                                        toast.info("Escolha um novo horário para remarcar.");
                                      }}
                                      className="text-xs"
                                    >
                                      Remarcar
                                    </Button>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* ABA 5: CLUBE VIP & ASSINATURAS DA BARBEARIA */}
        {/* =================================================================== */}
        {activeTab === "vip" && (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
            <div className="p-6 rounded-2xl bg-linear-to-br from-purple-950 via-slate-900 to-purple-950 border border-purple-500/30 text-white space-y-3">
              <div className="flex items-center gap-2">
                <Crown className="h-6 w-6 text-amber-400" />
                <h2 className="text-xl font-bold">Clube VIP {barberName}</h2>
              </div>
              <p className="text-xs sm:text-sm text-purple-200 max-w-xl">
                Cortes ilimitados, barboterapia, prioridade na fila e atendimento sem espera. Assine o plano exclusivo da barbearia.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge className="bg-amber-400 text-slate-950 font-bold text-xs">⭐ Prioridade Máxima</Badge>
                <Badge className="bg-purple-800 text-white text-xs">✂️ Encaixe VIP Simultâneo</Badge>
                <Badge className="bg-purple-800 text-white text-xs">☕ Café & Chopp Cortesia</Badge>
              </div>
            </div>

            {/* Planos VIP da Barbearia */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {clientPlans.length > 0 ? (
                clientPlans.map((p) => {
                  const mInfo = MODEL_LABELS[p.model];
                  const isVipOrHighlight = p.model === "vip" || p.model === "one";
                  return (
                    <Card
                      key={p.id}
                      className={`border bg-card flex flex-col justify-between ${
                        p.model === "vip"
                          ? "border-2 border-purple-500 bg-purple-500/5 shadow-md"
                          : p.model === "one"
                          ? "border-2 border-blue-500/50 bg-blue-500/5"
                          : ""
                      }`}
                    >
                      <CardHeader className="p-5 pb-2">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <Badge className={`${mInfo.badgeColor} text-[10px]`}>
                            {mInfo.label}
                          </Badge>
                          {p.model === "one" && (
                            <Badge variant="outline" className="text-[9px] font-bold">
                              1 corte/mês
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-base font-bold">{p.name}</CardTitle>
                        <p className="text-2xl font-bold mt-2">
                          {brl(p.price)}
                          <span className="text-xs font-normal text-muted-foreground">/{p.billing_cycle}</span>
                        </p>
                      </CardHeader>
                      <CardContent className="p-5 pt-2 space-y-3 text-xs flex-1 flex flex-col justify-between">
                        <div className="space-y-2">
                          <p className="text-muted-foreground text-[11px]">{mInfo.description}</p>
                          {p.benefits && p.benefits.length > 0 && (
                            <ul className="space-y-1.5 text-foreground">
                              {p.benefits.map((b, idx) => (
                                <li key={idx} className="flex items-center gap-1.5 font-medium">
                                  <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                  <span>{b}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <Button
                          onClick={() => {
                            toast.success(`Interesse no plano ${p.name} registrado! Fale com seu barbeiro para ativar.`);
                            setActiveTab("agendar");
                          }}
                          className={`w-full text-xs font-bold mt-3 ${
                            isVipOrHighlight ? "bg-primary text-primary-foreground" : ""
                          }`}
                          variant={isVipOrHighlight ? "default" : "outline"}
                        >
                          Quero Assinar {p.name}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <>
                  <Card className="border bg-card">
                    <CardHeader className="p-5 pb-2">
                      <Badge className="bg-blue-600 text-white w-fit text-xs mb-1">
                        Plano One
                      </Badge>
                      <CardTitle className="text-base font-bold">Belezi One</CardTitle>
                      <p className="text-2xl font-bold mt-2">
                        R$ 59<span className="text-xs font-normal text-muted-foreground">/mês</span>
                      </p>
                    </CardHeader>
                    <CardContent className="p-5 pt-2 space-y-3 text-xs">
                      <ul className="space-y-1.5 text-muted-foreground">
                        <li className="flex items-center gap-1.5">
                          <Check className="h-3.5 w-3.5 text-emerald-500" /> Exatamente 1 corte por mês
                        </li>
                        <li className="flex items-center gap-1.5">
                          <Check className="h-3.5 w-3.5 text-emerald-500" /> Lavagem e finalização inclusas
                        </li>
                        <li className="flex items-center gap-1.5">
                          <Check className="h-3.5 w-3.5 text-emerald-500" /> Renovação automática mensal
                        </li>
                      </ul>
                      <Button
                        onClick={() => {
                          toast.success("Solicite ao seu barbeiro para ativar o Plano One!");
                          setActiveTab("agendar");
                        }}
                        className="w-full text-xs"
                        variant="outline"
                      >
                        Quero o Plano One
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-purple-500 bg-purple-500/5 shadow-md relative">
                    <div className="absolute -top-3 right-4 bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                      Clube VIP
                    </div>
                    <CardHeader className="p-5 pb-2">
                      <Badge className="bg-purple-600 text-white w-fit text-xs mb-1 font-bold">
                        Cabelo + Barba
                      </Badge>
                      <CardTitle className="text-base font-bold">VIP Black Executive</CardTitle>
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-2">
                        R$ 149<span className="text-xs font-normal text-muted-foreground">/mês</span>
                      </p>
                    </CardHeader>
                    <CardContent className="p-5 pt-2 space-y-3 text-xs">
                      <ul className="space-y-1.5 text-foreground">
                        <li className="flex items-center gap-1.5 font-medium">
                          <Check className="h-3.5 w-3.5 text-purple-600" /> Cortes e Barbas ilimitados
                        </li>
                        <li className="flex items-center gap-1.5 font-medium">
                          <Check className="h-3.5 w-3.5 text-purple-600" /> Barboterapia com toalha quente
                        </li>
                        <li className="flex items-center gap-1.5 font-medium">
                          <Check className="h-3.5 w-3.5 text-purple-600" /> Encaixe prioritário na agenda
                        </li>
                      </ul>
                      <Button
                        onClick={() => {
                          toast.success("Excelente escolha! Solicite ao seu barbeiro.");
                          setActiveTab("agendar");
                        }}
                        className="w-full text-xs bg-purple-600 text-white hover:bg-purple-700 font-bold"
                      >
                        Assinar VIP Black
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border bg-card">
                    <CardHeader className="p-5 pb-2">
                      <Badge className="bg-emerald-600 text-white w-fit text-xs mb-1">
                        Recorrente 4x
                      </Badge>
                      <CardTitle className="text-base font-bold">Clube Recorrente</CardTitle>
                      <p className="text-2xl font-bold mt-2">
                        R$ 119<span className="text-xs font-normal text-muted-foreground">/mês</span>
                      </p>
                    </CardHeader>
                    <CardContent className="p-5 pt-2 space-y-3 text-xs">
                      <ul className="space-y-1.5 text-muted-foreground">
                        <li className="flex items-center gap-1.5">
                          <Check className="h-3.5 w-3.5 text-emerald-500" /> Até 4 atendimentos no mês
                        </li>
                        <li className="flex items-center gap-1.5">
                          <Check className="h-3.5 w-3.5 text-emerald-500" /> Controle de créditos debitados
                        </li>
                        <li className="flex items-center gap-1.5">
                          <Check className="h-3.5 w-3.5 text-emerald-500" /> 10% off em produtos da barbearia
                        </li>
                      </ul>
                      <Button
                        onClick={() => {
                          toast.success("Fale com o barbeiro na sua próxima visita para ativar!");
                          setActiveTab("agendar");
                        }}
                        className="w-full text-xs"
                        variant="outline"
                      >
                        Quero Assinar
                      </Button>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* =================================================================== */}
      {/* DIÁLOGO MODAL DE SUCESSO / COMPROVANTE DO AGENDAMENTO */}
      {/* =================================================================== */}
      <Dialog open={!!bookingConfirmed} onOpenChange={(open) => !open && setBookingConfirmed(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader className="text-center sm:text-center">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-600 mx-auto flex items-center justify-center mb-2">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <DialogTitle className="text-lg font-bold">Agendamento Confirmado!</DialogTitle>
            <DialogDescription className="text-xs">
              Seu horário foi reservado com sucesso e já consta na agenda da barbearia.
            </DialogDescription>
          </DialogHeader>

          {bookingConfirmed && (
            <div className="space-y-3 py-2 text-xs">
              <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                <div className="flex items-center justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Data e Horário:</span>
                  <span className="font-bold text-foreground">
                    {fmtDate(bookingConfirmed.starts_at)} às {fmtTime(bookingConfirmed.starts_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Barbeiro:</span>
                  <span className="font-bold text-foreground">
                    {bookingConfirmed.professional?.name || "Barbeiro"}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Serviço(s):</span>
                  <span className="font-bold text-foreground">
                    {(bookingConfirmed.services || []).map((s: any) => s.name).join(", ") || "Serviço"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Local:</span>
                  <span className="font-semibold text-foreground text-right truncate max-w-[200px]">
                    {salon?.address || barberName}
                  </span>
                </div>
              </div>

              {bookingConfirmed.is_vip && (
                <div className="rounded-lg bg-purple-500/10 border border-purple-500/30 p-2.5 flex items-center gap-2 text-purple-700 dark:text-purple-300">
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span>Atendimento registrado com prioridade de Cliente VIP!</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-col gap-2">
            <Button
              type="button"
              onClick={downloadCalendarFile}
              variant="outline"
              className="w-full text-xs"
            >
              <CalendarIcon className="h-3.5 w-3.5 mr-1" /> Adicionar ao Meu Calendário
            </Button>
            <Button
              type="button"
              onClick={() => {
                setBookingConfirmed(null);
                setActiveTab("inicio");
              }}
              className="w-full text-xs bg-primary text-primary-foreground font-semibold"
            >
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barra de Navegação Inferior Fixa para Mobile (Estilo App Nativo) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t px-2 py-1.5 flex items-center justify-around text-[10px]">
        <button
          onClick={() => setActiveTab("inicio")}
          className={`flex flex-col items-center gap-0.5 p-1 ${
            activeTab === "inicio" ? "text-primary font-bold" : "text-muted-foreground"
          }`}
        >
          <Store className="h-4 w-4" />
          <span>Barbearia</span>
        </button>

        <button
          onClick={() => setActiveTab("servicos")}
          className={`flex flex-col items-center gap-0.5 p-1 ${
            activeTab === "servicos" ? "text-primary font-bold" : "text-muted-foreground"
          }`}
        >
          <Scissors className="h-4 w-4" />
          <span>Serviços</span>
        </button>

        <button
          onClick={() => setActiveTab("agendar")}
          className={`flex flex-col items-center gap-0.5 p-1 -mt-3 bg-primary text-primary-foreground rounded-full h-11 w-11 shadow-lg justify-center`}
        >
          <CalendarCheck className="h-5 w-5" />
        </button>

        <button
          onClick={() => setActiveTab("portal")}
          className={`flex flex-col items-center gap-0.5 p-1 ${
            activeTab === "portal" ? "text-primary font-bold" : "text-muted-foreground"
          }`}
        >
          <History className="h-4 w-4" />
          <span>Meus Horários</span>
        </button>

        <button
          onClick={() => setActiveTab("vip")}
          className={`flex flex-col items-center gap-0.5 p-1 ${
            activeTab === "vip" ? "text-purple-500 font-bold" : "text-muted-foreground"
          }`}
        >
          <Crown className="h-4 w-4" />
          <span>Clube VIP</span>
        </button>
      </nav>

      {/* Rodapé Desktop */}
      <footer className="border-t bg-card py-6 px-4 mt-8 hidden sm:block text-xs text-muted-foreground">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <p>© 2026 {barberName} · Sistema Belezi powered by NEXADASH</p>
          <div className="flex items-center gap-4">
            <Link to="/auth" className="hover:text-foreground">
              Acesso da Barbearia
            </Link>
            <PWAInstallButton />
          </div>
        </div>
      </footer>
    </div>
  );
}
