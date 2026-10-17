import { describe, it, expect } from "vitest";
import {
  checkAppointmentConflict,
  getProfessionalWorkingHoursForDate,
  isSalonOpenOnDate,
  validateBookingLeadTime,
  calculateDayOccupancyStats,
  getDayKeyFromDate,
} from "@/lib/agenda-engine";
import type { AppointmentRecord } from "@/types/agenda";
import type { BusinessHoursWeek, ProfessionalData, SalonSettingsData } from "@/types/salon";

describe("Etapa 7 — Agenda Inteligente", () => {
  const mockBusinessHours: BusinessHoursWeek = {
    monday: { open: "09:00", close: "20:00", closed: false },
    tuesday: { open: "09:00", close: "20:00", closed: false },
    wednesday: { open: "09:00", close: "20:00", closed: false },
    thursday: { open: "09:00", close: "20:00", closed: false },
    friday: { open: "09:00", close: "20:00", closed: false },
    saturday: { open: "08:00", close: "19:00", closed: false },
    sunday: { open: "09:00", close: "14:00", closed: true },
  };

  const mockSalonSettings: SalonSettingsData = {
    name: "Barbearia Imperial",
    tagline: "Corte & Barba de Alta Precisão",
    logo_url: "",
    banner_url: "",
    primary_color: "#0F172A",
    secondary_color: "#D4AF37",
    phone: "11999999999",
    whatsapp: "11999999999",
    email: "contato@imperial.com",
    instagram: "imperialbarber",
    facebook: "",
    website: "",
    address: "Rua Oscar Freire, 100",
    city: "São Paulo",
    state: "SP",
    neighborhood: "Jardins",
    zip_code: "01426-000",
    full_address: "Rua Oscar Freire, 100 - Jardins, São Paulo - SP",
    maps_link: "",
    scheduling_rules: "Confirmação imediata",
    min_advance_minutes: 30,
    max_advance_days: 14, // 14 dias de antecedência máxima
    cancellation_policy: "Até 2h antes",
    late_tolerance_minutes: 15,
    reminder_hours: 2,
    photos: [],
    business_hours: mockBusinessHours,
  };

  const mockPro: ProfessionalData = {
    id: "pro-barbeiro-1",
    salon_id: "salon-123",
    name: "Mestre Navalha",
    role: "Barbeiro Chefe",
    phone: "11988887777",
    active: true,
    specialties: ["Fade", "Barboterapia"],
    schedule_details: {
      monday: { start: "09:00", end: "19:00", active: true },
      tuesday: { start: "09:00", end: "19:00", active: true },
      wednesday: { start: "09:00", end: "19:00", active: true },
      thursday: { start: "09:00", end: "19:00", active: true },
      friday: { start: "09:00", end: "19:00", active: true },
      saturday: { start: "08:00", end: "18:00", active: true },
      sunday: { start: "00:00", end: "00:00", active: false }, // folga no domingo
    } as any,
  };

  it("verifica se a barbearia respeita dias de funcionamento e folgas", () => {
    // 2026-10-18 é um Domingo
    const sundayOpen = isSalonOpenOnDate("2026-10-18", mockBusinessHours);
    expect(sundayOpen.isOpen).toBe(false);

    // 2026-10-19 é uma Segunda-feira
    const mondayOpen = isSalonOpenOnDate("2026-10-19", mockBusinessHours);
    expect(mondayOpen.isOpen).toBe(true);
    expect(mondayOpen.openTime).toBe("09:00");
    expect(mondayOpen.closeTime).toBe("20:00");
  });

  it("respeita a escala e dias de folga individuais de cada barbeiro", () => {
    // Domingo: barbeiro de folga
    const sundayWork = getProfessionalWorkingHoursForDate("2026-10-18", mockPro, mockBusinessHours);
    expect(sundayWork.isWorking).toBe(false);

    // Segunda: trabalhando das 09h às 19h
    const mondayWork = getProfessionalWorkingHoursForDate("2026-10-19", mockPro, mockBusinessHours);
    expect(mondayWork.isWorking).toBe(true);
    expect(mondayWork.start).toBe("09:00");
    expect(mondayWork.end).toBe("19:00");
  });

  it("previne rigorosamente conflitos e reservas duplas para o mesmo barbeiro", () => {
    const existing: AppointmentRecord[] = [
      {
        id: "appt-1",
        salon_id: "salon-123",
        professional_id: "pro-barbeiro-1",
        client_id: "client-1",
        service_id: "srv-corte",
        starts_at: "2026-10-19T10:00:00.000Z",
        ends_at: "2026-10-19T11:00:00.000Z",
        status: "agendado",
      },
    ];

    // Tentativa de sobreposição direta: 10:30 às 11:30 para o mesmo barbeiro
    const conflictCheck1 = checkAppointmentConflict({
      professionalId: "pro-barbeiro-1",
      startsAt: "2026-10-19T10:30:00.000Z",
      endsAt: "2026-10-19T11:30:00.000Z",
      existingAppointments: existing,
    });
    expect(conflictCheck1.hasConflict).toBe(true);
    expect(conflictCheck1.isSimultaneousVipAllowed).toBe(false);

    // Horário livre após o término: 11:00 às 12:00
    const conflictCheck2 = checkAppointmentConflict({
      professionalId: "pro-barbeiro-1",
      startsAt: "2026-10-19T11:00:00.000Z",
      endsAt: "2026-10-19T12:00:00.000Z",
      existingAppointments: existing,
    });
    expect(conflictCheck2.hasConflict).toBe(false);

    // Outro profissional no mesmo horário: sem conflito
    const conflictCheck3 = checkAppointmentConflict({
      professionalId: "pro-outro-barbeiro",
      startsAt: "2026-10-19T10:00:00.000Z",
      endsAt: "2026-10-19T11:00:00.000Z",
      existingAppointments: existing,
    });
    expect(conflictCheck3.hasConflict).toBe(false);
  });

  it("permite agendamentos simultâneos apenas sob regras de planos VIP autorizadas", () => {
    const existing: AppointmentRecord[] = [
      {
        id: "appt-regular",
        salon_id: "salon-123",
        professional_id: "pro-barbeiro-1",
        client_id: "client-regular",
        service_id: "srv-corte",
        starts_at: "2026-10-19T14:00:00.000Z",
        ends_at: "2026-10-19T15:00:00.000Z",
        status: "agendado",
      },
    ];

    // Cliente comum tentando horário sobreposto: negado
    const regularTry = checkAppointmentConflict({
      professionalId: "pro-barbeiro-1",
      startsAt: "2026-10-19T14:15:00.000Z",
      endsAt: "2026-10-19T14:45:00.000Z",
      existingAppointments: existing,
      isCandidateVip: false,
      allowVipSimultaneousOverride: false,
    });
    expect(regularTry.hasConflict).toBe(true);

    // Cliente VIP com permissão expressa de encaixe simultâneo: autorizado
    const vipTry = checkAppointmentConflict({
      professionalId: "pro-barbeiro-1",
      startsAt: "2026-10-19T14:15:00.000Z",
      endsAt: "2026-10-19T14:45:00.000Z",
      existingAppointments: existing,
      isCandidateVip: true,
      allowVipSimultaneousOverride: true,
    });
    expect(vipTry.hasConflict).toBe(false);
    expect(vipTry.isSimultaneousVipAllowed).toBe(true);
  });

  it("valida a janela de antecedência máxima configurada (ex: 14 dias)", () => {
    // Tentativa de agendar daqui a 40 dias (excede os 14 dias configurados)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 40);
    const dateStr = futureDate.toISOString().slice(0, 10);

    const check = validateBookingLeadTime({
      dateStr,
      timeStr: "14:00",
      settings: mockSalonSettings,
    });

    expect(check.isValid).toBe(false);
    expect(check.message).toContain("excede a antecedência máxima permitida");
  });

  it("calcula taxa de ocupação diária e destaca horários de pico", () => {
    const dayAppts: AppointmentRecord[] = [
      {
        id: "a1",
        salon_id: "salon-123",
        professional_id: "pro-barbeiro-1",
        client_id: "c1",
        service_id: "s1",
        starts_at: "2026-10-19T17:00:00.000Z",
        ends_at: "2026-10-19T18:00:00.000Z",
        status: "concluido",
      },
      {
        id: "a2",
        salon_id: "salon-123",
        professional_id: "pro-barbeiro-1",
        client_id: "c2",
        service_id: "s1",
        starts_at: "2026-10-19T17:30:00.000Z",
        ends_at: "2026-10-19T18:30:00.000Z",
        status: "agendado",
        is_vip: true,
      },
      {
        id: "a3",
        salon_id: "salon-123",
        professional_id: "pro-barbeiro-1",
        client_id: null,
        service_id: null,
        starts_at: "2026-10-19T12:00:00.000Z",
        ends_at: "2026-10-19T13:00:00.000Z",
        status: "bloqueado",
        is_blocked: true,
        block_reason: "Almoço",
      },
    ];

    const stats = calculateDayOccupancyStats({
      dateStr: "2026-10-19",
      appointments: dayAppts,
      professionals: [mockPro],
      salonHours: mockBusinessHours,
    });

    expect(stats.totalAppointments).toBe(3);
    expect(stats.completedAppointments).toBe(1);
    expect(stats.vipAppointments).toBe(1);
    expect(stats.blockedSlots).toBe(1);
    expect(stats.occupancyPercentage).toBeGreaterThan(0);
  });
});
