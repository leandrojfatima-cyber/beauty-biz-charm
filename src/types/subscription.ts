export type SubscriptionModel = "avulso" | "recorrente" | "ilimitado" | "vip" | "one";

export type BillingCycle = "mensal" | "trimestral" | "semestral" | "anual";

export type SubscriptionStatus = "ativa" | "pausada" | "cancelada" | "inadimplente";

export interface SalonClientPlan {
  id: string;
  salon_id?: string;
  owner_id?: string;
  name: string;
  model: SubscriptionModel;
  price: number;
  billing_cycle: BillingCycle;
  monthly_credit_limit: number;
  service_ids: string[];
  benefits: string[];
  active: boolean;
  created_at?: string;
}

export interface ClientSubscription {
  id: string;
  salon_id?: string;
  owner_id?: string;
  client_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  starts_at: string;
  renews_at: string;
  credits_used_this_period: number;
  notes?: string | null;
  plan?: SalonClientPlan;
  client?: {
    id: string;
    name: string;
    phone?: string | null;
  };
  created_at?: string;
  updated_at?: string;
}

export interface SubscriptionCreditValidation {
  isCovered: boolean;
  canBook: boolean;
  requiresExtraPayment: boolean;
  creditsRemaining: number | "ilimitado";
  reasonMessage: string;
  isVipOverrideAllowed: boolean;
}
