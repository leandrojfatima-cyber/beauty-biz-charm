export type TransactionType = "receita" | "despesa";
export type TransactionStatus = "realizado" | "previsto" | "cancelado";

export type PaymentMethod =
  | "dinheiro"
  | "pix"
  | "cartao_credito"
  | "cartao_debito"
  | "assinatura_clube"
  | "boleto"
  | "outro";

export type FinancialCategory =
  | "atendimento"
  | "produtos"
  | "assinaturas"
  | "comissões"
  | "vales"
  | "aluguel"
  | "estoque"
  | "luz_agua"
  | "taxas_cartao"
  | "marketing"
  | "impostos"
  | "equipamentos"
  | "geral"
  | "outros";

export interface FinancialTransactionRecord {
  id: string;
  owner_id?: string;
  salon_id?: string;
  type: TransactionType;
  category: string;
  description: string;
  amount: number;
  net_amount?: number;
  card_fee?: number;
  date: string;
  due_date?: string | null;
  status: TransactionStatus;
  payment_method?: PaymentMethod | string;
  source?: string;
  professional_id?: string | null;
  order_id?: string | null;
  notes?: string | null;
  created_at?: string;
}

export type AdvanceType = "vale" | "adiantamento" | "bonificacao" | "ajuste";
export type AdvanceStatus = "pendente" | "descontado" | "pago" | "cancelado";

export interface ProfessionalAdvanceRecord {
  id: string;
  owner_id?: string;
  salon_id?: string;
  professional_id: string;
  type: AdvanceType;
  amount: number;
  date: string;
  status: AdvanceStatus;
  description: string;
  notes?: string | null;
  closing_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type PeriodType = "diario" | "semanal" | "quinzenal" | "mensal" | "personalizado";
export type ClosingStatus = "rascunho" | "fechado" | "pago";

export interface FinancialClosingRecord {
  id: string;
  owner_id?: string;
  salon_id?: string;
  professional_id?: string | null;
  period_type: PeriodType;
  start_date: string;
  end_date: string;
  gross_sales: number;
  service_commissions: number;
  product_commissions: number;
  subscription_commissions: number;
  total_commissions: number;
  total_advances: number;
  total_bonuses: number;
  net_payable: number;
  status: ClosingStatus;
  notes?: string | null;
  payment_transaction_id?: string | null;
  closed_at: string;
  created_at?: string;
}

export interface CashFlowStats {
  realizedIncome: number;
  realizedExpense: number;
  realizedBalance: number;
  projectedIncome: number;
  projectedExpense: number;
  projectedBalance: number;
  balanceBefore: number;
  totalLiquidForecast: number;
  operatingProfitPct: number;
}

export interface ProfessionalCommissionSummary {
  professional: {
    id: string;
    name: string;
    role: string;
    phone?: string | null;
    active: boolean;
  };
  orderItems: any[];
  advances: ProfessionalAdvanceRecord[];
  serviceSales: number;
  serviceCommission: number;
  productSales: number;
  productCommission: number;
  subscriptionSales: number;
  subscriptionCommission: number;
  totalGrossCommission: number;
  pendingAdvances: number; // vales e adiantamentos a descontar
  bonuses: number; // bonificações por metas a somar
  netPayableCommission: number; // comissão líquida a pagar
}
