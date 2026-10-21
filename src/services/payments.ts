/**
 * PODIUM PAY — SERVIÇO DE PAGAMENTOS DIGITAIS, SPLIT E ANTECIPAÇÃO
 * Arquitetura de processamento de pagamentos para o ecossistema BELEZI & NEXADASH
 */

export type PodiumPaymentMethod =
  | "pix"
  | "cartao_debito"
  | "cartao_credito_vista"
  | "cartao_credito_parcelado"
  | "dinheiro";

export type FeeAbsorberPolicy = "salon_absorbs" | "proportional" | "split_half";

export interface PodiumPayRates {
  pixFeePct: number;
  debitoFeePct: number;
  creditoVistaFeePct: number;
  creditoParceladoFeePct: number;
  anticipationMonthlyRatePct: number;
  feePolicy: FeeAbsorberPolicy;
}

export const DEFAULT_PODIUM_PAY_RATES: PodiumPayRates = {
  pixFeePct: 0.99,
  debitoFeePct: 1.49,
  creditoVistaFeePct: 2.99,
  creditoParceladoFeePct: 4.49,
  anticipationMonthlyRatePct: 1.79,
  feePolicy: "salon_absorbs",
};

export interface OrderItemForSplit {
  id?: string;
  professional_id?: string;
  professional_name?: string;
  description?: string;
  kind?: string;
  qty: number;
  unit_price: number;
  commission_pct: number;
}

export interface ProfessionalSplitShare {
  proId: string;
  proName: string;
  grossCommission: number;
  feeShare: number;
  netCommission: number;
  percentageOfGross: number;
}

export interface SplitCalculationResult {
  grossTotal: number;
  paymentMethod: string;
  feePct: number;
  feeAmount: number;
  netTotal: number;
  salonGross: number;
  salonFeeShare: number;
  salonNet: number;
  professionals: ProfessionalSplitShare[];
}

export interface FutureReceivable {
  id: string;
  orderId?: string;
  orderNumber?: number;
  clientName?: string;
  date: string;
  dueDate: string;
  amount: number;
  paymentMethod: string;
  installments?: number;
  status: "a_receber" | "antecipado" | "liquidado";
}

export interface AnticipationSimulationResult {
  totalGross: number;
  averageDaysAnticipated: number;
  totalDiscount: number;
  netAmountToReceive: number;
  eligibleCount: number;
}

const STORAGE_RATES_KEY = "belezi_podium_pay_rates";
const STORAGE_RECEIVABLES_KEY = "belezi_podium_pay_receivables";

/**
 * Carrega taxas do Podium Pay do armazenamento local com fallback seguro
 */
export function loadPodiumPayRates(): PodiumPayRates {
  try {
    const raw = localStorage.getItem(STORAGE_RATES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_PODIUM_PAY_RATES,
        ...parsed,
      };
    }
  } catch {
    // fallback se houver falha de parse
  }
  return { ...DEFAULT_PODIUM_PAY_RATES };
}

/**
 * Salva taxas customizadas do Podium Pay
 */
export function savePodiumPayRates(rates: Partial<PodiumPayRates>): PodiumPayRates {
  const current = loadPodiumPayRates();
  const updated: PodiumPayRates = {
    ...current,
    ...rates,
  };
  try {
    localStorage.setItem(STORAGE_RATES_KEY, JSON.stringify(updated));
  } catch {
    // ignora falha em ambientes sem localStorage
  }
  return updated;
}

/**
 * Obtém a taxa aplicável ao método de pagamento
 */
export function getPaymentMethodFeePct(
  method: string,
  rates: PodiumPayRates = loadPodiumPayRates(),
): number {
  const m = String(method || "").toLowerCase();
  if (m.includes("pix")) return rates.pixFeePct ?? 0.99;
  if (m.includes("débito") || m.includes("debito")) return rates.debitoFeePct ?? 1.49;
  if (m.includes("parcelado")) return rates.creditoParceladoFeePct ?? 4.49;
  if (m.includes("crédito") || m.includes("credito")) return rates.creditoVistaFeePct ?? 2.99;
  return 0; // Dinheiro ou outros sem taxa
}

/**
 * Realiza o cálculo do Split de Recebíveis entre Salão e Profissionais com divisão de taxas
 */
