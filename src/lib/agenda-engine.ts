import type { BusinessHoursWeek, ProfessionalData, SalonSettingsData } from "@/types/salon";
import type { AppointmentRecord, ConflictCheckResult, DayOccupancyStats } from "@/types/agenda";

export const DAY_KEYS: (keyof BusinessHoursWeek)[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export const DAY_NAMES_PT: Record<keyof BusinessHoursWeek, string> = {
  sunday: "Domingo",
  monday: "Segunda-feira",
  tuesday: "Terça-feira",
  wednesday: "Quarta-feira",
  thursday: "Quinta-feira",
  friday: "Sexta-feira",
  saturday: "Sábado",
};

/** Retorna a chave do dia da semana a partir de uma data YYYY-MM-DD */
export function getDayKeyFromDate(dateStr: string): keyof BusinessHoursWeek {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day, 12, 0, 0);
  return DAY_KEYS[d.getDay()];
}

/** Verifica se a barbearia está aberta no dia da semana especificado */
export function isSalonOpenOnDate(dateStr: string, businessHours?: BusinessHoursWeek | null): {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
} {
  const dayKey = getDayKeyFromDate(dateStr);
  const dayConfig = businessHours?.[dayKey];

  if (!dayConfig || dayConfig.closed) {
    return { isOpen: false, openTime: "00:00", closeTime: "00:00" };
  }

  return {
    isOpen: true,
    openTime: dayConfig.open || "09:00",
    closeTime: dayConfig.close || "20:00",
  };
}

/** Verifica se o barbeiro específico tem expediente no dia e qual seu horário */
export function getProfessionalWorkingHoursForDate(
  dateStr: string,
  pro?: ProfessionalData | null,
  salonHours?: BusinessHoursWeek | null,
): {
  isWorking: boolean;
  start: string;
  end: string;
  reason?: string;
} {
  if (!pro || !pro.active) {
    return { isWorking: false, start: "00:00", end: "00:00", reason: "Profissional inativo" };
  }

  const dayKey = getDayKeyFromDate(dateStr);
  const salonDay = isSalonOpenOnDate(dateStr, salonHours);

  if (!salonDay.isOpen) {
    return { isWorking: false, start: "00:00", end: "00:00", reason: "Barbearia fechada neste dia" };
  }

  // Verifica escala individual se configurada no json schedule_details
  const scheduleDetails = (pro as any).schedule_details;
  if (scheduleDetails && scheduleDetails[dayKey]) {
    const proDay = scheduleDetails[dayKey];
    if (proDay.active === false) {
      return { isWorking: false, start: "00:00", end: "00:00", reason: "Folga semanal do profissional" };
    }
    return {
      isWorking: true,
      start: proDay.start || salonDay.openTime,
      end: proDay.end || salonDay.closeTime,
    };
  }

  // Domingo padrão como folga se não houver horário específico
  if (dayKey === "sunday") {
    return { isWorking: false, start: "00:00", end: "00:00", reason: "Folga de domingo" };
  }

  return {
    isWorking: true,
    start: salonDay.openTime,
    end: salonDay.closeTime,
  };
}

/** Prevenção rigorosa de conflitos de agendamento e suporte a regras VIP */
export function checkAppointmentConflict({
  professionalId,
  startsAt,
  endsAt,
  excludeId,
  existingAppointments,
  isCandidateVip = false,
  allowVipSimultaneousOverride = false,
}: {
  professionalId: string;
  startsAt: string | Date;
  endsAt: string | Date;
  excludeId?: string | null;
  existingAppointments: AppointmentRecord[];
  isCandidateVip?: boolean;
  allowVipSimultaneousOverride?: boolean;
}): ConflictCheckResult {
  const targetStart = new Date(startsAt).getTime();
  const targetEnd = new Date(endsAt).getTime();

  if (targetEnd <= targetStart) {
    return {
      hasConflict: true,
      isSimultaneousVipAllowed: false,
      conflictReason: "O horário de término deve ser posterior ao horário de início.",
    };
  }

  // Procura agendamento sobreposto para o mesmo profissional
  const conflicting = existingAppointments.find((a) => {
    // Ignora agendamentos cancelados ou o próprio agendamento sendo editado
    if (a.status === "cancelado") return false;
    if (excludeId && a.id === excludeId) return false;
    if (a.professional_id !== professionalId) return false;

    const aStart = new Date(a.starts_at).getTime();
    const aEnd = new Date(a.ends_at).getTime();

    // Regra de colisão estrita: início A < fim B E fim A > início B
    const overlaps = targetStart < aEnd && targetEnd > aStart;
    return overlaps;
  });

  if (!conflicting) {
    return {
      hasConflict: false,
      isSimultaneousVipAllowed: false,
      conflictAppointment: null,
    };
  }

  // Se encontrou colisão, verifica regras de exceção VIP:
  // Suporte a agendamentos simultâneos apenas quando permitido pelas regras dos planos VIP
  const canUseVipSimultaneous =
    (isCandidateVip || conflicting.is_vip) && allowVipSimultaneousOverride;

  if (canUseVipSimultaneous) {
    return {
      hasConflict: false,
      isSimultaneousVipAllowed: true,
      conflictAppointment: conflicting,
      conflictReason: "Encaixe VIP simultâneo autorizado por benefício de plano.",
    };
  }

  const conflictStartTime = new Date(conflicting.starts_at).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const conflictEndTime = new Date(conflicting.ends_at).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const reason = conflicting.is_blocked
    ? `Horário bloqueado (${conflicting.block_reason || "Intervalo/Indisponível"}) das ${conflictStartTime} às ${conflictEndTime}.`
    : `O profissional já possui agendamento das ${conflictStartTime} às ${conflictEndTime}.`;

  return {
    hasConflict: true,
    isSimultaneousVipAllowed: false,
    conflictAppointment: conflicting,
    conflictReason: reason,
  };
}

