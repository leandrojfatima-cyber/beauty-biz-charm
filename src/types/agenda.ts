export type AppointmentStatus =
  | "agendado"
  | "confirmado"
  | "em_andamento"
  | "concluido"
  | "cancelado"
  | "bloqueado";

export interface AppointmentRecord {
  id: string;
  salon_id?: string;
  owner_id?: string;
  client_id: string | null;
  professional_id: string;
  service_id: string | null;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  notes?: string | null;
  is_vip?: boolean;
  vip_simultaneous_override?: boolean;
  is_blocked?: boolean;
  block_reason?: string | null;
  created_at?: string;
}

export interface AppointmentWithDetails extends AppointmentRecord {
  client?: {
    id: string;
    name: string;
    phone?: string | null;
    is_vip?: boolean;
    vip_plan_name?: string | null;
  };
  service?: {
    id: string;
    name: string;
    price: number;
    duration_min: number;
    category?: string;
  };
  professional?: {
    id: string;
    name: string;
    role?: string;
    photo_url?: string;
  };
}

export type AgendaViewMode = "daily" | "grid" | "weekly" | "monthly";

export interface ConflictCheckResult {
  hasConflict: boolean;
  isSimultaneousVipAllowed: boolean;
  conflictAppointment?: AppointmentRecord | null;
  conflictReason?: string;
}

export interface DayOccupancyStats {
  date: string;
  totalAppointments: number;
  completedAppointments: number;
  vipAppointments: number;
  blockedSlots: number;
  occupancyPercentage: number;
  isPeakDay: boolean;
  peakHourSlots: string[];
}
