export interface SalonPhoto {
  id: string;
  url: string;
  title?: string;
  caption?: string;
  category: "ambiente" | "fachada" | "lounge" | "estacoes" | "detalhes";
  display_order: number;
  created_at?: string;
}

export interface BusinessDayHours {
  open: string;
  close: string;
  closed: boolean;
}

export type BusinessHoursWeek = {
  monday: BusinessDayHours;
  tuesday: BusinessDayHours;
  wednesday: BusinessDayHours;
  thursday: BusinessDayHours;
  friday: BusinessDayHours;
  saturday: BusinessDayHours;
  sunday: BusinessDayHours;
};

export interface SalonSettingsData {
  id?: string;
  owner_id?: string;
  name: string;
  tagline: string;
  logo_url: string;
  banner_url: string;
  primary_color: string;
  secondary_color: string;
  phone: string;
  whatsapp: string;
  email: string;
  instagram: string;
  facebook: string;
  website: string;
  address: string;
  city: string;
  state: string;
  neighborhood: string;
  zip_code: string;
  full_address: string;
  maps_link: string;
  scheduling_rules: string;
  min_advance_minutes: number;
  max_advance_days: number;
  cancellation_policy: string;
  late_tolerance_minutes: number;
  reminder_hours: number;
  photos: SalonPhoto[];
  business_hours: BusinessHoursWeek;
  status?: string;
  plan_name?: string;
}

export interface ProfessionalData {
  id?: string;
  salon_id?: string;
  owner_id?: string;
  name: string;
  role: string;
  phone: string;
  active: boolean;
  photo_url?: string;
  bio?: string;
  specialties: string[];
  working_hours?: string;
  instagram?: string;
  created_at?: string;
}

export interface ServiceData {
  id?: string;
  salon_id?: string;
  owner_id?: string;
  name: string;
  category: string;
  price: number;
  duration_min: number;
  commission_pct: number;
  active: boolean;
  description?: string;
  photo_url?: string;
  highlight?: boolean;
  created_at?: string;
}
