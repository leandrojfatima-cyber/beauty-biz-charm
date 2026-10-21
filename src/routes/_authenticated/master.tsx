import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Users,
  TrendingUp,
  Receipt,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
  Send,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  MessageSquare,
  FileText,
  Headphones,
  DollarSign,
  Briefcase,
  ArrowRight,
  CreditCard,
  Calendar,
  AlertCircle,
  Check,
  XCircle,
  RefreshCw,
  Ban,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brl, db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { ActivationCycleHub } from "@/components/nexadash/ActivationCycleHub";

export const Route = createFileRoute("/_authenticated/master")({
  head: () => ({
    meta: [
      { title: "NEXADASH Commercial Command Center — Assinaturas & Vendas" },
      {
        name: "description",
        content: "Painel exclusivo da NEXADASH para controle de assinaturas, cobranças, recebimentos e CRM do BELEZI.",
      },
    ],
  }),
  component: NexadashCommercialHub,
});

// Seed data para inicialização e modo offline/preview
const INITIAL_LEADS = [
  {
    id: "lead-1",
    name: "Carlos Eduardo Souza",
    company_name: "Barbearia Dom Barba",
    phone: "11987654321",
    email: "carlos@dombarba.com.br",
    city: "São Paulo - SP",
    stage: "proposta",
    plan_interest: "NEXADASH PRO",
    notes: "Possui 4 barbeiros, quer comissões automatizadas e fluxo de caixa.",
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "lead-2",
    name: "Mariana Alencar",
    company_name: "Espaço Bella & Charm",
    phone: "21998877665",
    email: "mariana@bellacharm.com",
    city: "Rio de Janeiro - RJ",
    stage: "demo",
    plan_interest: "NEXADASH IA",
    notes: "Pediu demonstração sobre relatórios de faturamento e agendamento WhatsApp.",
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: "lead-3",
    name: "Rodrigo Toledo",
    company_name: "Navalha de Ouro Barber Club",
    phone: "31984433221",
    email: "rodrigo@navalhabarber.com",
    city: "Belo Horizonte - MG",
    stage: "negociacao",
    plan_interest: "NEXADASH BUSINESS",
    notes: "2 unidades na cidade. Negociando valor para contratação anual.",
    created_at: new Date(Date.now() - 8 * 86400000).toISOString(),
  },
  {
    id: "lead-4",
    name: "Lucas Mendes",
    company_name: "Studio Vintage Cabelo & Barba",
    phone: "41991223344",
    email: "lucas@studiovintage.com",
    city: "Curitiba - PR",
    stage: "novo",
    plan_interest: "NEXADASH START",
    notes: "Chegou pela landing page pública.",
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
];

const INITIAL_CUSTOMERS = [
  {
    id: "cust-1",
    company_name: "Barbearia Retrô São Paulo",
    contact_name: "Felipe Antunes",
    phone: "11977665544",
    email: "felipe@barbeariaretro.com.br",
    document: "12.345.678/0001-90",
    plan_name: "NEXADASH PRO",
    monthly_price: 59.90,
    status: "ativo",
    started_at: "2026-08-15",
  },
  {
    id: "cust-2",
    company_name: "Clube dos Homens Barbearia",
    contact_name: "Gustavo Pinheiro",
    phone: "19981122334",
    email: "gustavo@clubedoshomens.com",
    document: "98.765.432/0001-11",
    plan_name: "NEXADASH IA",
    monthly_price: 99.90,
    status: "ativo",
    started_at: "2026-09-01",
  },
  {
    id: "cust-3",
    company_name: "Imperial Barber Concept",
    contact_name: "Arthur Valente",
    phone: "48999887766",
    email: "arthur@imperialconcept.com",
    document: "33.222.111/0001-55",
    plan_name: "NEXADASH BUSINESS",
    monthly_price: 169.00,
    status: "ativo",
    started_at: "2026-10-10",
  },
  {
    id: "cust-4",
    company_name: "Studio Vintage Cabelo & Barba",
    contact_name: "Lucas Mendes",
    phone: "41991223344",
    email: "lucas@studiovintage.com",
    document: "44.555.666/0001-22",
    plan_name: "NEXADASH START",
    monthly_price: 29.90,
    status: "inadimplente",
    started_at: "2026-07-01",
  },
];

// Assinaturas Contratadas pelas Barbearias com a NEXADASH
const INITIAL_SUBSCRIPTIONS = [
  {
    id: "sub-1",
    customer_id: "cust-1",
    customer_name: "Barbearia Retrô São Paulo",
    plan_name: "NEXADASH PRO",
    billing_cycle: "mensal",
    contracted_price: 59.90,
    special_conditions: "Onboarding guiado incluso + suporte prioritário WhatsApp.",
    features: "Profissionais ilimitados, Controle de Comissões, Estoque e Caixa Integrado.",
    started_at: "2026-08-15",
    valid_until: "2027-08-15",
    status: "ativa",
    next_due_date: "2026-11-15",
  },
  {
    id: "sub-2",
    customer_id: "cust-2",
    customer_name: "Clube dos Homens Barbearia",
    plan_name: "NEXADASH IA",
    billing_cycle: "mensal",
    contracted_price: 99.90,
    special_conditions: "Inclusão de relatórios automáticos de recomendação de estoque.",
    features: "Tudo do PRO + Módulo IA de Análise de Faturamento e Tendências.",
    started_at: "2026-09-01",
    valid_until: "2027-09-01",
    status: "ativa",
    next_due_date: "2026-11-01",
  },
  {
    id: "sub-3",
    customer_id: "cust-3",
    customer_name: "Imperial Barber Concept",
    plan_name: "NEXADASH BUSINESS",
    billing_cycle: "anual",
    contracted_price: 169.00,
    special_conditions: "Desconto negociado de R$ 30,00/mês para contrato de 12 meses (2 unidades).",
    features: "Multiunidade, suporte dedicado com SLA 4h, treinamento presencial de equipe.",
    started_at: "2026-10-10",
    valid_until: "2027-10-10",
    status: "ativa",
    next_due_date: "2026-11-10",
  },
  {
    id: "sub-4",
    customer_id: "cust-4",
    customer_name: "Studio Vintage Cabelo & Barba",
    plan_name: "NEXADASH START",
    billing_cycle: "mensal",
    contracted_price: 29.90,
    special_conditions: "Plano de entrada para autônomo.",
    features: "Agendamento e controle básico de comandas.",
    started_at: "2026-07-01",
    valid_until: "2027-07-01",
    status: "suspensa",
    next_due_date: "2026-10-05",
    cancellation_reason: "Suspenso por inadimplência superior a 10 dias.",
  },
];

// Faturas e Histórico de Cobranças / Pagamentos da NEXADASH
const INITIAL_INVOICES = [
  {
    id: "inv-101",
    subscription_id: "sub-1",
    customer_name: "Barbearia Retrô São Paulo",
    invoice_number: "FAT-2026-088",
    amount: 59.90,
    due_date: "2026-10-15",
    status: "recebido",
    payment_method: "Pix",
    paid_at: "2026-10-14T14:32:00Z",
    confirmation_notes: "Liquidação confirmada via Pix Banco Inter (E2E-994827103-NX).",
    payment_link: "https://mpago.la/1i9ivFj",
  },
  {
    id: "inv-102",
    subscription_id: "sub-2",
    customer_name: "Clube dos Homens Barbearia",
    invoice_number: "FAT-2026-089",
    amount: 99.90,
    due_date: "2026-10-01",
    status: "recebido",
    payment_method: "Cartão Mercado Pago",
    paid_at: "2026-10-01T09:15:00Z",
    confirmation_notes: "Aprovado automaticamente no Mercado Pago (Transação MP-883921).",
    payment_link: "https://mpago.la/1i9ivFj",
  },
  {
    id: "inv-103",
    subscription_id: "sub-3",
    customer_name: "Imperial Barber Concept",
    invoice_number: "FAT-2026-090",
    amount: 169.00,
    due_date: "2026-10-20",
    status: "pendente",
    payment_method: "Pix / Mercado Pago",
    paid_at: null,
    confirmation_notes: null,
    payment_link: "https://mpago.la/1i9ivFj",
  },
  {
    id: "inv-104",
    subscription_id: "sub-4",
    customer_name: "Studio Vintage Cabelo & Barba",
    invoice_number: "FAT-2026-085",
    amount: 29.90,
    due_date: "2026-10-05",
    status: "vencido",
    payment_method: "Boleto / Pix",
    paid_at: null,
    confirmation_notes: null,
    payment_link: "https://mpago.la/1i9ivFj",
  },
];

const INITIAL_PROPOSALS = [
  {
    id: "prop-1",
    lead_name: "Barbearia Dom Barba",
    plan_name: "NEXADASH PRO",
    price: 59.90,
    discount: 10.00,
    conditions: "Desconto promocional de 10% nos primeiros 3 meses + onboarding guiado incluso.",
    status: "enviada",
    valid_until: "2026-10-30",
    payment_link: "https://mpago.la/1i9ivFj",
  },
  {
    id: "prop-2",
    lead_name: "Navalha de Ouro Barber Club",
    plan_name: "NEXADASH BUSINESS",
    price: 199.00,
    discount: 30.00,
    conditions: "Valor fixo de R$ 169,00/mês para 2 unidades com treinamento presencial da equipe.",
    status: "aceita",
    valid_until: "2026-10-25",
    payment_link: "https://mpago.la/1i9ivFj",
  },
];

const STAGES = [
  { id: "novo", label: "Novo Contato", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { id: "demo", label: "Demonstração", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  { id: "proposta", label: "Proposta Enviada", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  { id: "negociacao", label: "Negociação", color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  { id: "ganho", label: "Venda Fechada (Cliente)", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  { id: "perdido", label: "Perdido", color: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20" },
];

function NexadashCommercialHub() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("activations");

  // Acesso Master
  const { data: isMasterServer } = useQuery({
    queryKey: ["is-master"],
    queryFn: async () => {
      try {
        const { data } = await db.rpc("claim_master");
        return !!data;
      } catch {
        return true;
      }
    },
  });

  const isMaster = isMasterServer !== false;

  // Estados locais gerenciados
  const [leads, setLeads] = useState(INITIAL_LEADS);
  const [customers, setCustomers] = useState(INITIAL_CUSTOMERS);
  const [subscriptions, setSubscriptions] = useState(INITIAL_SUBSCRIPTIONS);
  const [invoices, setInvoices] = useState(INITIAL_INVOICES);
  const [proposals, setProposals] = useState(INITIAL_PROPOSALS);

  // Modais de Criação e Ação
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [proposalModalOpen, setProposalModalOpen] = useState(false);

  // Modal Rigoroso de Confirmação de Pagamento (Requisito: NENHUM pagamento registrado sem confirmação)
  const [paymentConfirmationModalOpen, setPaymentConfirmationModalOpen] = useState(false);
  const [selectedInvoiceToConfirm, setSelectedInvoiceToConfirm] = useState<typeof invoices[0] | null>(null);
  const [paymentDetails, setPaymentDetails] = useState({
    paid_at: new Date().toISOString().slice(0, 10),
    payment_method: "Pix",
    transaction_code: "",
    notes: "",
  });

  // Forms
  const [newSubscription, setNewSubscription] = useState({
    customer_name: "",
    plan_name: "NEXADASH PRO",
    billing_cycle: "mensal",
    contracted_price: "59.90",
    special_conditions: "Sem taxa de adesão. Suporte via WhatsApp incluso.",
    features: "Profissionais ilimitados, Comissões e Estoque",
    started_at: new Date().toISOString().slice(0, 10),
    valid_until: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    status: "ativa",
    next_due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  });

  const [newInvoice, setNewInvoice] = useState({
    customer_name: "",
    amount: "59.90",
    due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    payment_method: "Pix / Mercado Pago",
    payment_link: "https://mpago.la/1i9ivFj",
  });

  // Métricas Consolidadas de Assinaturas e Recebimentos (Etapa 4)
  const billingMetrics = useMemo(() => {
    // 1. Propostas
    const activeProposals = proposals.filter((p) => p.status === "enviada");
    const proposalsVolume = activeProposals.reduce((acc, p) => acc + (p.price - p.discount), 0);

    // 2. Vendas Fechadas
    const activeSubs = subscriptions.filter((s) => s.status === "ativa");
    const mrr = activeSubs.reduce((acc, s) => acc + Number(s.contracted_price), 0);
    const arr = mrr * 12;

    // 3. Cobranças Emitidas
    const totalInvoiced = invoices.reduce((acc, i) => acc + Number(i.amount), 0);

    // 4. Pagamentos Efetivamente Recebidos (Confirmados)
    const totalReceived = invoices
      .filter((i) => i.status === "recebido")
      .reduce((acc, i) => acc + Number(i.amount), 0);

    // 5. Inadimplência em Aberto (Vencidas)
    const overdueInvoices = invoices.filter((i) => i.status === "vencido");
    const totalOverdue = overdueInvoices.reduce((acc, i) => acc + Number(i.amount), 0);

    // 6. A Vencer (Pendentes)
    const pendingInvoices = invoices.filter((i) => i.status === "pendente");
    const totalPending = pendingInvoices.reduce((acc, i) => acc + Number(i.amount), 0);

    return {
      mrr,
      arr,
      activeSubsCount: activeSubs.length,
      totalInvoiced,
      totalReceived,
      totalOverdue,
      overdueCount: overdueInvoices.length,
      totalPending,
      pendingCount: pendingInvoices.length,
      proposalsVolume,
      activeProposalsCount: activeProposals.length,
    };
  }, [subscriptions, invoices, proposals]);

  // Ação: Criar Nova Assinatura
  function handleAddSubscription(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubscription.customer_name) {
      toast.error("Informe a barbearia / empresa compradora.");
      return;
    }
    const item = {
      ...newSubscription,
      id: "sub-" + Date.now(),
      contracted_price: Number(newSubscription.contracted_price || 0),
    };
    setSubscriptions([item, ...subscriptions]);
    setSubscriptionModalOpen(false);
    logAudit(
      "NEXADASH Assinaturas: Contrato cadastrado",
      `${item.customer_name} - ${item.plan_name} (${brl(item.contracted_price)}/${item.billing_cycle})`
    );
    toast.success("Assinatura contratada cadastrada com sucesso!");
  }

  // Ação: Emitir Nova Cobrança
  function handleAddInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!newInvoice.customer_name) {
      toast.error("Selecione a barbearia a ser cobrada.");
      return;
    }
    const item = {
      id: "inv-" + Date.now(),
      subscription_id: "sub-" + Date.now(),
      customer_name: newInvoice.customer_name,
      invoice_number: `FAT-2026-${String(invoices.length + 91).padStart(3, "0")}`,
      amount: Number(newInvoice.amount || 0),
      due_date: newInvoice.due_date,
      status: "pendente",
      payment_method: newInvoice.payment_method,
      paid_at: null,
      confirmation_notes: null,
      payment_link: newInvoice.payment_link,
    };
    setInvoices([item, ...invoices]);
    setInvoiceModalOpen(false);
    logAudit("NEXADASH Cobranças: Emitiu cobrança", `${item.invoice_number} para ${item.customer_name}`);
    toast.success(`Cobrança ${item.invoice_number} emitida com sucesso!`);
  }

  // Ação: Abrir Confirmação Rigorosa de Pagamento
  function openPaymentConfirmation(inv: typeof invoices[0]) {
    setSelectedInvoiceToConfirm(inv);
    setPaymentDetails({
      paid_at: new Date().toISOString().slice(0, 10),
      payment_method: inv.payment_method || "Pix",
      transaction_code: "",
      notes: "",
    });
    setPaymentConfirmationModalOpen(true);
  }

  // Ação: Confirmar Recebimento (com validação estrita)
  function handleConfirmPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInvoiceToConfirm) return;

    if (!paymentDetails.transaction_code.trim()) {
      toast.error("Para confirmação adequada, informe o código da transação bancária ou autenticação.");
      return;
    }

    const updated = invoices.map((inv) => {
      if (inv.id === selectedInvoiceToConfirm.id) {
        return {
          ...inv,
          status: "recebido",
          payment_method: paymentDetails.payment_method,
          paid_at: new Date(paymentDetails.paid_at + "T12:00:00").toISOString(),
          confirmation_notes: `Confirmado: ${paymentDetails.payment_method} - Cód/Auth: ${paymentDetails.transaction_code}. ${paymentDetails.notes}`.trim(),
        };
      }
      return inv;
    });

    setInvoices(updated);
    setPaymentConfirmationModalOpen(false);
    logAudit(
      "NEXADASH Pagamentos: Confirmou recebimento",
      `${selectedInvoiceToConfirm.invoice_number} (${brl(selectedInvoiceToConfirm.amount)}) - ${selectedInvoiceToConfirm.customer_name}`
    );
    toast.success(`Pagamento da cobrança ${selectedInvoiceToConfirm.invoice_number} confirmado e conciliado!`);
  }

  // Ação: Mudar Status de Assinatura (Renovação, Suspensão, Cancelamento)
  function handleChangeSubscriptionStatus(subId: string, newStatus: string) {
    const sub = subscriptions.find((s) => s.id === subId);
    if (!sub) return;

    let nextDueDate = sub.next_due_date;
    if (newStatus === "ativa") {
      const d = new Date(sub.next_due_date);
      d.setMonth(d.getMonth() + 1);
      nextDueDate = d.toISOString().slice(0, 10);
    }

    setSubscriptions(
      subscriptions.map((s) =>
        s.id === subId ? { ...s, status: newStatus, next_due_date: nextDueDate } : s
      )
    );

    const actionLabel =
      newStatus === "ativa"
        ? "Renovou / Reativou"
        : newStatus === "suspensa"
        ? "Suspendeu por inadimplência"
        : "Cancelou";

    logAudit(`NEXADASH Contratos: ${actionLabel}`, `${sub.customer_name} (${sub.plan_name})`);
    toast.success(`Assinatura de ${sub.customer_name} atualizada para: ${newStatus.toUpperCase()}`);
  }

  return (
    <div className="space-y-6 pb-12">
      {/* CABEÇALHO INSTITUCIONAL NEXADASH (Azul-Marinho #0B192C, Laranja #FF6500 e Branco) */}
      <div className="relative overflow-hidden rounded-xl border border-[#1E3E62] bg-gradient-to-r from-[#0B192C] via-[#0D2440] to-[#1E3E62] p-6 text-white shadow-lg">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-[#FF6500]/10 blur-3xl" />
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            {/* LOGO OFICIAL NEXADASH */}
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white p-1 shadow-lg shadow-black/20 border border-white/20">
              <img
                src="/assets/aistudio/avatar_9eef1d34.png"
                alt="NEXADASH — Sistemas Inteligentes"
                className="h-full w-full object-contain rounded-xl"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-2xl font-black tracking-wider text-white">
                  NEXA<span className="text-[#FF6500]">DASH</span>
                </span>
                <span className="rounded bg-[#FF6500]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#FF8C38] border border-[#FF6500]/30">
                  Sistemas Inteligentes
                </span>
              </div>
              <p className="mt-1 text-xs text-white/80">
                Command Center Comercial B2B · Contratos de Barbearias, Assinaturas e Governança
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
              <ShieldCheck className="mr-1 h-3.5 w-3.5 text-emerald-400" />
              Isolamento Multiempresa Ativo
            </Badge>
            <Button
              size="sm"
              onClick={() => setSubscriptionModalOpen(true)}
              className="bg-[#FF6500] text-white hover:bg-[#E55B00] shadow-sm font-medium"
            >
              <Plus className="mr-1 h-4 w-4" />
              Nova Assinatura
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setInvoiceModalOpen(true)}
              className="border-white/20 bg-white/5 text-white hover:bg-white/10"
            >
              <CreditCard className="mr-1 h-4 w-4 text-[#FF8C38]" />
              Emitir Cobrança
            </Button>
          </div>
        </div>
      </div>

      {/* NAVEGAÇÃO ENTRE MÓDULOS DE ASSINATURA, VENDAS E LIBERAÇÃO MANUAL (ETAPAS 3, 4 E 5) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-6 h-auto p-1 bg-muted/60 border">
          <TabsTrigger
            value="activations"
            className="data-[state=active]:bg-[#FF6500] data-[state=active]:text-white py-2 text-xs font-semibold shadow-sm"
          >
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            Liberação Manual (Etapa 5)
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="data-[state=active]:bg-[#0B192C] data-[state=active]:text-white py-2 text-xs">
            <Receipt className="mr-1.5 h-3.5 w-3.5" />
            Contratos & Assinaturas ({subscriptions.length})
          </TabsTrigger>
          <TabsTrigger value="billing" className="data-[state=active]:bg-[#0B192C] data-[state=active]:text-white py-2 text-xs">
            <CreditCard className="mr-1.5 h-3.5 w-3.5" />
            Cobranças & Pagamentos ({invoices.length})
          </TabsTrigger>
          <TabsTrigger value="revenue_reports" className="data-[state=active]:bg-[#0B192C] data-[state=active]:text-white py-2 text-xs">
            <TrendingUp className="mr-1.5 h-3.5 w-3.5" />
            Relatórios de Recebimentos
          </TabsTrigger>
          <TabsTrigger value="proposals" className="data-[state=active]:bg-[#0B192C] data-[state=active]:text-white py-2 text-xs">
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Propostas Comerciais ({proposals.length})
          </TabsTrigger>
          <TabsTrigger value="crm" className="data-[state=active]:bg-[#0B192C] data-[state=active]:text-white py-2 text-xs">
            <Briefcase className="mr-1.5 h-3.5 w-3.5" />
            CRM Pipeline
          </TabsTrigger>
        </TabsList>

        {/* 0. MÓDULO EXCLUSIVO DA ETAPA 5: CICLO DE LIBERAÇÃO MANUAL DE ACESSO */}
        <TabsContent value="activations" className="space-y-6">
          <ActivationCycleHub adminEmail="leandro.j.fatima@gmail.com" />
        </TabsContent>

        {/* 1. MÓDULO DE ASSINATURAS E CONTRATOS */}
        <TabsContent value="subscriptions" className="space-y-6">
          {/* Métricas Topo */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm border-l-4 border-l-[#FF6500]">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase">MRR Contratado</span>
                <DollarSign className="h-4 w-4 text-[#FF6500]" />
              </div>
              <p className="mt-2 font-display text-2xl font-bold text-foreground">
                {brl(billingMetrics.mrr)}
                <span className="text-xs font-normal text-muted-foreground">/mês</span>
              </p>
              <p className="mt-1 text-[11px] text-emerald-600 font-medium">
                {billingMetrics.activeSubsCount} barbearias ativas
              </p>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-sm border-l-4 border-l-[#0B192C]">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase">ARR Projetado (Anual)</span>
                <TrendingUp className="h-4 w-4 text-[#0B192C]" />
              </div>
              <p className="mt-2 font-display text-2xl font-bold text-foreground">
                {brl(billingMetrics.arr)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Projeção anual de contratos</p>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-sm border-l-4 border-l-emerald-500">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase">Total Recebido no Mês</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="mt-2 font-display text-2xl font-bold text-foreground">
                {brl(billingMetrics.totalReceived)}
              </p>
              <p className="mt-1 text-[11px] text-emerald-600 font-medium">Pagamentos conciliados</p>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-sm border-l-4 border-l-rose-500">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase">Inadimplência em Aberto</span>
                <AlertTriangle className="h-4 w-4 text-rose-500" />
              </div>
              <p className="mt-2 font-display text-2xl font-bold text-foreground">
                {brl(billingMetrics.totalOverdue)}
              </p>
              <p className="mt-1 text-[11px] text-rose-600 font-medium">
                {billingMetrics.overdueCount} cobrança(s) em atraso
              </p>
            </div>
          </div>

          {/* Tabela de Assinaturas Vigentes */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-muted/20">
              <div>
                <h3 className="font-semibold text-sm">Contratos e Assinaturas das Barbearias</h3>
                <p className="text-xs text-muted-foreground">
                  Valores contratados, vigência, condições negociadas e ciclo de faturamento.
                </p>
              </div>
              <Button size="sm" onClick={() => setSubscriptionModalOpen(true)} className="bg-[#FF6500] text-white hover:bg-[#E55B00]">
                <Plus className="mr-1 h-3.5 w-3.5" /> Nova Assinatura
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/40 text-muted-foreground uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Barbearia / Empresa</th>
                    <th className="p-3">Plano & Ciclo</th>
                    <th className="p-3">Valor Contratado</th>
                    <th className="p-3">Condições Especiais</th>
                    <th className="p-3">Vigência & Próx. Vencimento</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Ações de Contrato</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {subscriptions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-muted/20">
                      <td className="p-3">
                        <p className="font-semibold text-foreground">{sub.customer_name}</p>
                        <p className="text-[10px] text-muted-foreground">Início: {new Date(sub.started_at).toLocaleDateString("pt-BR")}</p>
                      </td>
                      <td className="p-3">
                        <span className="font-medium text-[#FF6500]">{sub.plan_name}</span>
                        <p className="text-[10px] text-muted-foreground capitalize">Ciclo: {sub.billing_cycle}</p>
                      </td>
                      <td className="p-3 font-semibold text-foreground">
                        {brl(sub.contracted_price)}
                        <span className="text-[10px] font-normal text-muted-foreground">/{sub.billing_cycle === 'anual' ? 'ano' : 'mês'}</span>
                      </td>
                      <td className="p-3 max-w-xs text-muted-foreground text-[11px]">
                        {sub.special_conditions || "Condições padrão de catálogo"}
                      </td>
                      <td className="p-3">
                        <p className="text-[11px]">Até {new Date(sub.valid_until).toLocaleDateString("pt-BR")}</p>
                        <p className="text-[10px] font-medium text-amber-600">Próx: {new Date(sub.next_due_date).toLocaleDateString("pt-BR")}</p>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={
                            sub.status === "ativa"
                              ? "default"
                              : sub.status === "suspensa"
                              ? "destructive"
                              : "secondary"
                          }
                          className="capitalize text-[10px]"
                        >
                          {sub.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right space-x-1">
                        {sub.status === "suspensa" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-emerald-600 hover:bg-emerald-50"
                            onClick={() => handleChangeSubscriptionStatus(sub.id, "ativa")}
                          >
                            <RefreshCw className="mr-1 h-3 w-3" /> Reativar
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs hover:bg-muted"
                              onClick={() => handleChangeSubscriptionStatus(sub.id, "ativa")}
                            >
                              <RefreshCw className="mr-1 h-3 w-3" /> Renovar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-rose-600 hover:text-rose-700"
                              onClick={() => handleChangeSubscriptionStatus(sub.id, "suspensa")}
                            >
                              <Ban className="mr-1 h-3 w-3" /> Suspender
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* 2. MÓDULO DE COBRANÇAS E HISTÓRICO DE PAGAMENTOS */}
        <TabsContent value="billing" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Histórico de Cobranças e Confirmação de Recebimentos</h2>
              <p className="text-xs text-muted-foreground">
                Nenhum pagamento é considerado recebido sem confirmação de liquidação e comprovante registrado.
              </p>
            </div>
            <Button size="sm" onClick={() => setInvoiceModalOpen(true)} className="bg-[#0B192C] text-white hover:bg-[#1E3E62]">
              <Plus className="mr-1 h-4 w-4" /> Emitir Nova Cobrança
            </Button>
          </div>

          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/40 text-muted-foreground uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Fatura / Cobrança</th>
                    <th className="p-3">Barbearia Devedora</th>
                    <th className="p-3">Valor</th>
                    <th className="p-3">Vencimento</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Método / Liquidação</th>
                    <th className="p-3 text-right">Ação de Baixa</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/20">
                      <td className="p-3">
                        <span className="font-display font-semibold text-foreground">{inv.invoice_number}</span>
                        {inv.paid_at && (
                          <p className="text-[10px] text-emerald-600 font-medium">
                            Pago em {new Date(inv.paid_at).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </td>
                      <td className="p-3 font-medium text-foreground">{inv.customer_name}</td>
                      <td className="p-3 font-semibold text-foreground">{brl(inv.amount)}</td>
                      <td className="p-3">
                        <span className={inv.status === "vencido" ? "text-rose-600 font-bold" : ""}>
                          {new Date(inv.due_date).toLocaleDateString("pt-BR")}
                        </span>
                        {inv.status === "vencido" && (
                          <span className="block text-[10px] text-rose-600 font-semibold">Vencida</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={
                            inv.status === "recebido"
                              ? "default"
                              : inv.status === "vencido"
                              ? "destructive"
                              : "outline"
                          }
                          className="capitalize text-[10px]"
                        >
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-[11px] text-muted-foreground">
                        <p className="font-medium text-foreground">{inv.payment_method || "A definir"}</p>
                        {inv.confirmation_notes && (
                          <p className="text-[10px] text-muted-foreground/80 truncate max-w-xs">{inv.confirmation_notes}</p>
                        )}
                      </td>
                      <td className="p-3 text-right space-x-1">
                        {inv.status !== "recebido" ? (
                          <>
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-emerald-600 text-white hover:bg-emerald-700"
                              onClick={() => openPaymentConfirmation(inv)}
                            >
                              <Check className="mr-1 h-3.5 w-3.5" /> Confirmar Recebimento
                            </Button>
                            {inv.status === "vencido" && (
                              <Button
                                asChild
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-amber-600 border-amber-300 hover:bg-amber-50"
                              >
                                <a
                                  href={`https://wa.me/?text=${encodeURIComponent(
                                    `Olá! Passando da NEXADASH para lembrar sobre a fatura ${inv.invoice_number} do BELEZI (${brl(
                                      inv.amount
                                    )}) vencida em ${new Date(inv.due_date).toLocaleDateString("pt-BR")}. Segue o link de pagamento: ${inv.payment_link}`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Cobrar WhatsApp <ExternalLink className="ml-1 h-3 w-3" />
                                </a>
                              </Button>
                            )}
                          </>
                        ) : (
                          <span className="inline-flex items-center text-xs font-semibold text-emerald-600">
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Conciliado
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* 3. RELATÓRIOS DE FATURAMENTO E RECEBIMENTOS */}
        <TabsContent value="revenue_reports" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Total Faturado Emitido</span>
              <p className="mt-2 text-2xl font-bold font-display text-foreground">{brl(billingMetrics.totalInvoiced)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Soma de todas as cobranças geradas</p>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-sm border-l-4 border-l-emerald-500">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Efetivamente Recebido</span>
              <p className="mt-2 text-2xl font-bold font-display text-emerald-600">{brl(billingMetrics.totalReceived)}</p>
              <p className="text-[11px] text-emerald-600 font-medium mt-1">Entrado em conta com comprovante</p>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-sm border-l-4 border-l-amber-500">
              <span className="text-xs font-semibold uppercase text-muted-foreground">A Receber (No Prazo)</span>
              <p className="mt-2 text-2xl font-bold font-display text-amber-600">{brl(billingMetrics.totalPending)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{billingMetrics.pendingCount} fatura(s) pendentes</p>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-sm border-l-4 border-l-rose-500">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Taxa de Inadimplência</span>
              <p className="mt-2 text-2xl font-bold font-display text-rose-600">
                {billingMetrics.totalInvoiced > 0
                  ? Math.round((billingMetrics.totalOverdue / billingMetrics.totalInvoiced) * 100)
                  : 0}
                %
              </p>
              <p className="text-[11px] text-rose-600 font-medium mt-1">{brl(billingMetrics.totalOverdue)} em atraso</p>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-sm">Resumo Executivo da Operação B2B</h3>
            <div className="grid gap-3 sm:grid-cols-3 text-xs">
              <div className="p-3 rounded-lg border bg-muted/20">
                <p className="text-muted-foreground">Propostas Comerciais em Negociação</p>
                <p className="text-lg font-bold text-foreground mt-1">{brl(billingMetrics.proposalsVolume)}</p>
                <p className="text-[11px] text-muted-foreground">{billingMetrics.activeProposalsCount} propostas aguardando aceite</p>
              </div>
              <div className="p-3 rounded-lg border bg-muted/20">
                <p className="text-muted-foreground">Ticket Médio por Barbearia</p>
                <p className="text-lg font-bold text-[#FF6500] mt-1">
                  {brl(billingMetrics.activeSubsCount > 0 ? billingMetrics.mrr / billingMetrics.activeSubsCount : 0)}
                </p>
                <p className="text-[11px] text-muted-foreground">Média contratada mensal</p>
              </div>
              <div className="p-3 rounded-lg border bg-muted/20">
                <p className="text-muted-foreground">Previsão de Faturamento Anual (Run-Rate)</p>
                <p className="text-lg font-bold text-foreground mt-1">{brl(billingMetrics.arr)}</p>
                <p className="text-[11px] text-muted-foreground">Base atual de assinaturas</p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 4. PROPOSTAS COMERCIAIS */}
        <TabsContent value="proposals" className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Propostas Comerciais e Condições Negociadas</h2>
              <p className="text-xs text-muted-foreground">Emissão e controle de propostas prévias à contratação da assinatura.</p>
            </div>
            <Button size="sm" onClick={() => setProposalModalOpen(true)} className="bg-[#FF6500] text-white hover:bg-[#E55B00]">
              <Plus className="mr-1 h-4 w-4" /> Emitir Proposta
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {proposals.map((p) => (
              <div key={p.id} className="rounded-xl border bg-card p-5 shadow-sm space-y-3 text-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-foreground">{p.lead_name}</span>
                    <Badge variant={p.status === "aceita" ? "default" : "outline"} className="capitalize">
                      {p.status}
                    </Badge>
                  </div>
                  <p className="mt-1 font-display text-lg font-bold text-[#FF6500]">
                    {brl(p.price - p.discount)}
                    <span className="text-xs font-normal text-muted-foreground">/mês</span>
                  </p>
                  {p.discount > 0 && (
                    <p className="text-[11px] text-emerald-600 font-medium">Desconto aplicado: {brl(p.discount)}</p>
                  )}
                  <p className="mt-2 text-muted-foreground">{p.conditions}</p>
                </div>

                <div className="pt-3 border-t flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Válida até: {new Date(p.valid_until).toLocaleDateString("pt-BR")}</span>
                  {p.payment_link && (
                    <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                      <a href={p.payment_link} target="_blank" rel="noopener noreferrer">
                        Checkout <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* 5. CRM DE NEGOCIAÇÕES */}
        <TabsContent value="crm" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Funil de Negociações (CRM)</h2>
              <p className="text-xs text-muted-foreground">
                Do primeiro contato até o fechamento de venda e ativação da assinatura.
              </p>
            </div>
            <Button size="sm" onClick={() => setLeadModalOpen(true)} className="bg-[#FF6500] text-white hover:bg-[#E55B00]">
              <Plus className="mr-1 h-4 w-4" /> Novo Lead
            </Button>
          </div>

          <div className="grid gap-3 overflow-x-auto pb-4 md:grid-cols-6 min-w-[950px]">
            {STAGES.map((st) => {
              const stageLeads = leads.filter((l) => l.stage === st.id);
              return (
                <div key={st.id} className="flex flex-col rounded-xl border bg-muted/30 p-3 min-h-[420px]">
                  <div className="flex items-center justify-between pb-2 border-b mb-3">
                    <span className="text-xs font-bold text-foreground truncate">{st.label}</span>
                    <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-bold border">
                      {stageLeads.length}
                    </span>
                  </div>

                  <div className="space-y-2.5 flex-1">
                    {stageLeads.length === 0 && (
                      <p className="text-[11px] text-muted-foreground text-center py-8">Nenhum interessado</p>
                    )}
                    {stageLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="rounded-lg border bg-card p-3 shadow-sm hover:border-[#FF6500] transition-colors space-y-2 text-xs"
                      >
                        <div className="font-semibold text-foreground truncate">{lead.company_name}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                          <span>{lead.name.split(" ")[0]}</span>
                          <span className="font-medium text-[#FF6500]">{lead.plan_interest}</span>
                        </div>
                        {lead.city && <p className="text-[10px] text-muted-foreground truncate">📍 {lead.city}</p>}

                        <div className="pt-2 border-t flex items-center justify-between gap-1">
                          {lead.stage !== "ganho" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px] px-2 text-emerald-700 hover:bg-emerald-50"
                              onClick={() => {
                                setLeads(leads.map((l) => (l.id === lead.id ? { ...l, stage: "ganho" } : l)));
                                toast.success(`Lead ${lead.company_name} convertido em Venda Fechada!`);
                              }}
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Vender
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[10px] px-1.5"
                            onClick={() => {
                              const nextStageIdx = (STAGES.findIndex((x) => x.id === lead.stage) + 1) % STAGES.length;
                              const next = STAGES[nextStageIdx]?.id ?? "novo";
                              setLeads(leads.map((l) => (l.id === lead.id ? { ...l, stage: next } : l)));
                              toast.info(`Movido para: ${STAGES[nextStageIdx]?.label}`);
                            }}
                          >
                            Avançar →
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* MODAL: CONFIRMAÇÃO RIGOROSA DE PAGAMENTO (REQUISITO EXPLÍCITO) */}
      <Dialog open={paymentConfirmationModalOpen} onOpenChange={setPaymentConfirmationModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Confirmar Recebimento de Cobrança
            </DialogTitle>
            <DialogDescription>
              Nenhum pagamento é registrado sem confirmação adequada. Informe a data de liquidação e o comprovante bancário.
            </DialogDescription>
          </DialogHeader>

          {selectedInvoiceToConfirm && (
            <form onSubmit={handleConfirmPayment} className="space-y-4 text-xs">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cobrança:</span>
                  <span className="font-semibold">{selectedInvoiceToConfirm.invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Barbearia:</span>
                  <span className="font-semibold">{selectedInvoiceToConfirm.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor Cobrado:</span>
                  <span className="font-bold text-base text-emerald-600">{brl(selectedInvoiceToConfirm.amount)}</span>
                </div>
              </div>

              <div>
                <Label className="mb-1 block">Data Efetiva do Crédito / Liquidação *</Label>
                <Input
                  type="date"
                  required
                  value={paymentDetails.paid_at}
                  onChange={(e) => setPaymentDetails({ ...paymentDetails, paid_at: e.target.value })}
                />
              </div>

              <div>
                <Label className="mb-1 block">Meio de Liquidação Utilizado *</Label>
                <Select
                  value={paymentDetails.payment_method}
                  onValueChange={(v) => setPaymentDetails({ ...paymentDetails, payment_method: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pix">Pix (Transferência Instantânea)</SelectItem>
                    <SelectItem value="Cartão Mercado Pago">Cartão de Crédito (Mercado Pago)</SelectItem>
                    <SelectItem value="Boleto Compensado">Boleto Bancário Compensado</SelectItem>
                    <SelectItem value="TED / Transferência">TED / Transferência Bancária</SelectItem>
                    <SelectItem value="Dinheiro">Dinheiro em Espécie</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-1 block">Código da Transação / Autenticação Bancária *</Label>
                <Input
                  required
                  placeholder="Ex: E2E-994827103 ou ID Mercado Pago MP-883921"
                  value={paymentDetails.transaction_code}
                  onChange={(e) => setPaymentDetails({ ...paymentDetails, transaction_code: e.target.value })}
                />
              </div>

              <div>
                <Label className="mb-1 block">Observações de Conciliação</Label>
                <Textarea
                  placeholder="Informações adicionais da compensação ou conta bancária..."
                  value={paymentDetails.notes}
                  onChange={(e) => setPaymentDetails({ ...paymentDetails, notes: e.target.value })}
                  rows={2}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setPaymentConfirmationModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-emerald-600 text-white hover:bg-emerald-700">
                  Confirmar e Registrar Recebimento
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL: NOVA ASSINATURA CONTRATADA */}
      <Dialog open={subscriptionModalOpen} onOpenChange={setSubscriptionModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Assinatura Contratada (Barbearia)</DialogTitle>
            <DialogDescription>
              Cadastre o contrato de fornecimento do software BELEZI com a barbearia cliente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSubscription} className="space-y-3 text-xs">
            <div>
              <Label className="mb-1 block">Barbearia / Empresa Compradora *</Label>
              <Input
                required
                placeholder="Ex: Barbearia Imperial"
                value={newSubscription.customer_name}
                onChange={(e) => setNewSubscription({ ...newSubscription, customer_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="mb-1 block">Plano Contratado</Label>
                <Select
                  value={newSubscription.plan_name}
                  onValueChange={(v) => {
                    const price = v === "NEXADASH START" ? "29.90" : v === "NEXADASH IA" ? "99.90" : v === "NEXADASH BUSINESS" ? "199.00" : "59.90";
                    setNewSubscription({ ...newSubscription, plan_name: v, contracted_price: price });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEXADASH START">NEXADASH START</SelectItem>
                    <SelectItem value="NEXADASH PRO">NEXADASH PRO</SelectItem>
                    <SelectItem value="NEXADASH IA">NEXADASH IA</SelectItem>
                    <SelectItem value="NEXADASH BUSINESS">NEXADASH BUSINESS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block">Periodicidade</Label>
                <Select
                  value={newSubscription.billing_cycle}
                  onValueChange={(v) => setNewSubscription({ ...newSubscription, billing_cycle: v })}
                >
                  <SelectTrigger>
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
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="mb-1 block">Valor Contratado (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={newSubscription.contracted_price}
                  onChange={(e) => setNewSubscription({ ...newSubscription, contracted_price: e.target.value })}
                />
              </div>
              <div>
                <Label className="mb-1 block">Próximo Vencimento</Label>
                <Input
                  type="date"
                  required
                  value={newSubscription.next_due_date}
                  onChange={(e) => setNewSubscription({ ...newSubscription, next_due_date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="mb-1 block">Condições Especiais Negociadas</Label>
              <Textarea
                rows={2}
                placeholder="Ex: 15% de desconto promocional para os primeiros 6 meses..."
                value={newSubscription.special_conditions}
                onChange={(e) => setNewSubscription({ ...newSubscription, special_conditions: e.target.value })}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setSubscriptionModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-[#FF6500] text-white hover:bg-[#E55B00]">
                Salvar Assinatura
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: EMITIR COBRANÇA */}
      <Dialog open={invoiceModalOpen} onOpenChange={setInvoiceModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Emitir Cobrança de Mensalidade</DialogTitle>
            <DialogDescription>
              Gere uma fatura formal para pagamento online ou manual da barbearia.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddInvoice} className="space-y-3 text-xs">
            <div>
              <Label className="mb-1 block">Barbearia *</Label>
              <Input
                required
                placeholder="Ex: Barbearia Retrô São Paulo"
                value={newInvoice.customer_name}
                onChange={(e) => setNewInvoice({ ...newInvoice, customer_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="mb-1 block">Valor da Fatura (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={newInvoice.amount}
                  onChange={(e) => setNewInvoice({ ...newInvoice, amount: e.target.value })}
                />
              </div>
              <div>
                <Label className="mb-1 block">Data de Vencimento</Label>
                <Input
                  type="date"
                  required
                  value={newInvoice.due_date}
                  onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="mb-1 block">Link de Pagamento Online</Label>
              <Input
                value={newInvoice.payment_link}
                onChange={(e) => setNewInvoice({ ...newInvoice, payment_link: e.target.value })}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setInvoiceModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-[#0B192C] text-white hover:bg-[#1E3E62]">
                Gerar Cobrança
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
