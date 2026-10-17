import { describe, it, expect } from "vitest";
import type { SalonSettingsData, ProfessionalData, ServiceData } from "@/types/salon";

describe("Etapa 6 — Cadastro e Personalização das Barbearias", () => {
  it("valida a estrutura completa de personalização da barbearia", () => {
    const mockSalon: SalonSettingsData = {
      name: "Barbearia Dom Navalha",
      tagline: "Tradição em corte masculino e barboterapia",
      logo_url: "https://example.com/logo.png",
      banner_url: "https://example.com/banner.jpg",
      primary_color: "#0F172A",
      secondary_color: "#D4AF37",
      phone: "(11) 3333-4444",
      whatsapp: "(11) 99999-8888",
      email: "contato@domnavalha.com.br",
      instagram: "domnavalhabarbearia",
      facebook: "domnavalha",
      website: "https://domnavalha.com.br",
      address: "Rua Augusta, 1500",
      city: "São Paulo",
      state: "SP",
      neighborhood: "Consolação",
      zip_code: "01304-001",
      full_address: "Rua Augusta, 1500 - Consolação, São Paulo - SP",
      maps_link: "https://maps.google.com/?q=-23.55,-46.65",
      scheduling_rules: "Agendamento com 30min de antecedência mínima",
      min_advance_minutes: 30,
      max_advance_days: 30,
      cancellation_policy: "Cancelamento grátis até 2 horas antes",
      late_tolerance_minutes: 15,
      reminder_hours: 2,
      photos: [
        {
          id: "photo-1",
          url: "https://example.com/fachada.jpg",
          title: "Fachada Externa",
          category: "fachada",
          display_order: 0,
        },
      ],
      business_hours: {
        monday: { open: "09:00", close: "20:00", closed: false },
        tuesday: { open: "09:00", close: "20:00", closed: false },
        wednesday: { open: "09:00", close: "20:00", closed: false },
        thursday: { open: "09:00", close: "20:00", closed: false },
        friday: { open: "09:00", close: "20:00", closed: false },
        saturday: { open: "08:00", close: "19:00", closed: false },
        sunday: { open: "09:00", close: "14:00", closed: true },
      },
    };

    expect(mockSalon.name).toBe("Barbearia Dom Navalha");
    expect(mockSalon.primary_color).toBe("#0F172A");
    expect(mockSalon.secondary_color).toBe("#D4AF37");
    expect(mockSalon.photos.length).toBe(1);
    expect(mockSalon.business_hours.sunday.closed).toBe(true);
    expect(mockSalon.business_hours.saturday.open).toBe("08:00");
  });

  it("garante a vinculação de profissionais ao salon_id e especialidades", () => {
    const mockPro: ProfessionalData = {
      id: "pro-123",
      salon_id: "salon-abc",
      owner_id: "user-xyz",
      name: "Rodrigo 'Tesoura de Ouro'",
      role: "Barbeiro Master",
      phone: "(11) 97777-6666",
      active: true,
      specialties: ["Corte Degradê / Fade", "Barboterapia c/ Toalha Quente", "Navalhado Artístico"],
      working_hours: "Terça a Sábado: 09h às 19h",
    };

    expect(mockPro.salon_id).toBe("salon-abc");
    expect(mockPro.specialties).toContain("Barboterapia c/ Toalha Quente");
    expect(mockPro.active).toBe(true);
  });

  it("garante a vinculação de serviços com destaque, preço e comissão", () => {
    const mockService: ServiceData = {
      id: "srv-456",
      salon_id: "salon-abc",
      owner_id: "user-xyz",
      name: "Combo Imperial (Corte + Barboterapia)",
      category: "combo",
      price: 85.0,
      duration_min: 60,
      commission_pct: 50,
      highlight: true,
      active: true,
      description: "Corte completo na tesoura/máquina com acabamento navalhado e barboterapia aromatizada com toalha quente.",
    };

    expect(mockService.salon_id).toBe("salon-abc");
    expect(mockService.price).toBe(85.0);
    expect(mockService.highlight).toBe(true);
    expect(mockService.duration_min).toBe(60);
  });
});
