import type {
  AutomationSettingsData,
  AutomationTemplates,
  AutomationTriggerType,
  BirthdayClientCandidate,
  InactiveClientCandidate,
  ProductReorderCandidate,
  SubscriptionDueCandidate,
} from "@/types/automation";
import { brl, fmtDate, fmtTime } from "@/lib/db";

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettingsData = {
  reminder_enabled: true,
  reminder_hours_before: 2,
  birthday_enabled: true,
  birthday_coupon_text: "Ganhe 15% de desconto no seu corte neste mês de aniversário!",
  inactive_clients_days: 35,
  inactive_coupon_text:
    "Estamos com saudades! Agende seu horário nesta semana e ganhe um café especial ou cerveja por nossa conta.",
  product_reorder_enabled: true,
  product_reorder_days: 40,
  product_reorder_message:
    "Notamos que já faz um tempinho desde a sua última pomada/óleo de barba. Que tal garantir a reposição do seu produto favorito?",
  subscription_notice_enabled: true,
  subscription_notice_days_before: 3,
  no_show_tolerance_minutes: 15,
  max_no_shows_before_block: 2,
  no_show_fee: 0,
  require_advance_payment_blocked: true,
  custom_templates: {
    lembrete:
      "Olá, {{cliente}}! ⏰ Passando para lembrar do seu horário hoje na {{barbearia}} às {{horario}} com {{barbeiro}}. Podemos confirmar?",
    confirmacao:
      "Olá, {{cliente}}! 💈 Seu agendamento na {{barbearia}} está confirmado para {{data}} às {{horario}} com {{barbeiro}}. Te esperamos!",
    aniversario:
      "Fala {{cliente}}, parabéns pelo seu dia! 🎉 A equipe da {{barbearia}} deseja muito sucesso. Como presente: {{cupom}}",
    recuperacao:
      "Fala {{cliente}}, tudo bem? Faz tempo que você não cuida do visual aqui na {{barbearia}}! ✂️ {{cupom}} Vamos agendar?",
    cobranca_plano:
      "Olá, {{cliente}}! Seu plano {{plano}} na {{barbearia}} vence em {{vencimento}}. Valor: R$ {{valor}}. Chave PIX: {{pix}}. Qualquer dúvida estamos à disposição!",
    recompra_produto:
      "Fala {{cliente}}! Seu produto {{produto}} já deve estar no finalzinho. 🧴 Passa aqui na {{barbearia}} para repor ou peça pelo WhatsApp!",
    falta_aviso:
      "Olá, {{cliente}}. Notamos que você não pôde comparecer ao agendamento de {{data}} na {{barbearia}}. Para reagendar sem pendências, entre em contato conosco.",
    pos_atendimento:
      "Olá, {{cliente}}! ⭐ Como foi seu atendimento hoje na {{barbearia}} com {{barbeiro}}? Dê uma nota de 1 a 5 para nossa equipe e garanta 10% de desconto no próximo retorno!",
  },
};

/**
 * Normaliza número de telefone brasileiro para formato internacional E.164 sem caracteres especiais
 */
export function formatWhatsAppPhone(raw?: string | null): string {
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 || digits.length === 11) {
    digits = "55" + digits;
  }
  return digits.length >= 12 ? digits : "";
}

/**
 * Gera link oficial do WhatsApp direto com mensagem pré-formatada
 */
export function generateWhatsAppUrl(phone: string, message: string): string {
  const cleanPhone = formatWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(message);
  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
}

/**
 * Substitui marcadores dinâmicos no template de mensagem
 */
export function replaceTemplatePlaceholders(
  template: string,
  variables: Record<string, string | number | undefined | null>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(placeholder, String(value ?? ""));
  }
  return result;
}

/**
 * Constrói a mensagem final do WhatsApp para o gatilho solicitado
 */
export function buildAutomatedWhatsAppMessage(
  triggerType: AutomationTriggerType,
  templates: AutomationTemplates,
  variables: {
    cliente?: string;
    barbearia?: string;
    barbeiro?: string;
    data?: string;
    horario?: string;
    servico?: string;
    cupom?: string;
    plano?: string;
    valor?: string;
    vencimento?: string;
    pix?: string;
    produto?: string;
  },
): string {
  const defaultTemplates = DEFAULT_AUTOMATION_SETTINGS.custom_templates;
  let template = templates[triggerType] || defaultTemplates[triggerType];

  if (!template) {
    if (triggerType === "lembrete_agendamento") {
      template = defaultTemplates.lembrete!;
    } else if (triggerType === "confirmacao") {
      template = defaultTemplates.confirmacao!;
    } else if (triggerType === "aniversario") {
      template = defaultTemplates.aniversario!;
    } else if (triggerType === "recuperacao_inativo") {
      template = defaultTemplates.recuperacao!;
    } else if (triggerType === "cobranca_plano") {
      template = defaultTemplates.cobranca_plano!;
    } else if (triggerType === "recompra_produto") {
      template = defaultTemplates.recompra_produto!;
    } else if (triggerType === "aviso_falta") {
      template = defaultTemplates.falta_aviso!;
    } else if (triggerType === "pos_atendimento") {
      template = defaultTemplates.pos_atendimento!;
    } else {
      template = "Olá {{cliente}}, mensagem da barbearia {{barbearia}}.";
    }
  }

  return replaceTemplatePlaceholders(template, {
    cliente: variables.cliente ? variables.cliente.split(" ")[0] : "Amigo",
    barbearia: variables.barbearia || "Belezi Barbearia",
    barbeiro: variables.barbeiro || "nossa equipe",
    data: variables.data || "",
    horario: variables.horario || "",
    servico: variables.servico || "",
    cupom: variables.cupom || "",
    plano: variables.plano || "",
    valor: variables.valor || "",
    vencimento: variables.vencimento || "",
    pix: variables.pix || variables.barbearia || "",
    produto: variables.produto || "produto",
  });
}

