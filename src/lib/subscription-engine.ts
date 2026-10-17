import type {
  ClientSubscription,
  SalonClientPlan,
  SubscriptionCreditValidation,
  SubscriptionModel,
} from "@/types/subscription";

export const MODEL_LABELS: Record<SubscriptionModel, { label: string; badgeColor: string; description: string }> = {
  one: {
    label: "Plano One (1 Corte/mês)",
    badgeColor: "bg-blue-600 text-white",
    description: "Regra estrita de exatamente 1 corte por mês com renovação automática.",
  },
  recorrente: {
    label: "Recorrente",
    badgeColor: "bg-emerald-600 text-white",
    description: "Franquia mensal fixa de atendimentos (ex: 2 ou 4 cortes/mês).",
  },
  ilimitado: {
    label: "Ilimitado",
    badgeColor: "bg-amber-600 text-white",
    description: "Cortes e atendimentos ilimitados durante toda a vigência.",
  },
  vip: {
    label: "Clube VIP",
    badgeColor: "bg-purple-600 text-white",
    description: "Atendimento ilimitado, encaixe simultâneo autorizado e prioridade máxima.",
  },
  avulso: {
    label: "Pacote Avulso",
    badgeColor: "bg-slate-600 text-white",
    description: "Atendimento avulso ou pacote pré-pago sem mensalidade fixa.",
  },
};

/** Valida se o cliente possui créditos ativos na sua assinatura para cobrir o atendimento */
export function validateSubscriptionForBooking({
  subscription,
  serviceId,
  isVipRequested = false,
}: {
  subscription?: ClientSubscription | null;
  serviceId?: string | null;
  isVipRequested?: boolean;
}): SubscriptionCreditValidation {
  if (!subscription) {
    return {
      isCovered: false,
      canBook: true,
      requiresExtraPayment: true,
      creditsRemaining: 0,
      reasonMessage: "Cliente sem plano ativo. O serviço será cobrado avulso.",
      isVipOverrideAllowed: false,
    };
  }

  // Verifica status da assinatura
  if (subscription.status !== "ativa") {
    const statusMessages = {
      pausada: "Assinatura do cliente está pausada temporariamente.",
      cancelada: "Assinatura cancelada.",
      inadimplente: "Assinatura com pagamento pendente/inadimplente.",
    };
    return {
      isCovered: false,
      canBook: true,
      requiresExtraPayment: true,
      creditsRemaining: 0,
      reasonMessage: statusMessages[subscription.status] || "Assinatura inativa.",
      isVipOverrideAllowed: false,
    };
  }

  // Verifica validade (vencimento do ciclo)
  const now = new Date();
  const renewalDate = new Date(subscription.renews_at);
  if (renewalDate.getTime() <= now.getTime()) {
    return {
      isCovered: false,
      canBook: true,
      requiresExtraPayment: true,
      creditsRemaining: 0,
      reasonMessage: `Ciclo da assinatura expirou em ${renewalDate.toLocaleDateString("pt-BR")}. Necessária renovação.`,
      isVipOverrideAllowed: false,
    };
  }

  const plan = subscription.plan;
  const model = plan?.model || "recorrente";

  // Modelo ONE: Exatamente 1 corte por mês
  if (model === "one") {
    const used = subscription.credits_used_this_period || 0;
    if (used >= 1) {
      return {
        isCovered: false,
        canBook: true,
        requiresExtraPayment: true,
        creditsRemaining: 0,
        reasonMessage: "Limite do Plano One atingido: 1 de 1 corte já utilizado neste ciclo mensal.",
        isVipOverrideAllowed: false,
      };
    }
    return {
      isCovered: true,
      canBook: true,
      requiresExtraPayment: false,
      creditsRemaining: 1 - used,
      reasonMessage: "Atendimento 100% coberto pelo Plano One (1 corte mensal disponível).",
      isVipOverrideAllowed: false,
    };
  }

  // Modelo RECORRENTE: Franquia fixa de créditos
  if (model === "recorrente") {
    const limit = plan?.monthly_credit_limit || 2;
    const used = subscription.credits_used_this_period || 0;
    const remaining = Math.max(0, limit - used);

    if (remaining <= 0) {
      return {
        isCovered: false,
        canBook: true,
        requiresExtraPayment: true,
        creditsRemaining: 0,
        reasonMessage: `Limite mensal da assinatura atingido (${used}/${limit} créditos utilizados).`,
        isVipOverrideAllowed: false,
      };
    }
    return {
      isCovered: true,
      canBook: true,
      requiresExtraPayment: false,
      creditsRemaining: remaining,
      reasonMessage: `Atendimento coberto pela assinatura (${remaining} de ${limit} créditos restantes no ciclo).`,
      isVipOverrideAllowed: false,
    };
  }

  // Modelo ILIMITADO: Cortes ilimitados durante o mês
  if (model === "ilimitado") {
    return {
      isCovered: true,
      canBook: true,
      requiresExtraPayment: false,
      creditsRemaining: "ilimitado",
      reasonMessage: "Atendimento 100% coberto pelo Plano Ilimitado.",
      isVipOverrideAllowed: false,
    };
  }

  // Modelo VIP: Ilimitado + Prioridade + Encaixe simultâneo
  if (model === "vip") {
    return {
      isCovered: true,
      canBook: true,
      requiresExtraPayment: false,
      creditsRemaining: "ilimitado",
      reasonMessage: "Atendimento coberto com privilégios de Clube VIP e prioridade de agenda.",
      isVipOverrideAllowed: true,
    };
  }

  // Modelo AVULSO
  return {
    isCovered: false,
    canBook: true,
    requiresExtraPayment: true,
    creditsRemaining: 0,
    reasonMessage: "Cobrança avulsa conforme tabela do salão.",
    isVipOverrideAllowed: false,
  };
}
