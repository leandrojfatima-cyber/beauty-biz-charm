import { useState, useMemo } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Lock,
  Unlock,
  CheckSquare,
  FileCheck,
  Building2,
  Calendar,
  DollarSign,
  UserCheck,
  FileSignature,
  AlertOctagon,
  Eye,
  RefreshCw,
  Plus,
  Search,
  Filter,
  Check,
  X,
  Send,
  MessageSquare,
  ChevronRight,
  ShieldAlert,
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
import { brl } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export interface AccountActivationItem {
  id: string;
  company_name: string;
  owner_name: string;
  owner_email: string;
  phone: string;
  city: string;
  plan_name: string;
  contracted_value: number;
  billing_cycle: string;
  started_at: string;
  valid_until: string;
  next_due_date: string;

  // Passo 2: Condições acordadas
  conditions_verified: boolean;
  conditions_verified_at: string | null;
  conditions_checklist: {
    terms_accepted: boolean;
    limits_verified: boolean;
    special_discount_confirmed: boolean;
    legal_rep_identified: boolean;
  };
  conditions_notes: string;

  // Passo 3: Situação do Pagamento
  payment_status: "pendente" | "em_analise" | "pago_confirmado" | "isento_cortesia";
  payment_method: string;
  payment_reference: string;
  payment_confirmed_at: string | null;

  // Passo 4: Preparação da Conta
  account_prepared: boolean;
  account_prepared_at: string | null;
  catalog_loaded: boolean;
  settings_configured: boolean;

  // Passo 5 & 6: Liberação Manual de Acesso
  activation_status: "pendente_liberacao_manual" | "autorizado_ativo" | "suspenso_manual" | "recusado";
  authorized_by_admin: string | null;
  authorized_at: string | null;
  deliberation_notes: string | null;

  // Passo 7 & 8: Suspensão / Reativação Manual
  suspension_reason: string | null;
  suspended_by_admin: string | null;
  suspended_at: string | null;
  reactivated_at: string | null;
  reactivated_by_admin: string | null;
}

const INITIAL_ACTIVATIONS: AccountActivationItem[] = [
  {
    id: "act-1",
    company_name: "Barbearia Dom Barba",
    owner_name: "Carlos Eduardo Souza",
    owner_email: "carlos@dombarba.com.br",
    phone: "11987654321",
    city: "São Paulo - SP",
    plan_name: "NEXADASH PRO",
    contracted_value: 59.90,
    billing_cycle: "mensal",
    started_at: "2026-10-15",
    valid_until: "2027-10-15",
    next_due_date: "2026-11-15",
    conditions_verified: true,
    conditions_verified_at: "2026-10-15T10:00:00Z",
    conditions_checklist: {
      terms_accepted: true,
      limits_verified: true,
      special_discount_confirmed: true,
      legal_rep_identified: true,
    },
    conditions_notes: "Conferido: 4 barbeiros, módulo de comissões ativado. Desconto de 10% no 1º trimestre acordado.",
    payment_status: "pago_confirmado",
    payment_method: "Pix Banco Inter",
    payment_reference: "E2E-994827103-NX",
    payment_confirmed_at: "2026-10-15T11:30:00Z",
    account_prepared: true,
    account_prepared_at: "2026-10-15T12:00:00Z",
    catalog_loaded: true,
    settings_configured: true,
    activation_status: "pendente_liberacao_manual", // Pronta para o clique do administrador!
    authorized_by_admin: null,
    authorized_at: null,
    deliberation_notes: null,
    suspension_reason: null,
    suspended_by_admin: null,
    suspended_at: null,
    reactivated_at: null,
    reactivated_by_admin: null,
  },
  {
    id: "act-2",
    company_name: "Navalha de Ouro Barber Club",
    owner_name: "Rodrigo Toledo",
    owner_email: "rodrigo@navalhabarber.com",
    phone: "31984433221",
    city: "Belo Horizonte - MG",
    plan_name: "NEXADASH BUSINESS",
    contracted_value: 169.00,
    billing_cycle: "mensal",
    started_at: "2026-10-14",
    valid_until: "2027-10-14",
    next_due_date: "2026-11-14",
    conditions_verified: true,
    conditions_verified_at: "2026-10-14T14:00:00Z",
    conditions_checklist: {
      terms_accepted: true,
      limits_verified: true,
      special_discount_confirmed: true,
      legal_rep_identified: true,
    },
    conditions_notes: "Contrato para 2 unidades com treinamento presencial incluso.",
    payment_status: "pago_confirmado",
    payment_method: "Cartão Mercado Pago Online",
    payment_reference: "MP-883921-APPROVED",
    payment_confirmed_at: "2026-10-14T14:15:00Z",
    account_prepared: false, // Em preparação
    account_prepared_at: null,
    catalog_loaded: false,
    settings_configured: true,
    activation_status: "pendente_liberacao_manual", // Mesmo aprovado no MP, exige liberação manual!
    authorized_by_admin: null,
    authorized_at: null,
    deliberation_notes: null,
    suspension_reason: null,
    suspended_by_admin: null,
    suspended_at: null,
    reactivated_at: null,
    reactivated_by_admin: null,
  },
  {
    id: "act-3",
    company_name: "Barbearia Retrô São Paulo",
    owner_name: "Felipe Antunes",
    owner_email: "felipe@barbeariaretro.com.br",
    phone: "11977665544",
    city: "São Paulo - SP",
    plan_name: "NEXADASH PRO",
    contracted_value: 59.90,
    billing_cycle: "mensal",
    started_at: "2026-08-15",
    valid_until: "2027-08-15",
    next_due_date: "2026-11-15",
    conditions_verified: true,
    conditions_verified_at: "2026-08-15T09:00:00Z",
    conditions_checklist: {
      terms_accepted: true,
      limits_verified: true,
      special_discount_confirmed: true,
      legal_rep_identified: true,
    },
    conditions_notes: "Plano regular anual com faturamento mensal.",
    payment_status: "pago_confirmado",
    payment_method: "Pix",
    payment_reference: "E2E-RETRO-2026",
    payment_confirmed_at: "2026-08-15T09:30:00Z",
    account_prepared: true,
    account_prepared_at: "2026-08-15T10:00:00Z",
    catalog_loaded: true,
    settings_configured: true,
    activation_status: "autorizado_ativo", // Liberado manualmente pela NEXADASH
    authorized_by_admin: "leandro.j.fatima@gmail.com",
    authorized_at: "2026-08-15T10:15:00Z",
    deliberation_notes: "Acesso autorizado após validação de onboarding e assinatura de termo de serviço.",
    suspension_reason: null,
    suspended_by_admin: null,
    suspended_at: null,
    reactivated_at: null,
    reactivated_by_admin: null,
  },
  {
    id: "act-4",
    company_name: "Studio Vintage Cabelo & Barba",
    owner_name: "Lucas Mendes",
    owner_email: "lucas@studiovintage.com",
    phone: "41991223344",
    city: "Curitiba - PR",
    plan_name: "NEXADASH START",
    contracted_value: 29.90,
    billing_cycle: "mensal",
    started_at: "2026-07-01",
    valid_until: "2027-07-01",
    next_due_date: "2026-10-05",
    conditions_verified: true,
    conditions_verified_at: "2026-07-01T08:00:00Z",
    conditions_checklist: {
      terms_accepted: true,
      limits_verified: true,
      special_discount_confirmed: false,
      legal_rep_identified: true,
    },
    conditions_notes: "Profissional autônomo individual.",
    payment_status: "pendente",
    payment_method: "Boleto",
    payment_reference: "FAT-2026-085",
    payment_confirmed_at: null,
    account_prepared: true,
    account_prepared_at: "2026-07-01T08:30:00Z",
    catalog_loaded: true,
    settings_configured: true,
    activation_status: "suspenso_manual", // Suspensão por deliberação humana
    authorized_by_admin: "admin@nexadash.com.br",
    authorized_at: "2026-07-01T09:00:00Z",
    deliberation_notes: "Liberado na implantação.",
    suspension_reason: "Deliberação da diretoria comercial após 3 contatos sem retorno referente a fatura FAT-2026-085.",
    suspended_by_admin: "leandro.j.fatima@gmail.com",
    suspended_at: "2026-10-14T16:00:00Z",
    reactivated_at: null,
    reactivated_by_admin: null,
  },
  {
    id: "act-5",
    company_name: "Espaço Bella & Charm",
    owner_name: "Mariana Alencar",
    owner_email: "mariana@bellacharm.com",
    phone: "21998877665",
    city: "Rio de Janeiro - RJ",
    plan_name: "NEXADASH IA",
    contracted_value: 99.90,
    billing_cycle: "mensal",
    started_at: "2026-10-16",
    valid_until: "2027-10-16",
    next_due_date: "2026-11-16",
    conditions_verified: false, // Passo 2 pendente
    conditions_verified_at: null,
    conditions_checklist: {
      terms_accepted: false,
      limits_verified: false,
      special_discount_confirmed: false,
      legal_rep_identified: true,
    },
    conditions_notes: "Aguardando confirmação de termo de adesão.",
    payment_status: "em_analise",
    payment_method: "Transferência Pix em conferência",
    payment_reference: "PIX-PEND-9912",
    payment_confirmed_at: null,
    account_prepared: false,
    account_prepared_at: null,
    catalog_loaded: false,
    settings_configured: false,
    activation_status: "pendente_liberacao_manual",
    authorized_by_admin: null,
    authorized_at: null,
    deliberation_notes: null,
    suspension_reason: null,
    suspended_by_admin: null,
    suspended_at: null,
    reactivated_at: null,
    reactivated_by_admin: null,
  },
];