export function calculatePaymentSplit(
  items: OrderItemForSplit[],
  grossTotal: number,
  paymentMethod: string,
  rates: PodiumPayRates = loadPodiumPayRates(),
): SplitCalculationResult {
  const feePct = getPaymentMethodFeePct(paymentMethod, rates);
  const feeAmount = (grossTotal * feePct) / 100;
  const netTotal = Math.max(grossTotal - feeAmount, 0);

  // Agrupar comissões brutas por profissional
  const proMap = new Map<
    string,
    {
      proId: string;
      proName: string;
      grossCommission: number;
    }
  >();

  for (const item of items ?? []) {
    const proId = item.professional_id || "sem_profissional";
    const proName = item.professional_name || "Profissional Geral";
    const itemTotal = Number(item.qty || 0) * Number(item.unit_price || 0);
    const commPct = Number(item.commission_pct || 0);
    const comm = (itemTotal * commPct) / 100;

    const current = proMap.get(proId) || { proId, proName, grossCommission: 0 };
    current.grossCommission += comm;
    if (item.professional_name) current.proName = item.professional_name;
    proMap.set(proId, current);
  }

  const totalCommissionsGross = Array.from(proMap.values()).reduce(
    (acc, p) => acc + p.grossCommission,
    0,
  );
  const salonGross = Math.max(grossTotal - totalCommissionsGross, 0);

  // Divisão das taxas de acordo com a política
  let salonFeeShare = feeAmount;
  const proShares: ProfessionalSplitShare[] = [];

  if (rates.feePolicy === "salon_absorbs" || grossTotal <= 0) {
    // O salão assume toda a taxa; profissionais recebem comissão integral
    salonFeeShare = feeAmount;
    for (const p of proMap.values()) {
      proShares.push({
        proId: p.proId,
        proName: p.proName,
        grossCommission: p.grossCommission,
        feeShare: 0,
        netCommission: p.grossCommission,
        percentageOfGross: grossTotal > 0 ? (p.grossCommission / grossTotal) * 100 : 0,
      });
    }
  } else if (rates.feePolicy === "proportional") {
    // Cada parte absorve taxa proporcional à sua fatia do bolo
    const salonRatio = salonGross / grossTotal;
    salonFeeShare = feeAmount * salonRatio;

    for (const p of proMap.values()) {
      const proRatio = p.grossCommission / grossTotal;
      const proFee = feeAmount * proRatio;
      proShares.push({
        proId: p.proId,
        proName: p.proName,
        grossCommission: p.grossCommission,
        feeShare: proFee,
        netCommission: Math.max(p.grossCommission - proFee, 0),
        percentageOfGross: proRatio * 100,
      });
    }
  } else if (rates.feePolicy === "split_half") {
    // 50% salão, 50% dividido proporcionalmente entre a equipe
    salonFeeShare = feeAmount * 0.5;
    const remainingProFee = feeAmount * 0.5;

    for (const p of proMap.values()) {
      const shareOfCommissions =
        totalCommissionsGross > 0 ? p.grossCommission / totalCommissionsGross : 0;
      const proFee = remainingProFee * shareOfCommissions;
      proShares.push({
        proId: p.proId,
        proName: p.proName,
        grossCommission: p.grossCommission,
        feeShare: proFee,
        netCommission: Math.max(p.grossCommission - proFee, 0),
        percentageOfGross: grossTotal > 0 ? (p.grossCommission / grossTotal) * 100 : 0,
      });
    }
  }

  const salonNet = Math.max(salonGross - salonFeeShare, 0);

  return {
    grossTotal,
    paymentMethod,
    feePct,
    feeAmount,
    netTotal,
    salonGross,
    salonFeeShare,
    salonNet,
    professionals: proShares,
  };
}

/**
 * Gera payload Pix Copia e Cola estático/dinâmico no formato EMV QRCPS-MPM
 */