/** Valida limites de antecedência máxima e mínima conforme configurações da barbearia */
export function validateBookingLeadTime({
  dateStr,
  timeStr,
  settings,
}: {
  dateStr: string;
  timeStr: string;
  settings?: SalonSettingsData | null;
}): { isValid: boolean; message?: string } {
  const targetDate = new Date(`${dateStr}T${timeStr}:00`);
  const now = new Date();

  // 1. Antecedência máxima (ex: 7, 14, 28 ou 30 dias)
  const maxDays = settings?.max_advance_days ?? 30;
  const maxDate = new Date();
  maxDate.setDate(now.getDate() + maxDays);
  maxDate.setHours(23, 59, 59, 999);

  if (targetDate.getTime() > maxDate.getTime()) {
    return {
      isValid: false,
      message: `Data excede a antecedência máxima permitida pela barbearia (${maxDays} dias).`,
    };
  }

  // 2. Não permitir agendamento no passado
  if (targetDate.getTime() < now.getTime()) {
    return {
      isValid: false,
      message: "Não é possível agendar em horário que já passou.",
    };
  }

  // 3. Antecedência mínima (ex: 30 minutos)
  const minMinutes = settings?.min_advance_minutes ?? 30;
  const minDate = new Date(now.getTime() + minMinutes * 60000);

  if (targetDate.getTime() < minDate.getTime()) {
    return {
      isValid: false,
      message: `É necessário agendar com pelo menos ${minMinutes} minutos de antecedência.`,
    };
  }

  return { isValid: true };
}

/** Calcula estatísticas de ocupação e horários de pico para uma data */
export function calculateDayOccupancyStats({
  dateStr,
  appointments,
  professionals,
  salonHours,
}: {
  dateStr: string;
  appointments: AppointmentRecord[];
  professionals: ProfessionalData[];
  salonHours?: BusinessHoursWeek | null;
}): DayOccupancyStats {
  const activePros = professionals.filter((p) => p.active);
  const dayAppointments = appointments.filter((a) => {
    const aDate = new Date(a.starts_at).toISOString().slice(0, 10);
    return aDate === dateStr && a.status !== "cancelado";
  });

  const completed = dayAppointments.filter((a) => a.status === "concluido").length;
  const vipCount = dayAppointments.filter((a) => a.is_vip).length;
  const blockedCount = dayAppointments.filter((a) => a.is_blocked).length;

  // Calcula capacidade total em minutos de trabalho no dia
  let totalCapacityMinutes = 0;
  const dayKey = getDayKeyFromDate(dateStr);
  const salonDay = isSalonOpenOnDate(dateStr, salonHours);

  if (salonDay.isOpen && activePros.length > 0) {
    const [openH, openM] = salonDay.openTime.split(":").map(Number);
    const [closeH, closeM] = salonDay.closeTime.split(":").map(Number);
    const dailyMinutesPerPro = Math.max(0, (closeH * 60 + closeM) - (openH * 60 + openM));
    totalCapacityMinutes = dailyMinutesPerPro * activePros.length;
  }

  // Soma os minutos agendados
  let totalBookedMinutes = 0;
  const hourCounter: Record<string, number> = {};

  dayAppointments.forEach((a) => {
    const start = new Date(a.starts_at);
    const end = new Date(a.ends_at);
    const diffMin = Math.max(15, (end.getTime() - start.getTime()) / 60000);
    totalBookedMinutes += diffMin;

    const hourSlot = `${start.getHours().toString().padStart(2, "0")}:00`;
    hourCounter[hourSlot] = (hourCounter[hourSlot] || 0) + 1;
  });

  const occupancyPercentage =
    totalCapacityMinutes > 0
      ? Math.min(100, Math.round((totalBookedMinutes / totalCapacityMinutes) * 100))
      : 0;

  // Identifica horários de pico (2+ atendimentos simultâneos ou após 17h com agendamento)
  const peakHourSlots = Object.entries(hourCounter)
    .filter(([hour, count]) => {
      const h = parseInt(hour, 10);
      return count >= 2 || (h >= 17 && count >= 1);
    })
    .map(([hour]) => hour);

  return {
    date: dateStr,
    totalAppointments: dayAppointments.length,
    completedAppointments: completed,
    vipAppointments: vipCount,
    blockedSlots: blockedCount,
    occupancyPercentage,
    isPeakDay: occupancyPercentage >= 75 || dayAppointments.length >= (activePros.length * 6),
    peakHourSlots,
  };
}
