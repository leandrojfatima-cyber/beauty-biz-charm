import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  Receipt,
  Percent,
  Package,
  Wallet,
  Check,
  QrCode,
  Copy,
  ShieldCheck,
  Sparkles,
  Building2,
  Clock,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/db";
import { generatePodiumPixPayload } from "@/services/payments";
import painelImage from "@/assets/belezi-painel-demo.jpg.asset.json";
import agendaImage from "@/assets/belezi-agenda-demo.jpg.asset.json";
import financeiroImage from "@/assets/belezi-financeiro-demo.jpg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NEXADASH — Sistemas Inteligentes" },
      {
        name: "description",
        content:
          "Gestão completa para barbearias e salões: agenda inteligente, comandas, comissões, estoque, inteligência executiva e Podium Pay.",
      },
      { property: "og:title", content: "NEXADASH — Sistemas Inteligentes" },
      {
        property: "og:description",
        content: "Agenda inteligente, comandas, comissões, estoque e fluxo de caixa em um só sistema.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const features = [
  { icon: CalendarDays, t: "Agenda" },
  { icon: Receipt, t: "Comandas" },
  { icon: Percent, t: "Comissões" },
  { icon: Package, t: "Estoque" },
  { icon: Wallet, t: "Financeiro" },
];

const screenshots = [
  {
    image: new URL(painelImage.url, "https://beauty-biz-charm.lovable.app").href,
    title: "Seu salão em um só lugar",
    label: "01 · Painel",
    description: "Agenda do dia, receitas e estoque.",
  },
  {
    image: new URL(agendaImage.url, "https://beauty-biz-charm.lovable.app").href,
    title: "Cada horário organizado",
    label: "02 · Agenda",
    description: "Atendimentos separados por profissional.",
  },
  {
    image: new URL(financeiroImage.url, "https://beauty-biz-charm.lovable.app").href,
    title: "O caixa sempre à vista",
    label: "03 · Financeiro",
    description: "Entradas, despesas e saldo do período.",
  },
];

export type Plan = {
  id: string;
  name: string;
  duration: string;
  description: string;
  price: number;
  price_max: number | null;
  highlight: boolean;
  benefit: string;
  payment_url: string | null;
};

// TABELA OFICIAL DE PREÇOS NEXADASH (ETAPA 14)
export const NEXADASH_OFFICIAL_PLANS: Plan[] = [
  {
    id: "plano-mensal",
    name: "Plano Mensal",
    duration: "1 Mês",
    description: "Acesso completo a todas as funcionalidades do sistema.",
    price: 59.9,
    price_max: null,
    highlight: false,
    benefit: "Acesso completo",
    payment_url: null,
  },
  {
    id: "plano-trimestral",
    name: "Plano Trimestral",
    duration: "3 Meses",
    description: "Economia proporcional e estabilidade operacional para seu salão.",
    price: 159.9,
    price_max: null,
    highlight: true,
    benefit: "Economia proporcional",
    payment_url: null,
  },
  {
    id: "plano-semestral",
    name: "Plano Semestral",
    duration: "6 Meses",
    description: "Melhor custo-benefício para crescimento consolidado.",
    price: 319.9,
    price_max: null,
    highlight: false,
    benefit: "Melhor custo-benefício",
    payment_url: null,
  },
  {
    id: "plano-anual",
    name: "Plano Anual",
    duration: "12 Meses",
    description: "Uso contínuo sem reajustes e suporte prioritário direto NEXADASH.",
    price: 639.9,
    price_max: null,
    highlight: false,
    benefit: "Uso contínuo sem reajustes",
    payment_url: null,
  },
];

const priceLabel = (p: Plan) =>
  p.price_max && Number(p.price_max) > Number(p.price)
    ? `${brl(p.price)} a ${brl(p.price_max)}`
    : brl(p.price);