export function generatePodiumPixPayload({
  orderId,
  amount,
  clientName,
  description,
  salonName = "BELEZI SALAO",
  pixKey = "financeiro@belezi.com.br",
}: {
  orderId: string | number;
  amount: number;
  clientName?: string;
  description?: string;
  salonName?: string;
  pixKey?: string;
}): {
  pixCode: string;
  qrCodeUrl: string;
  expiresInMinutes: number;
  txId: string;
} {
  const cleanAmount = Number(amount || 0).toFixed(2);
  const txId = `PODIUM${String(orderId).replace(/\D/g, "").slice(-8) || Date.now().toString().slice(-8)}`;

  // Simulação de montagem EMV Pix estruturada
  const emvPayload = [
    "000201", // Payload Format Indicator
    "26580014br.gov.bcb.pix",
    `01${pixKey.length.toString().padStart(2, "0")}${pixKey}`,
    "52040000", // Merchant Category Code
    "5303986", // Transaction Currency BRL (986)
    `54${cleanAmount.length.toString().padStart(2, "0")}${cleanAmount}`,
    "5802BR", // Country Code
    `59${salonName.slice(0, 25).length.toString().padStart(2, "0")}${salonName.slice(0, 25).toUpperCase()}`,
    "6009SAO PAULO",
    `62${(4 + txId.length).toString().padStart(2, "0")}05${txId.length.toString().padStart(2, "0")}${txId}`,
    "6304ABCD", // Checksum fictício estandardizado para demonstração
  ].join("");

  // Usamos serviço público padrão e confiável de QR Code para gerar visualização
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    emvPayload,
  )}`;

  return {
    pixCode: emvPayload,
    qrCodeUrl,
    expiresInMinutes: 30,
    txId,
  };
}

/**
 * Simula antecipação de recebíveis futuros de cartões de crédito
 */
export function simulateAnticipation(
  receivables: FutureReceivable[],
  monthlyRatePct: number = 1.79,
): AnticipationSimulationResult {
  const eligible = (receivables ?? []).filter((r) => r && r.status === "a_receber");

  let totalGross = 0;
  let weightedDaysSum = 0;
  const now = new Date();

  for (const item of eligible) {
    const gross = Number(item.amount || 0);
    totalGross += gross;

    const due = new Date(item.dueDate);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.max(Math.ceil(diffTime / (1000 * 60 * 60 * 24)), 1);

    weightedDaysSum += diffDays * gross;
  }

  const averageDays = totalGross > 0 ? weightedDaysSum / totalGross : 30;
  const dailyRate = (monthlyRatePct / 100) / 30;
  const totalDiscount = totalGross * dailyRate * averageDays;
  const netAmountToReceive = Math.max(totalGross - totalDiscount, 0);

  return {
    totalGross,
    averageDaysAnticipated: Math.round(averageDays),
    totalDiscount,
    netAmountToReceive,
    eligibleCount: eligible.length,
  };
}

/**
 * Carrega recebíveis salvos ou sementes para demonstração
 */
export function loadPodiumReceivables(): FutureReceivable[] {
  try {
    const raw = localStorage.getItem(STORAGE_RECEIVABLES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }

  // Gera dados realistas de recebíveis para barbearias (vendas a prazo / cartão de crédito)
  const today = new Date();
  const plusDays = (d: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() + d);
    return date.toISOString().slice(0, 10);
  };

  const seed: FutureReceivable[] = [
    {
      id: "rec-01",
      orderNumber: 1042,
      clientName: "Rodrigo Mendonça",
      date: plusDays(-5),
      dueDate: plusDays(25),
      amount: 180.0,
      paymentMethod: "Cartão de Crédito 2x",
      installments: 2,
      status: "a_receber",
    },
    {
      id: "rec-02",
      orderNumber: 1045,
      clientName: "Carlos Eduardo Silva",
      date: plusDays(-3),
      dueDate: plusDays(27),
      amount: 145.0,
      paymentMethod: "Cartão de Crédito à vista",
      installments: 1,
      status: "a_receber",
    },
    {
      id: "rec-03",
      orderNumber: 1049,
      clientName: "Lucas Alcantara",
      date: plusDays(-1),
      dueDate: plusDays(29),
      amount: 220.0,
      paymentMethod: "Cartão de Crédito 3x",
      installments: 3,
      status: "a_receber",
    },
    {
      id: "rec-04",
      orderNumber: 1052,
      clientName: "Marcelo Fonseca",
      date: plusDays(0),
      dueDate: plusDays(30),
      amount: 90.0,
      paymentMethod: "Cartão de Crédito à vista",
      installments: 1,
      status: "a_receber",
    },
  ];

  try {
    localStorage.setItem(STORAGE_RECEIVABLES_KEY, JSON.stringify(seed));
  } catch {
    // ignora
  }

  return seed;
}

/**
 * Executa a solicitação de antecipação de recebíveis
 */
export function executeAnticipation(
  receivablesToAnticipateIds: string[],
): { count: number; netTotal: number } {
  const all = loadPodiumReceivables();
  let netTotal = 0;
  const rates = loadPodiumPayRates();

  const simulation = simulateAnticipation(
    all.filter((r) => receivablesToAnticipateIds.includes(r.id)),
    rates.anticipationMonthlyRatePct,
  );

  const updated = all.map((r) => {
    if (receivablesToAnticipateIds.includes(r.id)) {
      return { ...r, status: "antecipado" as const };
    }
    return r;
  });

  try {
    localStorage.setItem(STORAGE_RECEIVABLES_KEY, JSON.stringify(updated));
  } catch {
    // ignora
  }

  return {
    count: receivablesToAnticipateIds.length,
    netTotal: simulation.netAmountToReceive,
  };
}