interface ActivationCycleHubProps {
  adminEmail?: string;
}

export function ActivationCycleHub({ adminEmail = "leandro.j.fatima@gmail.com" }: ActivationCycleHubProps) {
  const [activations, setActivations] = useState<AccountActivationItem[]>(() => {
    const saved = localStorage.getItem("nexadash_activations_data");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_ACTIVATIONS;
      }
    }
    return INITIAL_ACTIVATIONS;
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modais do Ciclo em 8 Passos
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [conditionsModalOpen, setConditionsModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [prepareAccountModalOpen, setPrepareAccountModalOpen] = useState(false);
  const [authorizeModalOpen, setAuthorizeModalOpen] = useState(false);
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const [selectedItem, setSelectedItem] = useState<AccountActivationItem | null>(null);

  // Estados dos formulários de cada passo
  // Passo 1: Nova Contratação
  const [newContract, setNewContract] = useState({
    company_name: "",
    owner_name: "",
    owner_email: "",
    phone: "",
    city: "",
    plan_name: "NEXADASH PRO",
    contracted_value: "59.90",
    billing_cycle: "mensal",
    valid_until: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
  });

  // Passo 2: Conferência de Condições
  const [conditionsForm, setConditionsForm] = useState({
    terms_accepted: true,
    limits_verified: true,
    special_discount_confirmed: true,
    legal_rep_identified: true,
    notes: "",
  });

  // Passo 3: Situação do Pagamento
  const [paymentForm, setPaymentForm] = useState({
    status: "pago_confirmado" as AccountActivationItem["payment_status"],
    method: "Pix",
    reference: "",
  });

  // Passo 4: Preparação da Conta
  const [prepareForm, setPrepareForm] = useState({
    catalog_loaded: true,
    settings_configured: true,
    notes: "Conta provisionada com catálogo de cortes, barba e produtos padrão.",
  });

  // Passo 5 & 6: Autorização Manual
  const [authorizeForm, setAuthorizeForm] = useState({
    admin_signature: adminEmail,
    deliberation_notes: "Acesso homologado e liberado após auditoria completa dos requisitos comerciais e técnicos.",
    agreement: false,
  });

  // Passo 8: Suspensão Manual
  const [suspendForm, setSuspendForm] = useState({
    reason: "",
    admin_signature: adminEmail,
  });

  function saveAndPersist(items: AccountActivationItem[]) {
    setActivations(items);
    localStorage.setItem("nexadash_activations_data", JSON.stringify(items));
  }

  // Métricas do Ciclo de Ativação
  const metrics = useMemo(() => {
    const pendingManual = activations.filter((a) => a.activation_status === "pendente_liberacao_manual");
    const activeAuthorized = activations.filter((a) => a.activation_status === "autorizado_ativo");
    const manuallySuspended = activations.filter((a) => a.activation_status === "suspenso_manual");
    
    // Prontas para liberação (passos 1, 2, 3 e 4 concluídos, aguardando clique)
    const readyForRelease = pendingManual.filter(
      (a) => a.conditions_verified && a.payment_status === "pago_confirmado" && a.account_prepared
    );

    // Vencimentos nos próximos 15 dias (Passo 7)
    const today = new Date();
    const in15Days = new Date(Date.now() + 15 * 86400000);
    const upcomingDues = activations.filter((a) => {
      const due = new Date(a.next_due_date);
      return due >= today && due <= in15Days && a.activation_status === "autorizado_ativo";
    });

    return {
      total: activations.length,
      pendingCount: pendingManual.length,
      activeCount: activeAuthorized.length,
      suspendedCount: manuallySuspended.length,
      readyCount: readyForRelease.length,
      upcomingDuesCount: upcomingDues.length,
    };
  }, [activations]);

  // Filtros de listagem
  const filteredList = useMemo(() => {
    return activations.filter((item) => {
      const matchesSearch =
        item.company_name.toLowerCase().includes(search.toLowerCase()) ||
        item.owner_email.toLowerCase().includes(search.toLowerCase()) ||
        item.owner_name.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === "all") return true;
      if (statusFilter === "pending") return item.activation_status === "pendente_liberacao_manual";
      if (statusFilter === "ready") {
        return (
          item.activation_status === "pendente_liberacao_manual" &&
          item.conditions_verified &&
          item.payment_status === "pago_confirmado" &&
          item.account_prepared
        );
      }
      if (statusFilter === "active") return item.activation_status === "autorizado_ativo";
      if (statusFilter === "suspended") return item.activation_status === "suspenso_manual";

      return true;
    });
  }, [activations, search, statusFilter]);

  // 1. REGISTRAR A CONTRATAÇÃO (PASSO 1)
  function handleCreateContract(e: React.FormEvent) {
    e.preventDefault();
    if (!newContract.company_name || !newContract.owner_email) {
      toast.error("Informe o nome da empresa e o e-mail do titular.");
      return;
    }

    const newItem: AccountActivationItem = {
      id: "act-" + Date.now(),
      company_name: newContract.company_name,
      owner_name: newContract.owner_name || newContract.company_name,
      owner_email: newContract.owner_email,
      phone: newContract.phone,
      city: newContract.city,
      plan_name: newContract.plan_name,
      contracted_value: Number(newContract.contracted_value || 0),
      billing_cycle: newContract.billing_cycle,
      started_at: new Date().toISOString().slice(0, 10),
      valid_until: newContract.valid_until,
      next_due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      conditions_verified: false,
      conditions_verified_at: null,
      conditions_checklist: {
        terms_accepted: false,
        limits_verified: false,
        special_discount_confirmed: false,
        legal_rep_identified: true,
      },
      conditions_notes: "",
      payment_status: "pendente",
      payment_method: "Pix / Mercado Pago",
      payment_reference: "",
      payment_confirmed_at: null,
      account_prepared: false,
      account_prepared_at: null,
      catalog_loaded: false,
      settings_configured: false,
      activation_status: "pendente_liberacao_manual", // Inicia rigorosamente bloqueado aguardando liberação manual!
      authorized_by_admin: null,
      authorized_at: null,
      deliberation_notes: null,
      suspension_reason: null,
      suspended_by_admin: null,
      suspended_at: null,
      reactivated_at: null,
      reactivated_by_admin: null,
    };

    saveAndPersist([newItem, ...activations]);
    setContractModalOpen(false);
    logAudit(
      "NEXADASH Ativações: Contratação registrada (Passo 1)",
      `${newItem.company_name} - ${newItem.plan_name} (${brl(newItem.contracted_value)}/${newItem.billing_cycle})`
    );
    toast.success(`Contratação de ${newItem.company_name} registrada com sucesso!`);
  }

  // 2. CONFERIR AS CONDIÇÕES ACORDADAS (PASSO 2)
  function openConditionsCheck(item: AccountActivationItem) {
    setSelectedItem(item);
    setConditionsForm({
      terms_accepted: item.conditions_checklist.terms_accepted,
      limits_verified: item.conditions_checklist.limits_verified,
      special_discount_confirmed: item.conditions_checklist.special_discount_confirmed,
      legal_rep_identified: item.conditions_checklist.legal_rep_identified,
      notes: item.conditions_notes || "",
    });
    setConditionsModalOpen(true);
  }

  function handleSaveConditions(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItem) return;

    const allChecked =
      conditionsForm.terms_accepted &&
      conditionsForm.limits_verified &&
      conditionsForm.special_discount_confirmed &&
      conditionsForm.legal_rep_identified;

    const updated = activations.map((item) => {
      if (item.id === selectedItem.id) {
        return {
          ...item,
          conditions_verified: allChecked,
          conditions_verified_at: allChecked ? new Date().toISOString() : null,
          conditions_checklist: { ...conditionsForm },
          conditions_notes: conditionsForm.notes,
        };
      }
      return item;
    });

    saveAndPersist(updated);
    setConditionsModalOpen(false);
    logAudit(
      "NEXADASH Ativações: Condições conferidas (Passo 2)",
      `${selectedItem.company_name} - Todas conformes: ${allChecked ? "SIM" : "PARCIAL"}`
    );
    toast.success("Conferência de condições acordadas salva com sucesso!");
  }

  // 3. REGISTRAR A SITUAÇÃO DO PAGAMENTO (PASSO 3)
  function openPaymentCheck(item: AccountActivationItem) {
    setSelectedItem(item);
    setPaymentForm({
      status: item.payment_status,
      method: item.payment_method || "Pix",
      reference: item.payment_reference || "",
    });
    setPaymentModalOpen(true);
  }

  function handleSavePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItem) return;

    const isPaid = paymentForm.status === "pago_confirmado" || paymentForm.status === "isento_cortesia";

    const updated = activations.map((item) => {
      if (item.id === selectedItem.id) {
        return {
          ...item,
          payment_status: paymentForm.status,
          payment_method: paymentForm.method,
          payment_reference: paymentForm.reference,
          payment_confirmed_at: isPaid ? (item.payment_confirmed_at || new Date().toISOString()) : null,
        };
      }
      return item;
    });

    saveAndPersist(updated);
    setPaymentModalOpen(false);
    logAudit(
      "NEXADASH Ativações: Pagamento verificado (Passo 3)",
      `${selectedItem.company_name} - Situação: ${paymentForm.status.toUpperCase()} (${paymentForm.method} - Ref: ${paymentForm.reference || "N/A"})`
    );
    toast.success("Situação de pagamento conforme contrato atualizada com sucesso!");
  }

  // 4. PREPARAR A CONTA DA BARBEARIA (PASSO 4)
  function openPrepareAccount(item: AccountActivationItem) {
    setSelectedItem(item);
    setPrepareForm({
      catalog_loaded: item.catalog_loaded,
      settings_configured: item.settings_configured,
      notes: "Conta provisionada, dados de endereço e horários sincronizados.",
    });
    setPrepareAccountModalOpen(true);
  }

  function handleSavePrepareAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItem) return;

    const prepared = prepareForm.catalog_loaded && prepareForm.settings_configured;

    const updated = activations.map((item) => {
      if (item.id === selectedItem.id) {
        return {
          ...item,
          account_prepared: prepared,
          account_prepared_at: prepared ? new Date().toISOString() : null,
          catalog_loaded: prepareForm.catalog_loaded,
          settings_configured: prepareForm.settings_configured,
        };
      }
      return item;
    });

    saveAndPersist(updated);
    setPrepareAccountModalOpen(false);
    logAudit(
      "NEXADASH Ativações: Conta da barbearia preparada (Passo 4)",
      `${selectedItem.company_name} - Catálogo e Configurações prontas: ${prepared ? "SIM" : "NÃO"}`
    );
    toast.success("Preparação da conta registrada com sucesso!");
  }

  // 5 & 6. AUTORIZAR MANUALMENTE A ATIVAÇÃO (PASSOS 5 E 6)
  function openAuthorizeModal(item: AccountActivationItem) {
    setSelectedItem(item);
    setAuthorizeForm({
      admin_signature: adminEmail,
      deliberation_notes: "Acesso homologado e liberado após auditoria completa dos requisitos comerciais e técnicos.",
      agreement: false,
    });
    setAuthorizeModalOpen(true);
  }

  function handleExecuteManualAuthorization(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItem) return;

    if (!authorizeForm.agreement) {
      toast.error("Você deve marcar o termo de responsabilidade para autorizar a liberação manual.");
      return;
    }

    if (!authorizeForm.admin_signature.trim()) {
      toast.error("Informe o e-mail ou nome do administrador responsável pela deliberação.");
      return;
    }

    const now = new Date().toISOString();

    const updated = activations.map((item) => {
      if (item.id === selectedItem.id) {
        return {
          ...item,
          activation_status: "autorizado_ativo" as const,
          authorized_by_admin: authorizeForm.admin_signature.trim(),
          authorized_at: now,
          deliberation_notes: authorizeForm.deliberation_notes,
          suspension_reason: null,
          suspended_by_admin: null,
          suspended_at: null,
        };
      }
      return item;
    });

    saveAndPersist(updated);
    setAuthorizeModalOpen(false);

    // Registro solene em auditoria oficial
    logAudit(
      "NEXADASH Liberação Manual: Acesso Autorizado (Passo 5 e 6)",
      `Responsável: ${authorizeForm.admin_signature} | Empresa: ${selectedItem.company_name} | Plano: ${selectedItem.plan_name} | Vigência: ${selectedItem.valid_until} | Data: ${now}`
    );

    toast.success(`Acesso de ${selectedItem.company_name} liberado manualmente com sucesso!`);
  }

  // 8. DECIDIR MANUALMENTE PELA SUSPENSÃO OU REATIVAÇÃO (PASSO 8)
  function openSuspendModal(item: AccountActivationItem) {
    setSelectedItem(item);
    setSuspendForm({
      reason: "",
      admin_signature: adminEmail,
    });
    setSuspendModalOpen(true);
  }

  function handleExecuteManualSuspension(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItem) return;

    if (!suspendForm.reason.trim()) {
      toast.error("A justificativa formal de suspensão é obrigatória para a auditoria.");
      return;
    }

    const now = new Date().toISOString();

    const updated = activations.map((item) => {
      if (item.id === selectedItem.id) {
        return {
          ...item,
          activation_status: "suspenso_manual" as const,
          suspension_reason: suspendForm.reason.trim(),
          suspended_by_admin: suspendForm.admin_signature.trim(),
          suspended_at: now,
        };
      }
      return item;
    });

    saveAndPersist(updated);
    setSuspendModalOpen(false);

    logAudit(
      "NEXADASH Governança: Suspensão Manual Deliberada (Passo 8)",
      `Empresa: ${selectedItem.company_name} | Motivo: ${suspendForm.reason} | Responsável: ${suspendForm.admin_signature} | Data: ${now}`
    );

    toast.warning(`Acesso de ${selectedItem.company_name} suspenso por deliberação manual.`);
  }

  function handleReactivateAccount(item: AccountActivationItem) {
    const now = new Date().toISOString();
    const updated = activations.map((act) => {
      if (act.id === item.id) {
        return {
          ...act,
          activation_status: "autorizado_ativo" as const,
          reactivated_at: now,
          reactivated_by_admin: adminEmail,
          suspension_reason: null,
          suspended_by_admin: null,
          suspended_at: null,
        };
      }
      return act;
    });

    saveAndPersist(updated);
    logAudit(
      "NEXADASH Governança: Reativação Manual de Acesso",
      `Empresa: ${item.company_name} | Reativado por: ${adminEmail} | Data: ${now}`
    );
    toast.success(`Acesso de ${item.company_name} reativado com sucesso!`);
  }

  return (
    <div className="space-y-6">
      {/* BANNER DE GOVERNANÇA RIGOROSA (ETAPA 5) */}
      <div className="rounded-xl border border-[#1E3E62] bg-[#0B192C] p-5 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-xl bg-white p-0.5 shadow-md border border-white/20">
              <img
                src="/assets/aistudio/avatar_9eef1d34.png"
                alt="NEXADASH — Sistemas Inteligentes"
                className="h-full w-full object-contain rounded-lg"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold text-white">
                  Ciclo de Ativação & Liberação Manual de Acesso
                </h3>
                <Badge className="bg-[#FF6500] text-white text-[10px] font-bold">
                  Etapa 5 NEXADASH
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-white/75">
                Protocolo estrito de segurança institucional: Nenhum interessado libera sozinho o sistema,
                e nenhum vencimento provoca suspensão automática.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setContractModalOpen(true)}
            className="bg-[#FF6500] hover:bg-[#E55B00] text-white font-medium shrink-0"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Registrar Contratação (Passo 1)
          </Button>
        </div>

        {/* Régua dos 8 Passos do Ciclo */}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8 border-t border-white/10 pt-4 text-center text-[10px]">
          <div className="rounded bg-white/5 p-2">
            <span className="font-bold text-[#FF8C38]">1. Contratação</span>
            <p className="text-white/60">Cadastro comercial</p>
          </div>
          <div className="rounded bg-white/5 p-2">
            <span className="font-bold text-[#FF8C38]">2. Condições</span>
            <p className="text-white/60">Checklist acordado</p>
          </div>
          <div className="rounded bg-white/5 p-2">
            <span className="font-bold text-[#FF8C38]">3. Pagamento</span>
            <p className="text-white/60">Conciliação manual/on</p>
          </div>
          <div className="rounded bg-white/5 p-2">
            <span className="font-bold text-[#FF8C38]">4. Preparação</span>
            <p className="text-white/60">Setup da barbearia</p>
          </div>
          <div className="rounded bg-[#FF6500]/20 border border-[#FF6500]/40 p-2">
            <span className="font-bold text-white">5. Liberação</span>
            <p className="text-[#FF8C38]">Autorização manual</p>
          </div>
          <div className="rounded bg-white/5 p-2">
            <span className="font-bold text-[#FF8C38]">6. Auditoria</span>
            <p className="text-white/60">Responsável e vigência</p>
          </div>
          <div className="rounded bg-white/5 p-2">
            <span className="font-bold text-[#FF8C38]">7. Vencimentos</span>
            <p className="text-white/60">Acompanha pendências</p>
          </div>
          <div className="rounded bg-white/5 p-2">
            <span className="font-bold text-[#FF8C38]">8. Deliberação</span>
            <p className="text-white/60">Suspensão manual</p>
          </div>
        </div>
      </div>

      {/* CARDS DE MÉTRICAS OPERACIONAIS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm border-l-4 border-l-[#FF6500]">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">Aguardando Liberação</span>
            <Clock className="h-4 w-4 text-[#FF6500]" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">
            {metrics.pendingCount}
          </p>
          <p className="mt-1 text-[11px] text-amber-600 font-medium">
            {metrics.readyCount} pronta(s) para autorizar
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">Ativas & Homologadas</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">
            {metrics.activeCount}
          </p>
          <p className="mt-1 text-[11px] text-emerald-600 font-medium">
            Liberadas com assinatura do admin
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">Suspensões Administrativas</span>
            <AlertOctagon className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">
            {metrics.suspendedCount}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Deliberadas manualmente (sem corte auto)
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">Vencimentos Próx. 15 Dias</span>
            <Calendar className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">
            {metrics.upcomingDuesCount}
          </p>
          <p className="mt-1 text-[11px] text-blue-600 font-medium">
            Acompanhamento preventivo ativo
          </p>
        </div>
      </div>

      {/* FILTROS E PESQUISA */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/30 p-3 rounded-lg border">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por barbearia, e-mail ou titular..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Registros ({activations.length})</SelectItem>
              <SelectItem value="pending">Aguardando Liberação ({metrics.pendingCount})</SelectItem>
              <SelectItem value="ready">Prontas para Autorizar ({metrics.readyCount})</SelectItem>
              <SelectItem value="active">Ativas & Homologadas ({metrics.activeCount})</SelectItem>
              <SelectItem value="suspended">Suspensas Manualmente ({metrics.suspendedCount})</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* TABELA DO FLUXO DE ATIVAÇÃO MANUAL (PASSOS 1 A 8) */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-muted/20">
          <div>
            <h3 className="font-semibold text-sm">Controle das 8 Etapas de Liberação de Acesso</h3>
            <p className="text-xs text-muted-foreground">
              Acompanhamento de status, validação dos pré-requisitos e deliberação humana individual.
            </p>
          </div>
          <Badge variant="outline" className="text-xs bg-muted border-primary/20 text-foreground">
            Admin Logado: {adminEmail}
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/40 text-muted-foreground uppercase text-[10px]">
              <tr>
                <th className="p-3">Barbearia / Titular</th>
                <th className="p-3">Plano & Valor</th>
                <th className="p-3 text-center">2. Condições</th>
                <th className="p-3 text-center">3. Pagamento</th>
                <th className="p-3 text-center">4. Preparação</th>
                <th className="p-3">5. Situação do Acesso</th>
                <th className="p-3">6. Responsável / Vigência</th>
                <th className="p-3 text-right">Ações de Governança</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredList.map((item) => {
                const isReady =
                  item.activation_status === "pendente_liberacao_manual" &&
                  item.conditions_verified &&
                  item.payment_status === "pago_confirmado" &&
                  item.account_prepared;

                return (
                  <tr key={item.id} className="hover:bg-muted/20">
                    <td className="p-3">
                      <p className="font-semibold text-foreground flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-primary" /> {item.company_name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {item.owner_name} • {item.owner_email}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{item.city}</p>
                    </td>

                    <td className="p-3">
                      <span className="font-bold text-[#FF6500]">{item.plan_name}</span>
                      <p className="text-[11px] font-medium text-foreground">
                        {brl(item.contracted_value)}
                        <span className="text-[10px] text-muted-foreground font-normal">
                          /{item.billing_cycle === "anual" ? "ano" : "mês"}
                        </span>
                      </p>
                    </td>

                    {/* Passo 2: Condições Acordadas */}
                    <td className="p-3 text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openConditionsCheck(item)}
                        className="h-7 text-[10px] px-2 gap-1"
                      >
                        {item.conditions_verified ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                            <Check className="mr-1 h-3 w-3" /> Conforme
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                            <Clock className="mr-1 h-3 w-3" /> Conferir
                          </Badge>
                        )}
                      </Button>
                    </td>

                    {/* Passo 3: Pagamento */}
                    <td className="p-3 text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openPaymentCheck(item)}
                        className="h-7 text-[10px] px-2"
                      >
                        {item.payment_status === "pago_confirmado" ? (
                          <Badge className="bg-emerald-600 text-white text-[10px]">
                            <Check className="mr-1 h-3 w-3" /> Pago Confirmado
                          </Badge>
                        ) : item.payment_status === "em_analise" ? (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px]">
                            Em Análise
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">
                            Pendente
                          </Badge>
                        )}
                      </Button>
                      {item.payment_method && (
                        <p className="text-[9px] text-muted-foreground mt-0.5">{item.payment_method}</p>
                      )}
                    </td>

                    {/* Passo 4: Preparação da Conta */}
                    <td className="p-3 text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openPrepareAccount(item)}
                        className="h-7 text-[10px] px-2"
                      >
                        {item.account_prepared ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                            <Check className="mr-1 h-3 w-3" /> Preparada
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-zinc-500/10 text-zinc-600 border-zinc-500/30">
                            Pendente
                          </Badge>
                        )}
                      </Button>
                    </td>

                    {/* Passo 5: Situação do Acesso */}
                    <td className="p-3">
                      {item.activation_status === "autorizado_ativo" ? (
                        <div>
                          <Badge className="bg-emerald-600 text-white text-[10px]">
                            <ShieldCheck className="mr-1 h-3 w-3" /> Ativo Homologado
                          </Badge>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Liberado em {new Date(item.authorized_at || "").toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      ) : item.activation_status === "suspenso_manual" ? (
                        <div>
                          <Badge variant="destructive" className="text-[10px]">
                            <ShieldAlert className="mr-1 h-3 w-3" /> Suspenso Manual
                          </Badge>
                          <p className="text-[10px] text-rose-600 truncate max-w-[150px] mt-0.5" title={item.suspension_reason || ""}>
                            {item.suspension_reason}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              isReady
                                ? "bg-[#FF6500]/15 text-[#FF6500] border-[#FF6500]/40 font-semibold animate-pulse"
                                : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                            }`}
                          >
                            <Lock className="mr-1 h-3 w-3" />
                            {isReady ? "Pronto p/ Liberação" : "Aguardando Requisitos"}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Bloqueado no operacional
                          </p>
                        </div>
                      )}
                    </td>

                    {/* Passo 6: Responsável e Vigência */}
                    <td className="p-3">
                      <p className="text-[11px] font-medium text-foreground">
                        Até {new Date(item.valid_until).toLocaleDateString("pt-BR")}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                        Resp: {item.authorized_by_admin || "Aguardando deliberação"}
                      </p>
                      <p className="text-[9px] text-amber-600">
                        Próx. Cobrança: {new Date(item.next_due_date).toLocaleDateString("pt-BR")}
                      </p>
                    </td>

                    {/* Passo 8: Ações de Governança */}
                    <td className="p-3 text-right space-x-1 whitespace-nowrap">
                      {item.activation_status === "pendente_liberacao_manual" && (
                        <Button
                          size="sm"
                          onClick={() => openAuthorizeModal(item)}
                          className="bg-[#FF6500] hover:bg-[#E55B00] text-white text-xs h-8 px-3 font-medium"
                        >
                          <FileSignature className="mr-1.5 h-3.5 w-3.5" />
                          Autorizar Acesso
                        </Button>
                      )}

                      {item.activation_status === "autorizado_ativo" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openSuspendModal(item)}
                          className="text-rose-600 border-rose-300 hover:bg-rose-50 text-xs h-8"
                        >
                          <AlertOctagon className="mr-1 h-3.5 w-3.5" />
                          Suspender (Manual)
                        </Button>
                      )}

                      {item.activation_status === "suspenso_manual" && (
                        <Button
                          size="sm"
                          onClick={() => handleReactivateAccount(item)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                        >
                          <Unlock className="mr-1 h-3.5 w-3.5" />
                          Reativar Acesso
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedItem(item);
                          setDetailModalOpen(true);
                        }}
                        className="h-8 w-8 p-0"
                        title="Ver ficha completa"
                      >
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SEÇÃO DO PASSO 7: ACOMPANHAMENTO DE VENCIMENTOS E PENDÊNCIAS */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#FF6500]" />
            <div>
              <h4 className="font-semibold text-sm">Passo 7 — Acompanhamento de Vencimentos e Pendências</h4>
              <p className="text-xs text-muted-foreground">
                Monitoramento proativo das barbearias para suporte comercial e relacionamento
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs">
            🛡️ Suspensão Automática Desativada
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-2 text-xs">
          <div className="rounded-lg border bg-muted/20 p-3">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Política de Tolerância Comercial
            </span>
            <p className="mt-1 text-muted-foreground text-[11px] leading-relaxed">
              Vencimentos atrasados nunca derrubam o salão automaticamente. O administrador entra em contato,
              entende o cenário e, se necessário, aplica prorrogação ou delibera suspensão manual formal.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-500" /> Alertas Preventivos
            </span>
            <p className="mt-1 text-muted-foreground text-[11px] leading-relaxed">
              O sistema sinaliza faturas com 5 dias antes e 3 dias após o vencimento, permitindo à equipe
              comercial da NEXADASH oferecer suporte à barbearia antes de qualquer impacto.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <UserCheck className="h-4 w-4 text-primary" /> Auditoria Permanente de Deliberações
            </span>
            <p className="mt-1 text-muted-foreground text-[11px] leading-relaxed">
              Todas as ativações, manutenções de acesso e eventuais suspensões são gravadas com assinatura digital
              do administrador, data, hora, plano e vigência contratual.
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: REGISTRAR NOVA CONTRATAÇÃO (PASSO 1) */}
      {/* ========================================================================= */}
      <Dialog open={contractModalOpen} onOpenChange={setContractModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Passo 1 — Registrar Nova Contratação</DialogTitle>
            <DialogDescription>
              Inicia o ciclo de ativação de uma barbearia com a NEXADASH. O acesso permanecerá bloqueado
              até a conclusão de todas as etapas e deliberação manual.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateContract} className="space-y-3 text-xs">
            <div>
              <Label className="mb-1 block">Nome da Barbearia / Estabelecimento *</Label>
              <Input
                required
                placeholder="Ex: Barbearia Alfa & Ômega"
                value={newContract.company_name}
                onChange={(e) => setNewContract({ ...newContract, company_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="mb-1 block">Nome do Titular / Dono</Label>
                <Input
                  placeholder="Ex: Marcelo Costa"
                  value={newContract.owner_name}
                  onChange={(e) => setNewContract({ ...newContract, owner_name: e.target.value })}
                />
              </div>
              <div>
                <Label className="mb-1 block">E-mail do Titular (Login) *</Label>
                <Input
                  type="email"
                  required
                  placeholder="marcelo@alfa.com"
                  value={newContract.owner_email}
                  onChange={(e) => setNewContract({ ...newContract, owner_email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="mb-1 block">Telefone / WhatsApp</Label>
                <Input
                  placeholder="11999998888"
                  value={newContract.phone}
                  onChange={(e) => setNewContract({ ...newContract, phone: e.target.value })}
                />
              </div>
              <div>
                <Label className="mb-1 block">Cidade / UF</Label>
                <Input
                  placeholder="Campinas - SP"
                  value={newContract.city}
                  onChange={(e) => setNewContract({ ...newContract, city: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="mb-1 block">Plano Contratado</Label>
                <Select
                  value={newContract.plan_name}
                  onValueChange={(v) => {
                    const price = v === "NEXADASH START" ? "29.90" : v === "NEXADASH IA" ? "99.90" : v === "NEXADASH BUSINESS" ? "169.00" : "59.90";
                    setNewContract({ ...newContract, plan_name: v, contracted_value: price });
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
                <Label className="mb-1 block">Valor Contratado (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={newContract.contracted_value}
                  onChange={(e) => setNewContract({ ...newContract, contracted_value: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="mb-1 block">Periodicidade</Label>
                <Select
                  value={newContract.billing_cycle}
                  onValueChange={(v) => setNewContract({ ...newContract, billing_cycle: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block">Vigência Inicial Até</Label>
                <Input
                  type="date"
                  required
                  value={newContract.valid_until}
                  onChange={(e) => setNewContract({ ...newContract, valid_until: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setContractModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-[#FF6500] hover:bg-[#E55B00] text-white">
                Registrar Contratação
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 2: CONFERIR CONDIÇÕES ACORDADAS (PASSO 2) */}
      {/* ========================================================================= */}
      <Dialog open={conditionsModalOpen} onOpenChange={setConditionsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Passo 2 — Conferência de Condições Acordadas</DialogTitle>
            <DialogDescription>
              {selectedItem?.company_name} — Plano {selectedItem?.plan_name} ({brl(selectedItem?.contracted_value)})
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveConditions} className="space-y-4 text-xs">
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={conditionsForm.terms_accepted}
                  onChange={(e) => setConditionsForm({ ...conditionsForm, terms_accepted: e.target.checked })}
                  className="rounded border-muted-foreground/30 text-primary"
                />
                <span>Termos de uso do software BELEZI e política de privacidade validados</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={conditionsForm.limits_verified}
                  onChange={(e) => setConditionsForm({ ...conditionsForm, limits_verified: e.target.checked })}
                  className="rounded border-muted-foreground/30 text-primary"
                />
                <span>Limite de profissionais e módulos contratados correspondentes ao plano</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={conditionsForm.special_discount_confirmed}
                  onChange={(e) =>
                    setConditionsForm({ ...conditionsForm, special_discount_confirmed: e.target.checked })
                  }
                  className="rounded border-muted-foreground/30 text-primary"
                />
                <span>Descontos promocionais e condições comerciais homologadas pelo comitê</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={conditionsForm.legal_rep_identified}
                  onChange={(e) =>
                    setConditionsForm({ ...conditionsForm, legal_rep_identified: e.target.checked })
                  }
                  className="rounded border-muted-foreground/30 text-primary"
                />
                <span>Identificação do responsável legal e canal prioritário confirmados</span>
              </label>
            </div>

            <div>
              <Label className="mb-1 block">Anotações da Conferência</Label>
              <Textarea
                rows={3}
                placeholder="Ex: Ajustado para 3 barbeiros com suporte prioritário WhatsApp incluso..."
                value={conditionsForm.notes}
                onChange={(e) => setConditionsForm({ ...conditionsForm, notes: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConditionsModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-[#0B192C] hover:bg-[#1E3E62] text-white">
                Salvar Conferência
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 3: SITUAÇÃO DO PAGAMENTO CONFORME CONTRATO (PASSO 3) */}
      {/* ========================================================================= */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Passo 3 — Situação do Pagamento Conforme Contrato</DialogTitle>
            <DialogDescription>
              {selectedItem?.company_name} — Valor Contratado: {brl(selectedItem?.contracted_value)}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSavePayment} className="space-y-3 text-xs">
            <div>
              <Label className="mb-1 block">Situação Atual da Cobrança *</Label>
              <Select
                value={paymentForm.status}
                onValueChange={(v: AccountActivationItem["payment_status"]) =>
                  setPaymentForm({ ...paymentForm, status: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pago_confirmado">Pago & Confirmado (Liquidação Verificada)</SelectItem>
                  <SelectItem value="em_analise">Em Análise de Compensação Bancária</SelectItem>
                  <SelectItem value="isento_cortesia">Isento / Cortesia Comercial Homologada</SelectItem>
                  <SelectItem value="pendente">Pendente de Pagamento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1 block">Método de Liquidação</Label>
              <Input
                placeholder="Ex: Pix Banco Inter, Cartão Mercado Pago, Boleto Compensado"
                value={paymentForm.method}
                onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
              />
            </div>

            <div>
              <Label className="mb-1 block">Código de Autenticação / Transação Bancária</Label>
              <Input
                placeholder="Ex: E2E-994827103 ou ID Mercado Pago"
                value={paymentForm.reference}
                onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
              />
            </div>

            <div className="rounded border bg-amber-500/10 p-3 text-amber-800 dark:text-amber-300 text-[11px]">
              <strong>Atenção de Segurança:</strong> Mesmo que o pagamento seja registrado como "Pago Confirmado",
              o sistema NÃO libera o acesso automaticamente. A liberação continua dependendo exclusivamente da
              autorização manual no Passo 5.
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPaymentModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-[#0B192C] hover:bg-[#1E3E62] text-white">
                Gravar Situação
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 4: PREPARAR CONTA DA BARBEARIA (PASSO 4) */}
      {/* ========================================================================= */}
      <Dialog open={prepareAccountModalOpen} onOpenChange={setPrepareAccountModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Passo 4 — Preparar Conta da Barbearia</DialogTitle>
            <DialogDescription>
              {selectedItem?.company_name} — Setup dos dados operacionais e catálogo inicial.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSavePrepareAccount} className="space-y-4 text-xs">
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prepareForm.catalog_loaded}
                  onChange={(e) => setPrepareForm({ ...prepareForm, catalog_loaded: e.target.checked })}
                  className="rounded border-muted-foreground/30 text-primary"
                />
                <span>Catálogo de serviços e produtos base provisionado no perfil da barbearia</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prepareForm.settings_configured}
                  onChange={(e) => setPrepareForm({ ...prepareForm, settings_configured: e.target.checked })}
                  className="rounded border-muted-foreground/30 text-primary"
                />
                <span>Dados de endereço, localização e link do Google Maps configurados</span>
              </label>
            </div>

            <div>
              <Label className="mb-1 block">Observações do Onboarding / Preparação</Label>
              <Textarea
                rows={3}
                value={prepareForm.notes}
                onChange={(e) => setPrepareForm({ ...prepareForm, notes: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPrepareAccountModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-[#0B192C] hover:bg-[#1E3E62] text-white">
                Salvar Preparação
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 5 & 6: AUTORIZAR MANUALMENTE A ATIVAÇÃO (PASSOS 5 E 6) */}
      {/* ========================================================================= */}
      <Dialog open={authorizeModalOpen} onOpenChange={setAuthorizeModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <ShieldCheck className="h-5 w-5 text-[#FF6500]" />
              Passos 5 e 6 — Autorização Manual de Acesso NEXADASH
            </DialogTitle>
            <DialogDescription>
              Liberação solene do sistema operacional para o cliente {selectedItem?.company_name}.
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <form onSubmit={handleExecuteManualAuthorization} className="space-y-4 text-xs">
              {/* Resumo dos Requisitos Prévios */}
              <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
                <div className="flex justify-between items-center border-b pb-1.5">
                  <span className="text-muted-foreground">1. Contratação Registrada:</span>
                  <span className="font-semibold">{selectedItem.company_name} ({selectedItem.plan_name})</span>
                </div>
                <div className="flex justify-between items-center border-b pb-1.5">
                  <span className="text-muted-foreground">2. Condições Acordadas:</span>
                  <span className={selectedItem.conditions_verified ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                    {selectedItem.conditions_verified ? "✅ Conferidas" : "⚠️ Pendente"}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b pb-1.5">
                  <span className="text-muted-foreground">3. Situação do Pagamento:</span>
                  <span className={selectedItem.payment_status === "pago_confirmado" ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                    {selectedItem.payment_status === "pago_confirmado" ? "✅ Pago Confirmado" : "⚠️ Em Aberto"}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b pb-1.5">
                  <span className="text-muted-foreground">4. Preparação da Conta:</span>
                  <span className={selectedItem.account_prepared ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                    {selectedItem.account_prepared ? "✅ Pronta" : "⚠️ Não Provisionada"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Vigência Homologada:</span>
                  <span className="font-bold text-foreground">Até {new Date(selectedItem.valid_until).toLocaleDateString("pt-BR")}</span>
                </div>
              </div>

              <div>
                <Label className="mb-1 block font-semibold text-foreground">
                  Responsável pela Autorização (Administrador NEXADASH) *
                </Label>
                <Input
                  required
                  value={authorizeForm.admin_signature}
                  onChange={(e) => setAuthorizeForm({ ...authorizeForm, admin_signature: e.target.value })}
                />
              </div>

              <div>
                <Label className="mb-1 block">Despacho / Parecer da Deliberação</Label>
                <Textarea
                  rows={2}
                  value={authorizeForm.deliberation_notes}
                  onChange={(e) => setAuthorizeForm({ ...authorizeForm, deliberation_notes: e.target.value })}
                />
              </div>

              {/* Termo de Responsabilidade Obrigatório */}
              <div className="rounded-lg border border-[#FF6500]/30 bg-[#FF6500]/5 p-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={authorizeForm.agreement}
                    onChange={(e) => setAuthorizeForm({ ...authorizeForm, agreement: e.target.checked })}
                    className="mt-0.5 rounded border-muted-foreground/30 text-[#FF6500]"
                  />
                  <span className="text-[11px] text-foreground leading-snug">
                    <strong>Declaração de Liberação Manual:</strong> Eu, como administrador credenciado da NEXADASH,
                    atesto que conferi os requisitos contratuais, a situação financeira e autorizo manualmente
                    a concessão imediata de acesso ao sistema operacional BELEZI para esta empresa.
                  </span>
                </label>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAuthorizeModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-[#FF6500] hover:bg-[#E55B00] text-white font-semibold">
                  Confirmar e Liberar Acesso Manualmente
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 8: SUSPENSÃO MANUAL POR DECISÃO ADMINISTRATIVA (PASSO 8) */}
      {/* ========================================================================= */}
      <Dialog open={suspendModalOpen} onOpenChange={setSuspendModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <ShieldAlert className="h-5 w-5" />
              Passo 8 — Deliberação Manual de Suspensão
            </DialogTitle>
            <DialogDescription>
              {selectedItem?.company_name} — Suspensão deliberada por administrador autorizado.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleExecuteManualSuspension} className="space-y-4 text-xs">
            <div className="rounded border bg-rose-500/10 p-3 text-rose-800 dark:text-rose-300 text-[11px]">
              <strong>Governança:</strong> Nenhum vencimento ou fatura gera corte automático. A suspensão
              deve ser uma decisão humana fundamentada, ficando permanentemente registrada em logs de auditoria.
            </div>

            <div>
              <Label className="mb-1 block font-semibold text-foreground">
                Justificativa Formal da Suspensão *
              </Label>
              <Textarea
                required
                rows={3}
                placeholder="Descreva o motivo (ex: Inadimplência superior a 30 dias sem retorno a 3 contatos de negociação)..."
                value={suspendForm.reason}
                onChange={(e) => setSuspendForm({ ...suspendForm, reason: e.target.value })}
              />
            </div>

            <div>
              <Label className="mb-1 block">Administrador Deliberante *</Label>
              <Input
                required
                value={suspendForm.admin_signature}
                onChange={(e) => setSuspendForm({ ...suspendForm, admin_signature: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSuspendModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="destructive">
                Confirmar Suspensão Manual
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: FICHA COMPLETA DE AUDITORIA */}
      {/* ========================================================================= */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ficha de Auditoria do Cliente</DialogTitle>
            <DialogDescription>
              {selectedItem?.company_name} • Registro: {selectedItem?.id}
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-3 text-xs">
              <div className="rounded-lg border p-3 space-y-1.5 bg-muted/20">
                <p><strong>Titular:</strong> {selectedItem.owner_name} ({selectedItem.owner_email})</p>
                <p><strong>Telefone:</strong> {selectedItem.phone || "—"} | <strong>Cidade:</strong> {selectedItem.city}</p>
                <p><strong>Plano:</strong> {selectedItem.plan_name} — {brl(selectedItem.contracted_value)}/{selectedItem.billing_cycle}</p>
                <p><strong>Início:</strong> {new Date(selectedItem.started_at).toLocaleDateString("pt-BR")}</p>
                <p><strong>Vigência Até:</strong> {new Date(selectedItem.valid_until).toLocaleDateString("pt-BR")}</p>
                <p><strong>Próximo Vencimento:</strong> {new Date(selectedItem.next_due_date).toLocaleDateString("pt-BR")}</p>
              </div>

              <div className="rounded-lg border p-3 space-y-1.5 bg-muted/20">
                <p className="font-semibold text-foreground">Histórico de Liberação e Governança:</p>
                <p>
                  <strong>Status Atual:</strong>{" "}
                  <Badge className="capitalize text-[10px]">{selectedItem.activation_status.replace(/_/g, " ")}</Badge>
                </p>
                {selectedItem.authorized_by_admin && (
                  <p>
                    <strong>Autorizado Por:</strong> {selectedItem.authorized_by_admin} em{" "}
                    {new Date(selectedItem.authorized_at || "").toLocaleString("pt-BR")}
                  </p>
                )}
                {selectedItem.deliberation_notes && (
                  <p className="text-muted-foreground italic">"{selectedItem.deliberation_notes}"</p>
                )}
                {selectedItem.suspended_by_admin && (
                  <div className="rounded bg-rose-500/10 p-2 text-rose-700 dark:text-rose-400">
                    <p><strong>Suspenso Por:</strong> {selectedItem.suspended_by_admin}</p>
                    <p><strong>Motivo:</strong> {selectedItem.suspension_reason}</p>
                    <p><strong>Data:</strong> {new Date(selectedItem.suspended_at || "").toLocaleString("pt-BR")}</p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailModalOpen(false)}>
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