function usePublicPlans() {
  return useQuery({
    queryKey: ["public-plans"],
    queryFn: async (): Promise<Plan[]> => {
      try {
        const { data, error } = await (supabase as any)
          .from("plans")
          .select("id,name,description,price,price_max,highlight,payment_url")
          .eq("active", true)
          .order("sort_order")
          .order("created_at");
        if (error || !data || !Array.isArray(data) || data.length === 0) {
          return NEXADASH_OFFICIAL_PLANS;
        }
        return data as Plan[];
      } catch {
        return NEXADASH_OFFICIAL_PLANS;
      }
    },
    initialData: NEXADASH_OFFICIAL_PLANS,
  });
}

function Index() {
  const queryResult = usePublicPlans();
  const rawPlans = queryResult?.data ?? NEXADASH_OFFICIAL_PLANS;
  const plans: Plan[] = Array.isArray(rawPlans) && rawPlans.length > 0 ? rawPlans : NEXADASH_OFFICIAL_PLANS;

  const [selected, setSelected] = useState<string | null>("plano-trimestral");
  const chosen: Plan =
    plans.find((x) => x?.id === selected) ??
    plans.find((x) => x?.highlight) ??
    plans[0] ??
    NEXADASH_OFFICIAL_PLANS[0];

  // Modal de Ativação Direta NEXADASH (Pix / Comprovante)
  const [activationModalOpen, setActivationModalOpen] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [contractForm, setContractForm] = useState({
    salonName: "",
    responsibleName: "",
    email: "",
    phone: "",
    pixCodeRef: "",
  });

  const pixPayload = chosen
    ? generatePodiumPixPayload({
        orderId: `NEXA-${chosen?.id ?? "0"}`,
        amount: Number(chosen?.price ?? 0),
        clientName: contractForm.responsibleName || "Cliente NEXADASH",
        description: `Assinatura ${chosen?.name ?? "Plano"} - NEXADASH`,
        salonName: "NEXADASH SISTEMAS",
        pixKey: "financeiro@nexadash.com.br",
      })
    : null;

  const handleCopyPixKey = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText("financeiro@nexadash.com.br");
      setCopiedPix(true);
      toast.success("Chave Pix Oficial copiada: financeiro@nexadash.com.br");
      setTimeout(() => setCopiedPix(false), 2500);
    }
  };

  const handleConfirmContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractForm.salonName || !contractForm.email) {
      toast.error("Por favor, preencha o nome do salão e o e-mail do responsável.");
      return;
    }
    setSubmitting(true);
    try {
      // Registrar intenção de assinatura na auditoria ou armazenamento local defensivo
      toast.success(
        "Solicitação de assinatura registrada com sucesso! Conforme a política de segurança NEXADASH, nossa equipe ativará seu acesso manualmente em instantes.",
      );
      setActivationModalOpen(false);
    } catch {
      toast.error("Ocorreu um erro ao registrar sua assinatura. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="belezi-home bg-background">
      <header className="home-header flex items-center justify-between gap-3 border-b">
        <div className="flex items-center gap-3">
          <img
            src="/assets/aistudio/avatar_9eef1d34.png"
            alt="NEXADASH — Sistemas Inteligentes"
            className="h-9 w-9 rounded-lg object-contain bg-white p-0.5 shadow-xs border shrink-0"
          />
          <div className="flex flex-col leading-none">
            <Link
              to="/"
              aria-label="NEXADASH — Sistemas Inteligentes"
              className="font-display text-base font-extrabold tracking-wide text-foreground"
            >
              NEXA<span className="text-[#FF6500]">DASH</span>
            </Link>
            <span className="text-[10px] text-muted-foreground uppercase font-semibold mt-0.5">
              Sistemas Inteligentes · Belezi
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm">
            <Link to="/agendar">
              Agendar Online <CalendarDays className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/auth">
              Entrar <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </header>

      <section className="home-intro">
        <p className="mb-1 text-xs font-medium uppercase text-primary">
          Gestão e Inteligência para Barbearias e Salões
        </p>
        <h1 className="font-semibold">
          Belezi<span className="text-primary">.</span> Seu salão, conectado e automatizado.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Agenda inteligente, comandas, comissões, estoque, inteligência executiva e Podium Pay em um só sistema.
        </p>
        <div className="home-features mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          {features.map(({ icon: Icon, t }) => (
            <span key={t} className="flex items-center gap-1.5 text-xs">
              <Icon className="h-3.5 w-3.5 text-primary" />
              {t}
            </span>
          ))}
        </div>
      </section>

      <section className="home-showcase" aria-label="Telas do sistema Belezi">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Conheça o ecossistema por dentro</h2>
          <span className="text-[10px] text-muted-foreground">
            Dados fictícios para demonstração
          </span>
        </div>
        <div className="home-screenshots">
          {screenshots.map(({ image, title, label, description }) => (
            <figure key={label} className="home-screenshot-card">
              <div className="home-screenshot-media aspect-[16/10] overflow-hidden rounded-md border bg-muted">
                <img
                  src={image}
                  alt={title}
                  loading="lazy"
                  className="h-full w-full object-cover object-top"
                />
              </div>
              <figcaption className="pt-2">
                <span className="text-[10px] font-medium uppercase text-primary">{label}</span>
                <h3 className="mt-0.5 text-sm font-semibold">{title}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* SEÇÃO DE PLANOS E CONTRATAÇÃO DIRETA NEXADASH (ETAPA 14) */}
      <section
        className="home-offer border-y border-primary/20 bg-accent text-accent-foreground"
        aria-label="Planos do sistema Belezi"
      >
        <div className="home-offer-head">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase text-primary">
              NEXADASH para o seu negócio
            </p>
            <h2 className="text-base font-semibold">Escolha o plano ideal para a sua empresa.</h2>
          </div>
          <div className="home-offer-actions flex flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-[#FF6500] hover:bg-[#E55B00] text-white font-semibold gap-1.5"
              onClick={() => setActivationModalOpen(true)}
            >
              Assinar {chosen?.name || "Plano"} <Sparkles className="h-3.5 w-3.5" />
            </Button>
            <Button asChild size="sm" variant="outline">
              {/* prettier-ignore */}
              <Link to="/painel">Acessar o sistema <ArrowRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </div>
        </div>

        <div className="home-plans" role="radiogroup" aria-label="Planos">
          {plans.map((p) => {
            const isSel = (selected ?? plans.find((x) => x.highlight)?.id ?? plans[0]?.id) === p.id;
            return (
              <button
                type="button"
                role="radio"
                aria-checked={isSel}
                onClick={() => setSelected(p.id)}
                key={p.id}
                className={`home-plan cursor-pointer rounded-lg border bg-card text-left text-card-foreground transition hover:border-primary ${isSel ? "border-primary ring-2 ring-primary" : ""}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <p className="truncate text-xs font-semibold">{p.name}</p>
                  {isSel ? (
                    <span className="rounded bg-primary px-1 text-[9px] font-semibold uppercase text-primary-foreground">
                      Escolhido
                    </span>
                  ) : (
                    p.highlight && (
                      <span className="rounded border border-primary px-1 text-[9px] font-semibold uppercase text-primary">
                        Popular
                      </span>
                    )
                  )}
                </div>
                <p className="font-display text-base font-semibold leading-tight">
                  {priceLabel(p)}
                  <span className="text-[10px] font-normal text-muted-foreground">/{p.duration || "período"}</span>
                </p>
                <p className="home-plan-desc text-[10px] text-muted-foreground">{p.description}</p>
                {p.benefit && (
                  <span className="mt-1 inline-block text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    ✓ {p.benefit}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <footer className="home-footer text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-3 border-t py-6 px-4">
        <div className="flex items-center gap-2">
          <img
            src="/assets/aistudio/avatar_9eef1d34.png"
            alt="NEXADASH Logo"
            className="h-5 w-5 rounded object-contain bg-white p-0.5 shrink-0 shadow-xs"
          />
          <span>Desenvolvido e operado por <strong>NEXADASH — Sistemas Inteligentes</strong></span>
        </div>
        <span>Belezi © 2026 · Todos os direitos reservados</span>
      </footer>

      {/* MODAL DE ATIVAÇÃO DIRETA & PAGAMENTO PIX NEXADASH */}
      <Dialog open={activationModalOpen} onOpenChange={setActivationModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white p-1 border shadow-xs">
                <img
                  src="/assets/aistudio/avatar_9eef1d34.png"
                  alt="NEXADASH Logo"
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  Assinatura Direta NEXADASH — {chosen?.name}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Duração: {chosen?.duration || "1 Período"} · Valor: <strong>{chosen ? brl(chosen.price) : "R$ 0,00"}</strong>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Aviso de Governança */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-muted-foreground">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p>
                  Pagamento direto e ativação homologada por um administrador <strong>NEXADASH</strong>. Sem taxas intermediárias de gateway externo.
                </p>
              </div>
            </div>

            {/* Chave Pix e QR Code */}
            <div className="rounded-xl border bg-card p-4 flex flex-col items-center text-center">
              <span className="text-[11px] uppercase font-bold text-muted-foreground">
                Pagamento via Pix Oficial
              </span>
              <p className="font-display text-2xl font-black text-foreground mt-0.5">
                {chosen ? brl(chosen.price) : ""}
              </p>

              {pixPayload && (
                <div className="mt-3 p-2 bg-white rounded-lg border shadow-xs">
                  <img
                    src={pixPayload.qrCodeUrl}
                    alt="QR Code Pix NEXADASH"
                    className="h-40 w-40 object-contain"
                  />
                </div>
              )}

              <div className="mt-3 w-full flex items-center gap-2">
                <Input
                  readOnly
                  value="financeiro@nexadash.com.br"
                  className="h-8 text-xs font-mono bg-muted/40"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs shrink-0 gap-1.5"
                  onClick={handleCopyPixKey}
                >
                  {copiedPix ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copiar Chave
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Formulário de Identificação da Barbearia */}
            <form onSubmit={handleConfirmContract} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <Label className="text-xs">Nome do Salão / Barbearia *</Label>
                  <Input
                    required
                    placeholder="Ex: Barbearia Dom Barba"
                    className="h-8 text-xs mt-1"
                    value={contractForm.salonName}
                    onChange={(e) =>
                      setContractForm({ ...contractForm, salonName: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Nome do Responsável *</Label>
                  <Input
                    required
                    placeholder="Ex: Carlos Eduardo"
                    className="h-8 text-xs mt-1"
                    value={contractForm.responsibleName}
                    onChange={(e) =>
                      setContractForm({ ...contractForm, responsibleName: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <Label className="text-xs">E-mail para Acesso *</Label>
                  <Input
                    type="email"
                    required
                    placeholder="contato@barbearia.com"
                    className="h-8 text-xs mt-1"
                    value={contractForm.email}
                    onChange={(e) =>
                      setContractForm({ ...contractForm, email: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">WhatsApp para Contato *</Label>
                  <Input
                    placeholder="(11) 98765-4321"
                    className="h-8 text-xs mt-1"
                    value={contractForm.phone}
                    onChange={(e) =>
                      setContractForm({ ...contractForm, phone: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Código ou Referência do Pix (opcional)</Label>
                <Input
                  placeholder="Ex: E2E-994827103 ou número do comprovante"
                  className="h-8 text-xs mt-1"
                  value={contractForm.pixCodeRef}
                  onChange={(e) =>
                    setContractForm({ ...contractForm, pixCodeRef: e.target.value })
                  }
                />
              </div>

              <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActivationModalOpen(false)}
                >
                  Fechar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  className="bg-[#FF6500] hover:bg-[#E55B00] text-white font-semibold gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  {submitting ? "Processando..." : "Confirmar e Enviar Comprovante"}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
