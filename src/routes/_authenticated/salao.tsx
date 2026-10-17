import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Store,
  Palette,
  Image as ImageIcon,
  Clock,
  ShieldCheck,
  Users,
  Scissors,
  Eye,
  Plus,
  Trash2,
  Pencil,
  MapPin,
  Phone,
  Mail,
  Globe,
  Instagram,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Upload,
  Calendar,
  Save,
  Building2,
  Star,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { db, brl } from "@/lib/db";
import type {
  SalonSettingsData,
  SalonPhoto,
  BusinessHoursWeek,
  ProfessionalData,
  ServiceData,
} from "@/types/salon";

export const Route = createFileRoute("/_authenticated/salao")({
  head: () => ({
    meta: [
      { title: "Configurações da Barbearia — Belezi" },
      { name: "description", content: "Personalize identidade visual, dados, equipe, serviços e fotos da sua barbearia." },
      { property: "og:title", content: "Configurações da Barbearia — Belezi" },
      { property: "og:description", content: "Personalize identidade visual, dados, equipe, serviços e fotos da sua barbearia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalaoConfigPage,
});

const DEFAULT_BUSINESS_HOURS: BusinessHoursWeek = {
  monday: { open: "09:00", close: "20:00", closed: false },
  tuesday: { open: "09:00", close: "20:00", closed: false },
  wednesday: { open: "09:00", close: "20:00", closed: false },
  thursday: { open: "09:00", close: "20:00", closed: false },
  friday: { open: "09:00", close: "20:00", closed: false },
  saturday: { open: "08:00", close: "19:00", closed: false },
  sunday: { open: "09:00", close: "14:00", closed: true },
};

const DAY_LABELS: Record<keyof BusinessHoursWeek, string> = {
  monday: "Segunda-feira",
  tuesday: "Terça-feira",
  wednesday: "Quarta-feira",
  thursday: "Quinta-feira",
  friday: "Sexta-feira",
  saturday: "Sábado",
  sunday: "Domingo",
};

const COLOR_PALETTES = [
  { name: "Black & Gold Premium", primary: "#0D1117", secondary: "#D4AF37", bg: "bg-[#0D1117]" },
  { name: "Industrial Amber", primary: "#1E293B", secondary: "#FF6500", bg: "bg-[#1E293B]" },
  { name: "Vintage Bourbon", primary: "#271E18", secondary: "#E2A03F", bg: "bg-[#271E18]" },
  { name: "Navy & Leather", primary: "#0F1E36", secondary: "#C19A6B", bg: "bg-[#0F1E36]" },
  { name: "Emerald Barber", primary: "#064E3B", secondary: "#F59E0B", bg: "bg-[#064E3B]" },
];

const CURATED_SAMPLE_PHOTOS: { title: string; category: SalonPhoto["category"]; url: string; caption: string }[] = [
  {
    title: "Lounge Principal & Recepção",
    category: "lounge",
    url: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1200&q=80",
    caption: "Área de espera com poltronas vintage de couro e café espresso de cortesia.",
  },
  {
    title: "Estação de Corte & Navalha",
    category: "estacoes",
    url: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80",
    caption: "Cadeiras hidráulicas ergonômicas e bancadas em madeira nobre.",
  },
  {
    title: "Fachada & Recepção Externa",
    category: "fachada",
    url: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1200&q=80",
    caption: "Ambiente climatizado, iluminação cênica e localização privilegiada.",
  },
  {
    title: "Espaço Barboterapia & Toalha Quente",
    category: "ambiente",
    url: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=1200&q=80",
    caption: "Tratamento facial, óleos essenciais e toalhas aquecidas aromatizadas.",
  },
];

const AVAILABLE_SPECIALTIES = [
  "Corte Degradê / Fade",
  "Barboterapia c/ Toalha Quente",
  "Corte Clássico na Tesoura",
  "Navalhado Artístico",
  "Barba Terapia e Alinhamento",
  "Visagismo Masculino",
  "Platinado / Nevou",
  "Camuflagem de Fios Brancos",
  "Selagem Capilar",
  "Hidratação e Reconstrução",
  "Design de Sobrancelha",
  "Corte Infantil",
];

const SERVICE_CATEGORIES = [
  { value: "cabelo", label: "Cabelo" },
  { value: "barba", label: "Barba" },
  { value: "combo", label: "Combos & Barboterapia" },
  { value: "estetica", label: "Estética & Tratamentos" },
  { value: "infantil", label: "Infantil" },
  { value: "outro", label: "Outro" },
];

function SalaoConfigPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("perfil");

  // Formulário do Salão
  const [salonData, setSalonData] = useState<SalonSettingsData>({
    name: "",
    tagline: "Estilo clássico, precisão moderna",
    logo_url: "",
    banner_url: "",
    primary_color: "#0F172A",
    secondary_color: "#D4AF37",
    phone: "",
    whatsapp: "",
    email: "",
    instagram: "",
    facebook: "",
    website: "",
    address: "",
    city: "",
    state: "",
    neighborhood: "",
    zip_code: "",
    full_address: "",
    maps_link: "",
    scheduling_rules: "Agendamentos garantem sua vaga. Tolerância máxima de 15 minutos.",
    min_advance_minutes: 30,
    max_advance_days: 30,
    cancellation_policy: "Cancelamento ou reagendamento gratuito com até 2 horas de antecedência.",
    late_tolerance_minutes: 15,
    reminder_hours: 2,
    photos: [],
    business_hours: DEFAULT_BUSINESS_HOURS,
  });

  // Modal de Adicionar Foto
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [newPhoto, setNewPhoto] = useState<Partial<SalonPhoto>>({
    url: "",
    title: "",
    caption: "",
    category: "ambiente",
  });

  // Modal de Barbeiro/Profissional
  const [proModalOpen, setProModalOpen] = useState(false);
  const [editingPro, setEditingPro] = useState<ProfessionalData | null>(null);

  // Modal de Serviço
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceData | null>(null);

  // 1. Carregar Configurações do Salão
  const { data: salonRecord, isLoading: isLoadingSalon } = useQuery({
    queryKey: ["salon-settings"],
    queryFn: async () => {
      const { data, error } = await db.from("salon_settings").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (salonRecord) {
      setSalonData((prev) => ({
        ...prev,
        ...salonRecord,
        name: salonRecord.name || prev.name,
        tagline: salonRecord.tagline || prev.tagline,
        primary_color: salonRecord.primary_color || prev.primary_color,
        secondary_color: salonRecord.secondary_color || prev.secondary_color,
        scheduling_rules: salonRecord.scheduling_rules || prev.scheduling_rules,
        cancellation_policy: salonRecord.cancellation_policy || prev.cancellation_policy,
        min_advance_minutes: salonRecord.min_advance_minutes ?? prev.min_advance_minutes,
        max_advance_days: salonRecord.max_advance_days ?? prev.max_advance_days,
        late_tolerance_minutes: salonRecord.late_tolerance_minutes ?? prev.late_tolerance_minutes,
        reminder_hours: salonRecord.reminder_hours ?? prev.reminder_hours,
        business_hours: salonRecord.business_hours || DEFAULT_BUSINESS_HOURS,
        photos: Array.isArray(salonRecord.photos) ? salonRecord.photos : prev.photos,
      }));
    }
  }, [salonRecord]);

  // 2. Carregar Profissionais do Salão (filtrado estritamente por tenant/salon_id e owner_id)
  const { data: professionals = [], refetch: refetchProfessionals } = useQuery({
    queryKey: ["salon-professionals"],
    queryFn: async (): Promise<ProfessionalData[]> => {
      const { data, error } = await db
        .from("professionals")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        specialties: Array.isArray(p.specialties) ? p.specialties : [],
      }));
    },
  });

  // 3. Carregar Serviços do Salão (filtrado estritamente por tenant/salon_id e owner_id)
  const { data: services = [], refetch: refetchServices } = useQuery({
    queryKey: ["salon-services"],
    queryFn: async (): Promise<ServiceData[]> => {
      const { data, error } = await db
        .from("services")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Salvar Configurações Gerais da Barbearia
  const saveSalonMutation = useMutation({
    mutationFn: async () => {
      const { data: me } = await db.auth.getUser();
      if (!me?.user?.id) throw new Error("Usuário não autenticado");

      const payload = {
        owner_id: me.user.id,
        name: salonData.name || "Minha Barbearia",
        tagline: salonData.tagline,
        logo_url: salonData.logo_url,
        banner_url: salonData.banner_url,
        primary_color: salonData.primary_color,
        secondary_color: salonData.secondary_color,
        phone: salonData.phone,
        whatsapp: salonData.whatsapp,
        email: salonData.email,
        instagram: salonData.instagram,
        facebook: salonData.facebook,
        website: salonData.website,
        address: salonData.address,
        city: salonData.city,
        state: salonData.state,
        neighborhood: salonData.neighborhood,
        zip_code: salonData.zip_code,
        full_address: salonData.full_address || salonData.address,
        maps_link: salonData.maps_link,
        scheduling_rules: salonData.scheduling_rules,
        min_advance_minutes: Number(salonData.min_advance_minutes || 30),
        max_advance_days: Number(salonData.max_advance_days || 30),
        cancellation_policy: salonData.cancellation_policy,
        late_tolerance_minutes: Number(salonData.late_tolerance_minutes || 15),
        reminder_hours: Number(salonData.reminder_hours || 2),
        photos: salonData.photos,
        business_hours: salonData.business_hours,
        updated_at: new Date().toISOString(),
      };

      const { error } = await db
        .from("salon_settings")
        .upsert(payload, { onConflict: "owner_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["salon-settings"] });
      qc.invalidateQueries({ queryKey: ["salon-status-check"] });
      toast.success("Configurações da barbearia salvas com sucesso!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao salvar: ${err.message}`);
    },
  });

  // Salvar / Adicionar Profissional
  const saveProfessionalMutation = useMutation({
    mutationFn: async (pro: ProfessionalData) => {
      const { data: me } = await db.auth.getUser();
      const payload: any = {
        name: pro.name,
        role: pro.role || "cabeleireiro",
        phone: pro.phone,
        active: pro.active,
        photo_url: pro.photo_url || null,
        bio: pro.bio || null,
        specialties: pro.specialties || [],
        working_hours: pro.working_hours || "Terça a Sábado, 09h às 19h",
        instagram: pro.instagram || null,
      };

      if (salonRecord?.id) {
        payload.salon_id = salonRecord.id;
      }

      if (pro.id) {
        const { error } = await db.from("professionals").update(payload).eq("id", pro.id);
        if (error) throw error;
      } else {
        payload.owner_id = me.user.id;
        const { error } = await db.from("professionals").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      refetchProfessionals();
      setProModalOpen(false);
      setEditingPro(null);
      toast.success("Profissional salvo com sucesso!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Excluir Profissional
  const deleteProfessionalMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("professionals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchProfessionals();
      toast.success("Profissional removido");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Salvar / Adicionar Serviço
  const saveServiceMutation = useMutation({
    mutationFn: async (srv: ServiceData) => {
      const { data: me } = await db.auth.getUser();
      const payload: any = {
        name: srv.name,
        category: srv.category || "cabelo",
        price: Number(srv.price || 0),
        duration_min: Number(srv.duration_min || 60),
        commission_pct: Number(srv.commission_pct || 0),
        active: srv.active,
        description: srv.description || null,
        photo_url: srv.photo_url || null,
        highlight: !!srv.highlight,
      };

      if (salonRecord?.id) {
        payload.salon_id = salonRecord.id;
      }

      if (srv.id) {
        const { error } = await db.from("services").update(payload).eq("id", srv.id);
        if (error) throw error;
      } else {
        payload.owner_id = me.user.id;
        const { error } = await db.from("services").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      refetchServices();
      setServiceModalOpen(false);
      setEditingService(null);
      toast.success("Serviço salvo com sucesso!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Excluir Serviço
  const deleteServiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchServices();
      toast.success("Serviço removido");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Adicionar foto personalizada
  const handleAddPhoto = () => {
    if (!newPhoto.url) {
      toast.error("Informe a URL da foto ou selecione uma imagem");
      return;
    }
    const photoItem: SalonPhoto = {
      id: crypto.randomUUID(),
      url: newPhoto.url,
      title: newPhoto.title || "Foto do Espaço",
      caption: newPhoto.caption || "",
      category: newPhoto.category || "ambiente",
      display_order: salonData.photos.length,
      created_at: new Date().toISOString(),
    };
    const updated = [...salonData.photos, photoItem];
    setSalonData((prev) => ({ ...prev, photos: updated }));
    setNewPhoto({ url: "", title: "", caption: "", category: "ambiente" });
    setPhotoModalOpen(false);
    toast.success("Foto adicionada à galeria!");
  };

  // Carregar presets de fotos de alta qualidade
  const handleLoadSamplePhotos = () => {
    const samples: SalonPhoto[] = CURATED_SAMPLE_PHOTOS.map((p, idx) => ({
      id: crypto.randomUUID(),
      url: p.url,
      title: p.title,
      caption: p.caption,
      category: p.category,
      display_order: idx,
      created_at: new Date().toISOString(),
    }));
    setSalonData((prev) => ({
      ...prev,
      photos: [...prev.photos, ...samples],
    }));
    toast.success(`${samples.length} fotos profissionais carregadas na galeria!`);
  };

  const handleRemovePhoto = (id: string) => {
    setSalonData((prev) => ({
      ...prev,
      photos: prev.photos.filter((p) => p.id !== id),
    }));
    toast.info("Foto removida da galeria");
  };

  const tenantSalonId = salonRecord?.id || "Auto-vinculado ao seu cadastro";

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner de Identificação & Multi-Tenancy */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-xl border bg-card p-5 shadow-xs">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">
              {salonData.name || "Configurações da Barbearia"}
            </h1>
            <Badge variant="outline" className="gap-1 border-primary/40 bg-primary/5 text-primary text-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Isolamento por salon_id ativo
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Plano: {salonRecord?.plan_name || "NEXADASH PRO"}
            </Badge>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground">
            Personalize a identidade visual, dados, equipe de barbeiros, catálogo de serviços e regras sem precisar alterar código.
          </p>
          <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground/80">
            <Building2 className="h-3.5 w-3.5" />
            <span>ID do Salão: <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{tenantSalonId}</code></span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setActiveTab("preview")}
          >
            <Eye className="h-4 w-4" />
            Ver Prévia da Barbearia
          </Button>
          <Button
            size="sm"
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saveSalonMutation.isPending}
            onClick={() => saveSalonMutation.mutate()}
          >
            <Save className="h-4 w-4" />
            {saveSalonMutation.isPending ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </div>

      {/* Navegação por Abas do Sistema */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1.5 p-1 sm:grid-cols-3 lg:grid-cols-6 bg-muted/60">
          <TabsTrigger value="perfil" className="gap-2 py-2 text-xs font-medium">
            <Palette className="h-3.5 w-3.5" />
            Identidade & Perfil
          </TabsTrigger>
          <TabsTrigger value="contatos" className="gap-2 py-2 text-xs font-medium">
            <MapPin className="h-3.5 w-3.5" />
            Local & Contatos
          </TabsTrigger>
          <TabsTrigger value="galeria" className="gap-2 py-2 text-xs font-medium">
            <ImageIcon className="h-3.5 w-3.5" />
            Galeria ({salonData.photos.length})
          </TabsTrigger>
          <TabsTrigger value="politicas" className="gap-2 py-2 text-xs font-medium">
            <Clock className="h-3.5 w-3.5" />
            Políticas & Horários
          </TabsTrigger>
          <TabsTrigger value="equipe" className="gap-2 py-2 text-xs font-medium">
            <Users className="h-3.5 w-3.5" />
            Equipe ({professionals.length})
          </TabsTrigger>
          <TabsTrigger value="servicos" className="gap-2 py-2 text-xs font-medium">
            <Scissors className="h-3.5 w-3.5" />
            Serviços ({services.length})
          </TabsTrigger>
        </TabsList>

        {/* 1. ABA IDENTIDADE & PERFIL */}
        <TabsContent value="perfil" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary" />
                  Perfil da Marca
                </CardTitle>
                <CardDescription>
                  Nome oficial, slogan e ativos visuais da barbearia.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="mb-1.5 block">Nome da Barbearia *</Label>
                  <Input
                    value={salonData.name}
                    placeholder="Ex: Dom Barbeiro Club, Barbearia Navalha de Ouro"
                    onChange={(e) => setSalonData({ ...salonData, name: e.target.value })}
                  />
                </div>

                <div>
                  <Label className="mb-1.5 block">Slogan / Frase de Apresentação</Label>
                  <Input
                    value={salonData.tagline}
                    placeholder="Ex: Tradição, precisão e cortes de alta performance"
                    onChange={(e) => setSalonData({ ...salonData, tagline: e.target.value })}
                  />
                </div>

                <div>
                  <Label className="mb-1.5 block">URL do Logotipo</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      value={salonData.logo_url}
                      placeholder="https://exemplo.com/logo.png"
                      onChange={(e) => setSalonData({ ...salonData, logo_url: e.target.value })}
                    />
                    {salonData.logo_url && (
                      <Avatar className="h-10 w-10 border rounded-lg shrink-0">
                        <AvatarImage src={salonData.logo_url} alt="Logo" />
                        <AvatarFallback>LOGO</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Insira o link da logo ou utilize um dos ícones padrão gerados para a barbearia.
                  </p>
                </div>

                <div>
                  <Label className="mb-1.5 block">URL da Imagem de Capa / Banner</Label>
                  <Input
                    value={salonData.banner_url}
                    placeholder="https://exemplo.com/banner-fachada.jpg"
                    onChange={(e) => setSalonData({ ...salonData, banner_url: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Cores & Paleta da Barbearia
                </CardTitle>
                <CardDescription>
                  Defina a identidade cromática aplicada no sistema e na página de agendamento.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="mb-2 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Paletas Sugeridas (1 Clique)
                  </Label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {COLOR_PALETTES.map((pal) => (
                      <button
                        key={pal.name}
                        type="button"
                        onClick={() =>
                          setSalonData({
                            ...salonData,
                            primary_color: pal.primary,
                            secondary_color: pal.secondary,
                          })
                        }
                        className={`flex items-center justify-between rounded-lg border p-2.5 text-left text-xs transition-all hover:border-primary ${
                          salonData.primary_color === pal.primary &&
                          salonData.secondary_color === pal.secondary
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "bg-card"
                        }`}
                      >
                        <span className="font-medium">{pal.name}</span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-4 w-4 rounded-full border border-black/20"
                            style={{ backgroundColor: pal.primary }}
                          />
                          <span
                            className="h-4 w-4 rounded-full border border-black/20"
                            style={{ backgroundColor: pal.secondary }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <Label className="mb-1.5 block">Cor Primária (Fundo/Headers)</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={salonData.primary_color || "#0F172A"}
                        onChange={(e) =>
                          setSalonData({ ...salonData, primary_color: e.target.value })
                        }
                        className="h-9 w-12 cursor-pointer rounded border p-0.5 bg-background"
                      />
                      <Input
                        value={salonData.primary_color}
                        onChange={(e) =>
                          setSalonData({ ...salonData, primary_color: e.target.value })
                        }
                        className="font-mono text-xs uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="mb-1.5 block">Cor Secundária (Destaques)</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={salonData.secondary_color || "#D4AF37"}
                        onChange={(e) =>
                          setSalonData({ ...salonData, secondary_color: e.target.value })
                        }
                        className="h-9 w-12 cursor-pointer rounded border p-0.5 bg-background"
                      />
                      <Input
                        value={salonData.secondary_color}
                        onChange={(e) =>
                          setSalonData({ ...salonData, secondary_color: e.target.value })
                        }
                        className="font-mono text-xs uppercase"
                      />
                    </div>
                  </div>
                </div>

                {/* Demonstração em Tempo Real da Combinação */}
                <div
                  className="mt-4 rounded-lg p-4 text-white shadow-md flex items-center justify-between"
                  style={{ backgroundColor: salonData.primary_color }}
                >
                  <div>
                    <p className="text-xs font-semibold opacity-80">Prévia da Identidade</p>
                    <p className="text-sm font-bold tracking-wide">
                      {salonData.name || "Sua Barbearia"}
                    </p>
                  </div>
                  <div
                    className="rounded-md px-3 py-1.5 text-xs font-bold shadow-sm"
                    style={{
                      backgroundColor: salonData.secondary_color,
                      color: "#000",
                    }}
                  >
                    Botão de Destaque
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 2. ABA LOCALIZAÇÃO & CONTATOS */}
        <TabsContent value="contatos" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Endereço & Localização
                </CardTitle>
                <CardDescription>
                  Informe os dados para que seus clientes encontrem o espaço facilmente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="mb-1.5 block">Logradouro e Número</Label>
                  <Input
                    value={salonData.address}
                    placeholder="Ex: Rua das Flores, 142 - Sala 02"
                    onChange={(e) => setSalonData({ ...salonData, address: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="mb-1.5 block">Bairro</Label>
                    <Input
                      value={salonData.neighborhood}
                      placeholder="Ex: Centro / Jardins"
                      onChange={(e) => setSalonData({ ...salonData, neighborhood: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">CEP</Label>
                    <Input
                      value={salonData.zip_code}
                      placeholder="00000-000"
                      onChange={(e) => setSalonData({ ...salonData, zip_code: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label className="mb-1.5 block">Cidade</Label>
                    <Input
                      value={salonData.city}
                      placeholder="Ex: São Paulo"
                      onChange={(e) => setSalonData({ ...salonData, city: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">UF</Label>
                    <Input
                      value={salonData.state}
                      placeholder="SP"
                      maxLength={2}
                      onChange={(e) => setSalonData({ ...salonData, state: e.target.value.toUpperCase() })}
                    />
                  </div>
                </div>

                <div>
                  <Label className="mb-1.5 block">Link do Google Maps / Waze</Label>
                  <Input
                    value={salonData.maps_link}
                    placeholder="https://maps.google.com/?q=..."
                    onChange={(e) => setSalonData({ ...salonData, maps_link: e.target.value })}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Este link é enviado automaticamente na confirmação de agendamento no WhatsApp.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  Contatos & Redes Sociais
                </CardTitle>
                <CardDescription>
                  Canais de atendimento, confirmação e redes sociais da empresa.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="mb-1.5 block">WhatsApp de Atendimento</Label>
                  <div className="flex gap-2">
                    <Input
                      value={salonData.whatsapp}
                      placeholder="(11) 99999-9999"
                      onChange={(e) => setSalonData({ ...salonData, whatsapp: e.target.value })}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Número utilizado para disparos automáticos e contato com clientes.
                  </p>
                </div>

                <div>
                  <Label className="mb-1.5 block">Telefone Comercial / Fixo</Label>
                  <Input
                    value={salonData.phone}
                    placeholder="(11) 3333-3333"
                    onChange={(e) => setSalonData({ ...salonData, phone: e.target.value })}
                  />
                </div>

                <div>
                  <Label className="mb-1.5 block">E-mail Comercial</Label>
                  <Input
                    type="email"
                    value={salonData.email}
                    placeholder="contato@barbearia.com.br"
                    onChange={(e) => setSalonData({ ...salonData, email: e.target.value })}
                  />
                </div>

                <div>
                  <Label className="mb-1.5 block">Instagram Oficial</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm font-semibold">@</span>
                    <Input
                      value={salonData.instagram?.replace(/^@/, "")}
                      placeholder="minhabarbearia"
                      onChange={(e) => setSalonData({ ...salonData, instagram: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label className="mb-1.5 block">Website Institucional</Label>
                  <Input
                    value={salonData.website}
                    placeholder="https://www.minhabarbearia.com.br"
                    onChange={(e) => setSalonData({ ...salonData, website: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 3. ABA GALERIA DE FOTOS DO ESPAÇO */}
        <TabsContent value="galeria" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-primary" />
                  Galeria de Fotos do Espaço
                </CardTitle>
                <CardDescription>
                  Exiba o ambiente, estações de corte, lounge e infraestrutura para encantar os clientes.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {salonData.photos.length === 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleLoadSamplePhotos}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    Carregar Fotos Modelo
                  </Button>
                )}
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setPhotoModalOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar Foto
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {salonData.photos.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <ImageIcon className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="font-semibold text-sm">Nenhuma foto cadastrada na galeria</p>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                    Cadastre fotos da fachada, das cadeiras de barbeiro, da área de espera e dos detalhes do espaço.
                  </p>
                  <div className="flex justify-center gap-2">
                    <Button size="sm" onClick={() => setPhotoModalOpen(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Foto
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleLoadSamplePhotos}>
                      <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-500" /> Usar Fotos Pré-configuradas
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {salonData.photos.map((photo, index) => (
                    <div
                      key={photo.id || index}
                      className="group relative overflow-hidden rounded-lg border bg-card shadow-xs transition-all hover:shadow-md"
                    >
                      <div className="aspect-4/3 w-full overflow-hidden bg-muted">
                        <img
                          src={photo.url}
                          alt={photo.title || "Foto da Barbearia"}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80";
                          }}
                        />
                      </div>
                      <div className="p-3">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-xs truncate">
                            {photo.title || "Ambiente"}
                          </span>
                          <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                            {photo.category}
                          </Badge>
                        </div>
                        {photo.caption && (
                          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                            {photo.caption}
                          </p>
                        )}
                        <div className="mt-3 flex items-center justify-between border-t pt-2">
                          <span className="text-[10px] text-muted-foreground font-mono">
                            #{index + 1}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemovePhoto(photo.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. ABA POLÍTICAS & AGENDAMENTO */}
        <TabsContent value="politicas" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Regras de Agendamento & Cancelamento
                </CardTitle>
                <CardDescription>
                  Defina os limites de tempo, regras de confirmação e políticas para os clientes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="mb-1.5 block">Regras Gerais de Agendamento</Label>
                  <Textarea
                    rows={3}
                    value={salonData.scheduling_rules}
                    placeholder="Ex: Cada agendamento reserva o profissional com exclusividade. Em caso de atraso superior a 15min, o horário poderá ser remarcado."
                    onChange={(e) => setSalonData({ ...salonData, scheduling_rules: e.target.value })}
                  />
                </div>

                <div>
                  <Label className="mb-1.5 block">Política de Cancelamento</Label>
                  <Textarea
                    rows={3}
                    value={salonData.cancellation_policy}
                    placeholder="Ex: Cancelamento gratuito até 2 horas antes do procedimento. Caso não compareça sem avisar, novas reservas dependerão de pagamento antecipado."
                    onChange={(e) => setSalonData({ ...salonData, cancellation_policy: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-1.5 block">Antecedência Mínima (minutos)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={5}
                      value={salonData.min_advance_minutes}
                      onChange={(e) =>
                        setSalonData({ ...salonData, min_advance_minutes: Number(e.target.value) })
                      }
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Tempo mínimo antes do corte para permitir agendamento online.
                    </p>
                  </div>

                  <div>
                    <Label className="mb-1.5 block">Antecedência Máxima (dias)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={90}
                      value={salonData.max_advance_days}
                      onChange={(e) =>
                        setSalonData({ ...salonData, max_advance_days: Number(e.target.value) })
                      }
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Janela aberta na agenda futura.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-1.5 block">Tolerância de Atraso (minutos)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={60}
                      value={salonData.late_tolerance_minutes}
                      onChange={(e) =>
                        setSalonData({ ...salonData, late_tolerance_minutes: Number(e.target.value) })
                      }
                    />
                  </div>

                  <div>
                    <Label className="mb-1.5 block">Lembrete Automático (horas antes)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={72}
                      value={salonData.reminder_hours}
                      onChange={(e) =>
                        setSalonData({ ...salonData, reminder_hours: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Horário Semanal de Funcionamento
                </CardTitle>
                <CardDescription>
                  Configure a abertura e fechamento para cada dia da semana.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(Object.keys(DAY_LABELS) as (keyof BusinessHoursWeek)[]).map((dayKey) => {
                  const day = salonData.business_hours?.[dayKey] || DEFAULT_BUSINESS_HOURS[dayKey];
                  return (
                    <div
                      key={dayKey}
                      className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-xs bg-card"
                    >
                      <div className="flex items-center gap-2 w-32 shrink-0">
                        <Switch
                          checked={!day.closed}
                          onCheckedChange={(checked) => {
                            setSalonData({
                              ...salonData,
                              business_hours: {
                                ...salonData.business_hours,
                                [dayKey]: { ...day, closed: !checked },
                              },
                            });
                          }}
                        />
                        <span className={`font-medium ${day.closed ? "text-muted-foreground line-through" : ""}`}>
                          {DAY_LABELS[dayKey]}
                        </span>
                      </div>

                      {day.closed ? (
                        <span className="text-muted-foreground font-semibold">Fechado</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="time"
                            value={day.open}
                            onChange={(e) => {
                              setSalonData({
                                ...salonData,
                                business_hours: {
                                  ...salonData.business_hours,
                                  [dayKey]: { ...day, open: e.target.value },
                                },
                              });
                            }}
                            className="h-8 w-24 text-xs font-mono"
                          />
                          <span className="text-muted-foreground">às</span>
                          <Input
                            type="time"
                            value={day.close}
                            onChange={(e) => {
                              setSalonData({
                                ...salonData,
                                business_hours: {
                                  ...salonData.business_hours,
                                  [dayKey]: { ...day, close: e.target.value },
                                },
                              });
                            }}
                            className="h-8 w-24 text-xs font-mono"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 5. ABA EQUIPE & BARBEIROS */}
        <TabsContent value="equipe" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Profissionais & Barbeiros da Barbearia
                </CardTitle>
                <CardDescription>
                  Equipe vinculada estritamente à sua barbearia (salon_id). Cadastre fotos, especialidades e escalas.
                </CardDescription>
              </div>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setEditingPro({
                    name: "",
                    role: "Barbeiro Master",
                    phone: "",
                    active: true,
                    photo_url: "",
                    bio: "",
                    specialties: ["Corte Degradê / Fade", "Barboterapia c/ Toalha Quente"],
                    working_hours: "Terça a Sábado, 09h às 19h",
                    instagram: "",
                  });
                  setProModalOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Novo Barbeiro
              </Button>
            </CardHeader>
            <CardContent>
              {professionals.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <Users className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="font-semibold text-sm">Nenhum profissional cadastrado na equipe</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    Adicione seus barbeiros para habilitar agendamentos e comissões automáticas.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingPro({
                        name: "",
                        role: "Barbeiro Master",
                        phone: "",
                        active: true,
                        specialties: ["Corte Degradê / Fade"],
                        working_hours: "Segunda a Sábado, 09h às 19h",
                      });
                      setProModalOpen(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Primeiro Barbeiro
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {professionals.map((pro) => (
                    <div
                      key={pro.id}
                      className="flex flex-col justify-between rounded-xl border bg-card p-4 shadow-xs transition-all hover:border-primary/50"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12 border">
                              <AvatarImage src={pro.photo_url || ""} />
                              <AvatarFallback className="font-bold bg-primary/10 text-primary">
                                {pro.name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h4 className="font-bold text-sm leading-snug">{pro.name}</h4>
                              <p className="text-xs text-muted-foreground font-medium">
                                {pro.role || "Barbeiro"}
                              </p>
                            </div>
                          </div>
                          <Badge variant={pro.active ? "default" : "secondary"} className="text-[10px]">
                            {pro.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>

                        {pro.phone && (
                          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5" /> {pro.phone}
                          </p>
                        )}

                        {pro.working_hours && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" /> {pro.working_hours}
                          </p>
                        )}

                        {/* Especialidades */}
                        {pro.specialties && pro.specialties.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {pro.specialties.map((spec) => (
                              <span
                                key={spec}
                                className="rounded bg-secondary/30 px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground"
                              >
                                {spec}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex items-center justify-end gap-1 border-t pt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 text-xs"
                          onClick={() => {
                            setEditingPro(pro);
                            setProModalOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 text-xs text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm(`Deseja realmente remover o profissional ${pro.name}?`)) {
                              deleteProfessionalMutation.mutate(pro.id!);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 6. ABA CATÁLOGO DE SERVIÇOS */}
        <TabsContent value="servicos" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Scissors className="h-4 w-4 text-primary" />
                  Catálogo de Serviços da Barbearia
                </CardTitle>
                <CardDescription>
                  Serviços ofertados aos clientes, com preço, tempo de cadeira e comissão da equipe.
                </CardDescription>
              </div>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setEditingService({
                    name: "",
                    category: "cabelo",
                    price: 45,
                    duration_min: 45,
                    commission_pct: 50,
                    active: true,
                    description: "Corte completo com lavagem, alinhamento e finalização com pomada modeladora.",
                    highlight: false,
                  });
                  setServiceModalOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Novo Serviço
              </Button>
            </CardHeader>
            <CardContent>
              {services.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <Scissors className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="font-semibold text-sm">Nenhum serviço cadastrado no catálogo</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    Adicione cortes, barboterapia, combos e outros serviços para começar a agendar.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingService({
                        name: "Corte Tradicional",
                        category: "cabelo",
                        price: 45,
                        duration_min: 40,
                        commission_pct: 50,
                        active: true,
                      });
                      setServiceModalOpen(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Primeiro Serviço
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {services.map((srv) => (
                    <div
                      key={srv.id}
                      className={`flex flex-col justify-between rounded-xl border bg-card p-4 shadow-xs transition-all ${
                        srv.highlight ? "border-amber-500/50 bg-amber-500/5" : "hover:border-primary/50"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-bold text-sm leading-snug">{srv.name}</h4>
                              {srv.highlight && (
                                <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground font-medium uppercase">
                              {SERVICE_CATEGORIES.find((c) => c.value === srv.category)?.label || srv.category}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-sm text-foreground">
                              {brl(srv.price)}
                            </span>
                            <p className="text-[10px] text-muted-foreground">
                              {srv.duration_min} min
                            </p>
                          </div>
                        </div>

                        {srv.description && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                            {srv.description}
                          </p>
                        )}

                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
                          <span>Comissão: <strong className="text-foreground">{srv.commission_pct}%</strong></span>
                          <Badge variant={srv.active ? "outline" : "secondary"} className="text-[10px]">
                            {srv.active ? "Disponível" : "Pausado"}
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-end gap-1 border-t pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 text-xs"
                          onClick={() => {
                            setEditingService(srv);
                            setServiceModalOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 text-xs text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm(`Deseja realmente remover o serviço ${srv.name}?`)) {
                              deleteServiceMutation.mutate(srv.id!);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 7. ABA LIVE PREVIEW DA BARBEARIA */}
        <TabsContent value="preview" className="space-y-6">
          <Card className="overflow-hidden border-2 shadow-lg">
            {/* Top Bar do Simulador */}
            <div className="flex items-center justify-between border-b bg-muted/60 px-4 py-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                  https://belezi.app/{salonData.name ? salonData.name.toLowerCase().replace(/[^a-z0-9]/g, "-") : "minha-barbearia"}
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] uppercase font-bold">
                Vitrine Pública & Agendamento
              </Badge>
            </div>

            {/* Cabeçalho da Barbearia com as Cores Escolhidas */}
            <div
              className="p-6 text-white transition-colors duration-300 relative overflow-hidden"
              style={{ backgroundColor: salonData.primary_color || "#0F172A" }}
            >
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {salonData.logo_url ? (
                    <img
                      src={salonData.logo_url}
                      alt="Logo"
                      className="h-16 w-16 rounded-xl border-2 border-white/20 object-cover shadow-md"
                    />
                  ) : (
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-xl font-bold text-xl shadow-md"
                      style={{
                        backgroundColor: salonData.secondary_color || "#D4AF37",
                        color: "#000",
                      }}
                    >
                      {(salonData.name || "B").slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div>
                    <h2 className="text-2xl font-black tracking-tight">
                      {salonData.name || "Nome da Sua Barbearia"}
                    </h2>
                    <p className="text-xs text-white/80 max-w-md">
                      {salonData.tagline || "Tradição em corte masculino e barboterapia"}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-white/70">
                      {salonData.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {salonData.address}
                        </span>
                      )}
                      {salonData.whatsapp && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {salonData.whatsapp}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className="rounded-lg px-4 py-2 font-bold text-xs shadow-md uppercase tracking-wider"
                    style={{
                      backgroundColor: salonData.secondary_color || "#D4AF37",
                      color: "#000",
                    }}
                  >
                    Agendar Horário Online
                  </div>
                </div>
              </div>
            </div>

            {/* Conteúdo da Vitrine Simulada */}
            <div className="p-6 space-y-8 bg-background">
              {/* Fotos do Espaço */}
              {salonData.photos.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" /> Conheça Nosso Espaço
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {salonData.photos.slice(0, 4).map((p, i) => (
                      <div key={i} className="aspect-4/3 rounded-lg overflow-hidden border bg-muted">
                        <img src={p.url} alt={p.title} className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Equipe de Barbeiros */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" /> Nossa Equipe de Especialistas
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {professionals.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum barbeiro cadastrado.</p>
                  ) : (
                    professionals.map((pro) => (
                      <div key={pro.id} className="flex items-center gap-3 rounded-lg border p-3 bg-card">
                        <Avatar className="h-10 w-10 border">
                          <AvatarImage src={pro.photo_url || ""} />
                          <AvatarFallback className="text-xs font-bold">
                            {pro.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-bold text-xs">{pro.name}</p>
                          <p className="text-[11px] text-muted-foreground">{pro.role}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Catálogo de Serviços */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <Scissors className="h-4 w-4" /> Tabela de Serviços & Valores
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {services.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum serviço cadastrado.</p>
                  ) : (
                    services.map((srv) => (
                      <div
                        key={srv.id}
                        className="flex items-center justify-between rounded-lg border p-3 bg-card"
                      >
                        <div>
                          <p className="font-bold text-xs flex items-center gap-1.5">
                            {srv.name}
                            {srv.highlight && (
                              <Badge variant="outline" className="text-[9px] text-amber-500 border-amber-500/40">
                                Mais Pedido
                              </Badge>
                            )}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{srv.duration_min} minutos</p>
                        </div>
                        <span className="font-bold text-sm">{brl(srv.price)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Políticas da Casa */}
              <div className="rounded-lg border bg-muted/40 p-4 text-xs space-y-2">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Políticas de Agendamento
                </p>
                <p className="text-muted-foreground">{salonData.scheduling_rules}</p>
                <p className="text-muted-foreground">{salonData.cancellation_policy}</p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL DE ADICIONAR FOTO À GALERIA */}
      <Dialog open={photoModalOpen} onOpenChange={setPhotoModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Foto à Galeria</DialogTitle>
            <DialogDescription>
              Informe o link da foto do espaço ou escolha uma foto modelo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-1.5 block">Título / Ambiente *</Label>
              <Input
                value={newPhoto.title || ""}
                placeholder="Ex: Lounge Principal, Cadeira de Barbeiro"
                onChange={(e) => setNewPhoto({ ...newPhoto, title: e.target.value })}
              />
            </div>

            <div>
              <Label className="mb-1.5 block">Categoria</Label>
              <Select
                value={newPhoto.category || "ambiente"}
                onValueChange={(val: any) => setNewPhoto({ ...newPhoto, category: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ambiente">Ambiente Geral</SelectItem>
                  <SelectItem value="fachada">Fachada</SelectItem>
                  <SelectItem value="lounge">Lounge & Recepção</SelectItem>
                  <SelectItem value="estacoes">Estações de Corte</SelectItem>
                  <SelectItem value="detalhes">Detalhes & Produtos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block">URL da Foto *</Label>
              <Input
                value={newPhoto.url || ""}
                placeholder="https://images.unsplash.com/..."
                onChange={(e) => setNewPhoto({ ...newPhoto, url: e.target.value })}
              />
            </div>

            <div>
              <Label className="mb-1.5 block">Legenda Curta</Label>
              <Input
                value={newPhoto.caption || ""}
                placeholder="Ex: Poltronas ergonômicas e iluminação quente"
                onChange={(e) => setNewPhoto({ ...newPhoto, caption: e.target.value })}
              />
            </div>

            {newPhoto.url && (
              <div className="aspect-16/9 w-full rounded-lg overflow-hidden border bg-muted">
                <img
                  src={newPhoto.url}
                  alt="Preview"
                  className="h-full w-full object-cover"
                  onError={() => toast.error("Não foi possível carregar a imagem da URL fornecida")}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPhotoModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddPhoto}>Adicionar Foto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CADASTRO/EDIÇÃO DE PROFISSIONAL */}
      <Dialog open={proModalOpen} onOpenChange={setProModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPro?.id ? "Editar Profissional / Barbeiro" : "Novo Profissional / Barbeiro"}
            </DialogTitle>
            <DialogDescription>
              Dados da equipe da sua barbearia com isolamento garantido por salon_id.
            </DialogDescription>
          </DialogHeader>

          {editingPro && (
            <div className="space-y-4 py-2">
              <div>
                <Label className="mb-1.5 block">Nome Completo *</Label>
                <Input
                  value={editingPro.name}
                  placeholder="Ex: Carlos Eduardo 'Navalha'"
                  onChange={(e) => setEditingPro({ ...editingPro, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 block">Função / Título</Label>
                  <Input
                    value={editingPro.role}
                    placeholder="Ex: Barbeiro Master, Cabeleireiro"
                    onChange={(e) => setEditingPro({ ...editingPro, role: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block">Telefone / WhatsApp</Label>
                  <Input
                    value={editingPro.phone}
                    placeholder="(11) 98888-7777"
                    onChange={(e) => setEditingPro({ ...editingPro, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label className="mb-1.5 block">URL da Foto do Barbeiro</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    value={editingPro.photo_url || ""}
                    placeholder="https://exemplo.com/foto-barbeiro.jpg"
                    onChange={(e) => setEditingPro({ ...editingPro, photo_url: e.target.value })}
                  />
                  {editingPro.photo_url && (
                    <Avatar className="h-10 w-10 border shrink-0">
                      <AvatarImage src={editingPro.photo_url} />
                      <AvatarFallback>FOTO</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              </div>

              <div>
                <Label className="mb-1.5 block">Horários de Atendimento / Escala</Label>
                <Input
                  value={editingPro.working_hours || ""}
                  placeholder="Ex: Terça a Sábado: 09h às 19h (Almoço: 12h-13h)"
                  onChange={(e) => setEditingPro({ ...editingPro, working_hours: e.target.value })}
                />
              </div>

              <div>
                <Label className="mb-2 block text-xs font-semibold">Especialidades do Barbeiro</Label>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto rounded-lg border p-2">
                  {AVAILABLE_SPECIALTIES.map((spec) => {
                    const isSelected = editingPro.specialties?.includes(spec);
                    return (
                      <button
                        key={spec}
                        type="button"
                        onClick={() => {
                          const current = editingPro.specialties || [];
                          const updated = isSelected
                            ? current.filter((s) => s !== spec)
                            : [...current, spec];
                          setEditingPro({ ...editingPro, specialties: updated });
                        }}
                        className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                          isSelected
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {spec}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-semibold text-xs">Profissional Ativo na Agenda</p>
                  <p className="text-[11px] text-muted-foreground">
                    Quando ativo, fica disponível para seleção em novos agendamentos e comandas.
                  </p>
                </div>
                <Switch
                  checked={editingPro.active}
                  onCheckedChange={(checked) => setEditingPro({ ...editingPro, active: checked })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setProModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={saveProfessionalMutation.isPending || !editingPro?.name}
              onClick={() => {
                if (!editingPro?.name) {
                  toast.error("Informe o nome do profissional");
                  return;
                }
                saveProfessionalMutation.mutate(editingPro);
              }}
            >
              {saveProfessionalMutation.isPending ? "Salvando..." : "Salvar Barbeiro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CADASTRO/EDIÇÃO DE SERVIÇO */}
      <Dialog open={serviceModalOpen} onOpenChange={setServiceModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingService?.id ? "Editar Serviço" : "Novo Serviço do Catálogo"}
            </DialogTitle>
            <DialogDescription>
              Configuração do serviço com preço, duração e comissão isolados por salon_id.
            </DialogDescription>
          </DialogHeader>

          {editingService && (
            <div className="space-y-4 py-2">
              <div>
                <Label className="mb-1.5 block">Nome do Serviço *</Label>
                <Input
                  value={editingService.name}
                  placeholder="Ex: Corte Degradê Navalhado + Barboterapia"
                  onChange={(e) => setEditingService({ ...editingService, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 block">Categoria</Label>
                  <Select
                    value={editingService.category}
                    onValueChange={(val) => setEditingService({ ...editingService, category: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="mb-1.5 block">Preço (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingService.price}
                    onChange={(e) =>
                      setEditingService({ ...editingService, price: Number(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 block">Duração (Minutos) *</Label>
                  <Input
                    type="number"
                    step="5"
                    min="5"
                    value={editingService.duration_min}
                    onChange={(e) =>
                      setEditingService({ ...editingService, duration_min: Number(e.target.value) })
                    }
                  />
                </div>

                <div>
                  <Label className="mb-1.5 block">Comissão do Barbeiro (%)</Label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={editingService.commission_pct}
                    onChange={(e) =>
                      setEditingService({ ...editingService, commission_pct: Number(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div>
                <Label className="mb-1.5 block">Descrição Detalhada do Procedimento</Label>
                <Textarea
                  rows={3}
                  value={editingService.description || ""}
                  placeholder="Descreva o que está incluso no procedimento, produtos utilizados, etc."
                  onChange={(e) => setEditingService({ ...editingService, description: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-semibold text-xs">Destacar no Catálogo (Mais Pedido)</p>
                  <p className="text-[11px] text-muted-foreground">
                    Exibe selo de destaque nas opções mais populares da barbearia.
                  </p>
                </div>
                <Switch
                  checked={editingService.highlight || false}
                  onCheckedChange={(checked) =>
                    setEditingService({ ...editingService, highlight: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-semibold text-xs">Serviço Ativo</p>
                  <p className="text-[11px] text-muted-foreground">
                    Disponível para seleção em agendamentos e comandas.
                  </p>
                </div>
                <Switch
                  checked={editingService.active}
                  onCheckedChange={(checked) =>
                    setEditingService({ ...editingService, active: checked })
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setServiceModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={saveServiceMutation.isPending || !editingService?.name}
              onClick={() => {
                if (!editingService?.name) {
                  toast.error("Informe o nome do serviço");
                  return;
                }
                saveServiceMutation.mutate(editingService);
              }}
            >
              {saveServiceMutation.isPending ? "Salvando..." : "Salvar Serviço"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