/**
 * Identifica clientes inativos (sem corte há mais de X dias)
 */
export function detectInactiveClients(
  clients: any[],
  orders: any[],
  inactiveDaysThreshold = 35,
  currentDate = new Date(),
): InactiveClientCandidate[] {
  const candidates: InactiveClientCandidate[] = [];

  for (const client of clients) {
    // Buscar a data do último atendimento / comanda fechada
    const clientOrders = orders
      .filter((o) => o.client_id === client.id && o.status === "fechada")
      .sort((a, b) => new Date(b.closed_at || b.created_at).getTime() - new Date(a.closed_at || a.created_at).getTime());

    let lastVisitDate: Date | null = null;
    let totalSpent = 0;

    if (clientOrders.length > 0) {
      lastVisitDate = new Date(clientOrders[0].closed_at || clientOrders[0].created_at);
      totalSpent = clientOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    } else if (client.last_service_date) {
      lastVisitDate = new Date(client.last_service_date);
    } else if (client.created_at) {
      lastVisitDate = new Date(client.created_at);
    }

    if (!lastVisitDate) continue;

    const diffDays = Math.floor(
      (currentDate.getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays >= inactiveDaysThreshold) {
      candidates.push({
        id: client.id,
        name: client.name,
        phone: client.phone,
        last_service_date: lastVisitDate.toISOString().slice(0, 10),
        days_inactive: diffDays,
        total_spent: totalSpent,
        total_visits: clientOrders.length,
      });
    }
  }

  return candidates.sort((a, b) => b.days_inactive - a.days_inactive);
}

/**
 * Identifica clientes que compraram produtos há mais de X dias para sugerir recompra
 */
export function detectProductReorders(
  orderItems: any[],
  orders: any[],
  clients: any[],
  reorderDaysThreshold = 40,
  currentDate = new Date(),
): ProductReorderCandidate[] {
  const candidates: ProductReorderCandidate[] = [];

  // Itens de produtos vendidos
  const productItems = orderItems.filter((i) => i.kind === "produto");

  for (const item of productItems) {
    const order = orders.find((o) => o.id === item.order_id && o.status === "fechada");
    if (!order || !order.client_id) continue;

    const client = clients.find((c) => c.id === order.client_id);
    if (!client) continue;

    const purchaseDate = new Date(order.closed_at || order.created_at);
    const diffDays = Math.floor(
      (currentDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays >= reorderDaysThreshold) {
      // Evitar duplicar mesmo produto para mesmo cliente
      const exists = candidates.some(
        (c) => c.client_name === client.name && c.product_name === item.description,
      );
      if (!exists) {
        candidates.push({
          id: `${order.id}-${item.id}`,
          client_name: client.name,
          client_phone: client.phone,
          product_name: item.description,
          purchase_date: purchaseDate.toISOString().slice(0, 10),
          days_since_purchase: diffDays,
        });
      }
    }
  }

  return candidates.sort((a, b) => b.days_since_purchase - a.days_since_purchase);
}

/**
 * Identifica clientes aniversariantes da semana ou do mês
 */
export function detectUpcomingBirthdays(
  clients: any[],
  currentDate = new Date(),
): BirthdayClientCandidate[] {
  const currentMonth = currentDate.getMonth() + 1;
  const currentDay = currentDate.getDate();

  const candidates: BirthdayClientCandidate[] = [];

  for (const client of clients) {
    if (!client.birth_date) continue;

    const [bYear, bMonth, bDay] = client.birth_date.split("-").map(Number);
    if (!bMonth || !bDay) continue;

    const isToday = bMonth === currentMonth && bDay === currentDay;
    const isThisMonth = bMonth === currentMonth;

    if (isThisMonth) {
      const age = bYear ? currentDate.getFullYear() - bYear : undefined;
      candidates.push({
        id: client.id,
        name: client.name,
        phone: client.phone,
        birth_date: client.birth_date,
        is_today: isToday,
        is_this_week: Math.abs(bDay - currentDay) <= 3,
        age,
      });
    }
  }

  return candidates.sort((a, b) => (a.is_today ? -1 : 1));
}

/**
 * Identifica assinaturas próximas ao vencimento para cobrança
 */
export function detectUpcomingSubscriptionDues(
  subscriptions: any[],
  daysBeforeNotice = 3,
  currentDate = new Date(),
): SubscriptionDueCandidate[] {
  const candidates: SubscriptionDueCandidate[] = [];

  for (const sub of subscriptions) {
    if (sub.status !== "ativa" || !sub.renews_at) continue;

    const renewsDate = new Date(sub.renews_at);
    const diffDays = Math.ceil(
      (renewsDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays >= 0 && diffDays <= daysBeforeNotice) {
      candidates.push({
        id: sub.id,
        subscription_id: sub.id,
        client_name: sub.clients?.name || "Cliente",
        client_phone: sub.clients?.phone,
        plan_name: sub.plans?.name || "Plano Barbearia",
        plan_price: Number(sub.plans?.price || 0),
        renews_at: sub.renews_at.slice(0, 10),
        days_until_due: diffDays,
      });
    }
  }

  return candidates.sort((a, b) => a.days_until_due - b.days_until_due);
}
