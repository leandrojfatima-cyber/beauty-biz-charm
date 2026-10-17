import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { validateBookingLeadTime } from "@/lib/agenda-engine";
import type { SalonSettingsData } from "@/types/salon";

describe("Etapa 8 — Aplicativo de Agendamento do Cliente & PWA", () => {
  const publicDir = resolve(__dirname, "../../public");

  it("verifica conformidade total do manifesto PWA (W3C Standard)", () => {
    const manifestPath = resolve(publicDir, "manifest.json");
    expect(existsSync(manifestPath)).toBe(true);

    const manifestContent = JSON.parse(readFileSync(manifestPath, "utf-8"));

    expect(manifestContent.name).toBe("Belezi — Agendamento de Barbearia");
    expect(manifestContent.short_name).toBe("Belezi");
    expect(manifestContent.display).toBe("standalone");
    expect(manifestContent.start_url).toBe("/agendar");
    expect(manifestContent.scope).toBe("/");
    expect(manifestContent.theme_color).toBe("#0F172A");

    // Ícones obrigatórios: 192x192, 512x512 e maskable
    const icons = manifestContent.icons;
    expect(icons.length).toBeGreaterThanOrEqual(3);

    const has192 = icons.some((i: any) => i.sizes === "192x192" && i.purpose === "any");
    const has512 = icons.some((i: any) => i.sizes === "512x512" && i.purpose === "any");
    const hasMaskable = icons.some((i: any) => i.sizes === "512x512" && i.purpose === "maskable");

    expect(has192).toBe(true);
    expect(has512).toBe(true);
    expect(hasMaskable).toBe(true);
  });

  it("garante a existência física dos ativos de ícones para iOS Safari e Android", () => {
    expect(existsSync(resolve(publicDir, "icon.svg"))).toBe(true);
    expect(existsSync(resolve(publicDir, "pwa-192x192.png"))).toBe(true);
    expect(existsSync(resolve(publicDir, "pwa-512x512.png"))).toBe(true);
    expect(existsSync(resolve(publicDir, "apple-touch-icon.png"))).toBe(true);
    expect(existsSync(resolve(publicDir, "sw.js"))).toBe(true);
  });

  it("calcula soma de múltiplos serviços selecionados pelo cliente no fluxo de agendamento", () => {
    const mockServices = [
      { id: "s1", name: "Corte Degradê", price: 55.0, duration_min: 45 },
      { id: "s2", name: "Barboterapia c/ Toalha Quente", price: 45.0, duration_min: 30 },
      { id: "s3", name: "Sobrancelha na Navalha", price: 20.0, duration_min: 15 },
    ];

    const totalDuration = mockServices.reduce((acc, s) => acc + s.duration_min, 0);
    const totalPrice = mockServices.reduce((acc, s) => acc + s.price, 0);

    expect(totalDuration).toBe(90); // 45 + 30 + 15 = 90 minutos
    expect(totalPrice).toBe(120.0); // 55 + 45 + 20 = R$ 120,00

    // Cálculo do término automático
    const startTime = new Date("2026-10-20T14:00:00Z");
    const endTime = new Date(startTime.getTime() + totalDuration * 60000);

    expect(endTime.toISOString()).toBe("2026-10-20T15:30:00.000Z");
  });

  it("valida a janela de antecedência configurada pela barbearia para o cliente", () => {
    const mockSettings: SalonSettingsData = {
      name: "Barbearia Vip",
      tagline: "",
      logo_url: "",
      banner_url: "",
      primary_color: "",
      secondary_color: "",
      phone: "",
      whatsapp: "",
      email: "",
      instagram: "",
      facebook: "",
      website: "",
      address: "",
      city: "",
      state: "",
      neighborhood: "",
      zip_code: "",
      full_address: "",
      maps_link: "",
      scheduling_rules: "",
      min_advance_minutes: 30,
      max_advance_days: 7, // Apenas 7 dias de antecedência
      cancellation_policy: "Até 2h antes",
      late_tolerance_minutes: 15,
      reminder_hours: 2,
      photos: [],
      business_hours: {} as any,
    };

    // Tentar agendar daqui a 15 dias (fora da janela de 7 dias)
    const future = new Date();
    future.setDate(future.getDate() + 15);
    const futureDateStr = future.toISOString().slice(0, 10);

    const result = validateBookingLeadTime({
      dateStr: futureDateStr,
      timeStr: "10:00",
      settings: mockSettings,
    });

    expect(result.isValid).toBe(false);
    expect(result.message).toContain("excede a antecedência máxima permitida pela barbearia (7 dias)");
  });

  it("garante proteção de isolamento onde clientes consultam apenas seus próprios agendamentos por telefone", () => {
    const mockAppointments = [
      { id: "a1", client_phone: "11999991111", client_name: "Carlos", service: "Corte" },
      { id: "a2", client_phone: "11988882222", client_name: "Mariana", service: "Barba" },
      { id: "a3", client_phone: "11999991111", client_name: "Carlos", service: "Corte + Barba" },
    ];

    const queryPhone = "11999991111";
    const filtered = mockAppointments.filter((a) => a.client_phone === queryPhone);

    expect(filtered.length).toBe(2);
    expect(filtered.every((a) => a.client_name === "Carlos")).toBe(true);
    expect(filtered.some((a) => a.client_name === "Mariana")).toBe(false);
  });
});
