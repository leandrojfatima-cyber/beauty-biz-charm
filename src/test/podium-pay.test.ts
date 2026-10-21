import { describe, expect, it } from "vitest";
import {
  calculatePaymentSplit,
  generatePodiumPixPayload,
  getPaymentMethodFeePct,
  simulateAnticipation,
  type OrderItemForSplit,
} from "../services/payments";

describe("Podium Pay - Payments & Split Engine", () => {
  it("computes gateway fee correctly per payment method", () => {
    expect(getPaymentMethodFeePct("Pix")).toBe(0.99);
    expect(getPaymentMethodFeePct("Cartão de débito")).toBe(1.49);
    expect(getPaymentMethodFeePct("Cartão de crédito à vista")).toBe(2.99);
    expect(getPaymentMethodFeePct("Cartão parcelado")).toBe(4.49);
    expect(getPaymentMethodFeePct("Dinheiro")).toBe(0);
  });

  it("calculates split where salon absorbs gateway fee (standard policy)", () => {
    const items: OrderItemForSplit[] = [
      {
        description: "Corte Degradê",
        qty: 1,
        unit_price: 60,
        commission_pct: 50,
        professional_id: "pro-1",
        professional_name: "Barbeiro João",
      },
      {
        description: "Pomada Modeladora",
        qty: 1,
        unit_price: 40,
        commission_pct: 20,
        professional_id: "pro-1",
        professional_name: "Barbeiro João",
      },
    ];

    // Total: 100. João gross commission = (60*50%) + (40*20%) = 30 + 8 = 38.
    // Salon gross = 100 - 38 = 62.
    // Fee for Pix (0.99%) = 0.99.
    // Salon absorbs: João net commission = 38, Salon net = 62 - 0.99 = 61.01.
    const split = calculatePaymentSplit(items, 100, "Pix");

    expect(split.grossTotal).toBe(100);
    expect(split.feeAmount).toBeCloseTo(0.99, 2);
    expect(split.netTotal).toBeCloseTo(99.01, 2);
    expect(split.salonGross).toBe(62);
    expect(split.salonNet).toBeCloseTo(61.01, 2);
    expect(split.professionals).toHaveLength(1);
    expect(split.professionals[0].grossCommission).toBe(38);
    expect(split.professionals[0].feeShare).toBe(0);
    expect(split.professionals[0].netCommission).toBe(38);
  });

  it("calculates proportional split of transaction fee", () => {
    const items: OrderItemForSplit[] = [
      {
        description: "Corte",
        qty: 1,
        unit_price: 100,
        commission_pct: 50, // 50 reais commission
        professional_id: "pro-1",
        professional_name: "Barbeiro João",
      },
    ];

    // Total: 100, João: 50%, Salon: 50%.
    // Fee for Credit (2.99%) = 2.99.
    // Proportional fee: Salon pays 50% (1.495), João pays 50% (1.495).
    const split = calculatePaymentSplit(items, 100, "Cartão de Crédito", {
      pixFeePct: 0.99,
      debitoFeePct: 1.49,
      creditoVistaFeePct: 2.99,
      creditoParceladoFeePct: 4.49,
      anticipationMonthlyRatePct: 1.79,
      feePolicy: "proportional",
    });

    expect(split.feeAmount).toBeCloseTo(2.99, 2);
    expect(split.salonFeeShare).toBeCloseTo(1.495, 2);
    expect(split.salonNet).toBeCloseTo(48.505, 2);
    expect(split.professionals[0].feeShare).toBeCloseTo(1.495, 2);
    expect(split.professionals[0].netCommission).toBeCloseTo(48.505, 2);
  });

  it("generates structured Podium Pix payload and QR code url", () => {
    const pix = generatePodiumPixPayload({
      orderId: 1042,
      amount: 85.5,
      clientName: "Rafael Lima",
      description: "Atendimento Belezi #1042",
      salonName: "Barbearia Imperial",
    });

    expect(pix.pixCode).toContain("br.gov.bcb.pix");
    expect(pix.pixCode).toContain("85.50");
    expect(pix.qrCodeUrl).toContain("https://api.qrserver.com");
    expect(pix.expiresInMinutes).toBe(30);
  });

  it("simulates anticipation of future receivables with pro-rata discount", () => {
    const today = new Date();
    const plusDays = (d: number) => {
      const date = new Date(today);
      date.setDate(date.getDate() + d);
      return date.toISOString().slice(0, 10);
    };

    const receivables = [
      {
        id: "1",
        date: plusDays(0),
        dueDate: plusDays(30),
        amount: 1000,
        paymentMethod: "Cartão de Crédito",
        status: "a_receber" as const,
      },
    ];

    const sim = simulateAnticipation(receivables, 1.79);
    expect(sim.totalGross).toBe(1000);
    expect(sim.eligibleCount).toBe(1);
    expect(sim.totalDiscount).toBeCloseTo(17.9, 1);
    expect(sim.netAmountToReceive).toBeCloseTo(982.1, 1);
  });
});
