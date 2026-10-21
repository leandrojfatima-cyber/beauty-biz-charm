export type AutomationTriggerType =
  | "lembrete_agendamento"
  | "confirmacao"
  | "aniversario"
  | "cobranca_plano"
  | "recuperacao_inativo"
  | "recompra_produto"
  | "aviso_falta"
  | "pos_atendimento";

export interface AutomationTemplates {
  lembrete?: string;
  confirmacao?: string;
  aniversario?: string;
  recuperacao?: string;
  cobranca_plano?: string;
  recompra_produto?: string;
  falta_aviso?: string;
  [key: string]: string | undefined;
}

export interface AutomationSettingsData {
  id?: string;
  owner_id?: string;
  salon_id?: string;
  reminder_enabled: boolean;
  reminder_hours_before: number;
  birthday_enabled: boolean;
  birthday_coupon_text: string;
  inactive_clients_days: number;
  inactive_coupon_text: string;
  product_reorder_enabled: boolean;
  product_reorder_days: number;
  product_reorder_message: string;
  subscription_notice_enabled: boolean;
  subscription_notice_days_before: number;
  no_show_tolerance_minutes: number;
  max_no_shows_before_block: number;
  no_show_fee: number;
  require_advance_payment_blocked: boolean;
  custom_templates: AutomationTemplates;
  created_at?: string;
  updated_at?: string;
}

export interface AutomationMessageLog {
  id: string;
  owner_id?: string;
  salon_id?: string;
  client_id?: string | null;
  appointment_id?: string | null;
  trigger_type: AutomationTriggerType;
  channel: string;
  phone?: string | null;
  recipient_name?: string | null;
  message_body: string;
  status: "pendente" | "enviado" | "falha";
  created_at: string;
}

export interface InactiveClientCandidate {
  id: string;
  name: string;
  phone?: string | null;
  last_service_date?: string | null;
  days_inactive: number;
  total_spent?: number;
  total_visits?: number;
}

export interface ProductReorderCandidate {
  id: string;
  client_name: string;
  client_phone?: string | null;
  product_name: string;
  purchase_date: string;
  days_since_purchase: number;
}

export interface BirthdayClientCandidate {
  id: string;
  name: string;
  phone?: string | null;
  birth_date: string;
  is_today: boolean;
  is_this_week: boolean;
  age?: number;
}

export interface SubscriptionDueCandidate {
  id: string;
  subscription_id: string;
  client_name: string;
  client_phone?: string | null;
  plan_name: string;
  plan_price: number;
  renews_at: string;
  days_until_due: number;
}
