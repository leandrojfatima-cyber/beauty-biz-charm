import { describe, expect, it } from "vitest";
import {
  calculateDashboardAnalytics,
  calculateSubscriptionMrr,
  dashboardCsvRows,
  periodRange,
} from "./dashboard-engine";

const range = { start: "2026-10-01", end: "2026-10-07" };
const shift = (date: string, start: string, end: string, client: string, status = "concluido") => ({
  starts_at: `${date}T${start}:00Z`,
  ends_at: `${date}T${end}:00Z`,
  professional_id: "pro-1",
  client_id: client,
  status,
});

function fixture() {
  return {
    range,
    transactions: [
      { type: "receita", amount: 110, net_amount: 100, source: "avulso", status: "realizado", date: "2026-10-02" },
      { type: "receita", amount: 44, net_amount: 40, source: "assinatura", status: "realizado", date: "2026-10-03" },
      { type: "receita", amount: 900, source: "avulso", status: "previsto", date: "2026-10-03" },
      { type: "receita", amount: 800, source: "avulso", status: "cancelado", date: "2026-10-04" },
      { type: "despesa", amount: 500, source: "avulso", status: "realizado", date: "2026-10-04" },
      { type: "receita", amount: 300, source: "avulso", status: "realizado", date: "2026-09-30" },
    ],
    orders: [
      { id: "order-1", status: "fechada", total: 90, closed_at: "2026-10-02T13:00:00-03:00" },
      { id: "order-2", status: "aberta", total: 1000, closed_at: null },
      { id: "order-3", status: "fechada", total: 100, closed_at: "2026-09-30T13:00:00-03:00" },
    ],
    orderItems: [
      { order_id: "order-1", kind: "servico", service_id: "cut", professional_id: "pro-1", qty: 2, unit_price: 40, commission_pct: 50 },
      { order_id: "order-1", kind: "produto", product_id: "pomade", professional_id: "pro-1", qty: 1, unit_price: 20, commission_pct: 10 },
      { order_id: "order-3", kind: "servico", service_id: "cut", professional_id: "pro-1", qty: 1, unit_price: 100, commission_pct: 50 },
    ],
    appointments: [
      shift("2026-09-30", "10:00", "11:00", "returning"),
      shift("2026-10-02", "09:00", "10:00", "returning"),
      shift("2026-10-02", "09:30", "10:30", "returning"),
      shift("2026-10-03", "11:00", "12:00", "new"),
      shift("2026-10-04", "13:00", "14:00", "cancelled", "cancelado"),
      shift("2026-10-05", "07:00", "08:00", "outside", "agendado"),
      shift("2026-09-29", "10:00", "11:00", "churned"),
      shift("2026-08-01", "10:00", "11:00", "inactive"),
    ],
    clients: [
      { id: "returning", name: "Cliente recorrente", created_at: "2026-05-01" },
      { id: "new", name: "Cliente novo", created_at: "2026-10-03" },
      { id: "churned", name: "Cliente sem retorno", created_at: "2026-09-01" },
      { id: "inactive", name: "Cliente inativo", created_at: "2026-08-01" },
    ],
    professionals: [
      {
        id: "pro-1",
        name: "Barbeiro 1",
        active: true,
        schedule_details: Object.fromEntries(
          ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].map(
            (day) => [day, { active: true, start: "09:00", end: "17:00" }],
          ),
        ),
      },
    ],
    services: [{ id: "cut", name: "Corte" }],
    products: [{ id: "pomade", name: "Pomada" }],
  };
}

describe("calculateDashboardAnalytics", () => {
  it("sums only realized revenue for the selected period and separates recurring income", () => {
    const analytics = calculateDashboardAnalytics(fixture());
    expect(analytics.revenue).toBe(154);
    expect(analytics.recurringRevenue).toBe(44);
    expect(analytics.oneOffRevenue).toBe(110);
    expect(analytics.netRevenue).toBe(140);
  });

  it("uses closed order totals, not all cash entries, for average ticket", () => {
    const analytics = calculateDashboardAnalytics(fixture());
    expect(analytics.closedOrders).toBe(1);
    expect(analytics.averageTicket).toBe(90);
  });

  it("calculates monthly recurring revenue from active subscriptions and normalizes billing cycles", () => {
    expect(
      calculateSubscriptionMrr(
        [
          { status: "ativa", starts_at: "2026-01-01", renews_at: "2026-11-01", plan: { price: 120, billing_cycle: "mensal" } },
          { status: "ativa", starts_at: "2026-01-01", renews_at: "2026-11-01", plan: { price: 300, billing_cycle: "trimestral" } },
          { status: "cancelada", starts_at: "2026-01-01", renews_at: "2026-11-01", plan: { price: 999, billing_cycle: "mensal" } },
          { status: "ativa", starts_at: "2026-01-01", renews_at: "2026-10-01", plan: { price: 999, billing_cycle: "mensal" } },
        ],
        "2026-10-17",
      ),
    ).toBe(220);
  });

  it("counts retained, churned, new, returning, and inactive customer cohorts", () => {
    const analytics = calculateDashboardAnalytics(fixture());
    expect(analytics.newClients).toBe(1);
    expect(analytics.returningClients).toBe(1);
    expect(analytics.retainedClients).toBe(1);
    expect(analytics.churnedClients).toBe(1);
    expect(analytics.retentionRate).toBe(50);
    expect(analytics.churnRate).toBe(50);
    expect(analytics.inactiveClients).toBe(2);
  });

  it("merges overlapping appointment intervals and excludes cancelled visits", () => {
    const analytics = calculateDashboardAnalytics(fixture());
    expect(analytics.occupiedMinutes).toBe(150);
    expect(analytics.availableMinutes).toBe(7 * 8 * 60);
    expect(analytics.occupationRate).toBeCloseTo((150 / (7 * 8 * 60)) * 100);
  });

  it("calculates financial health from realized income and expenses only", () => {
    const analytics = calculateDashboardAnalytics(fixture());
    expect(analytics.expenses).toBe(500);
    expect(analytics.operatingResult).toBe(-360);
  });

  it("ranks professionals, services, and products using closed orders in range only", () => {
    const analytics = calculateDashboardAnalytics(fixture());
    expect(analytics.professionals[0]).toMatchObject({
      name: "Barbeiro 1",
      revenue: 100,
      cuts: 2,
      commissions: 42,
    });
    expect(analytics.bestServices[0]).toMatchObject({ name: "Corte", quantity: 2, revenue: 80 });
    expect(analytics.bestProducts[0]).toMatchObject({ name: "Pomada", quantity: 1, revenue: 20 });
  });

  it("returns zero-safe metrics for an empty salon", () => {
    const analytics = calculateDashboardAnalytics({
      ...fixture(),
      transactions: [],
      orders: [],
      orderItems: [],
      appointments: [],
      clients: [],
      professionals: [],
    });
    expect(analytics.revenue).toBe(0);
    expect(analytics.averageTicket).toBe(0);
    expect(analytics.occupationRate).toBe(0);
    expect(analytics.retentionRate).toBe(0);
    expect(analytics.churnRate).toBe(0);
  });

  it("exports a readable executive CSV with rankings and period totals", () => {
    const rows = dashboardCsvRows(calculateDashboardAnalytics(fixture()));
    expect(rows).toContainEqual(["Faturamento", 154]);
    expect(rows).toContainEqual(["Desempenho por profissional", "Faturamento", "Cortes", "Comissões"]);
    expect(rows).toContainEqual(["Barbeiro 1", 100, 2, 42]);
  });
});

describe("periodRange", () => {
  it("resolves the preset ranges and keeps custom end dates within valid order", () => {
    expect(periodRange("today", "", "", "2026-10-17")).toEqual({
      start: "2026-10-17",
      end: "2026-10-17",
    });
    expect(periodRange("7days", "", "", "2026-10-17")).toEqual({
      start: "2026-10-11",
      end: "2026-10-17",
    });
    expect(periodRange("month", "", "", "2026-10-17")).toEqual({
      start: "2026-10-01",
      end: "2026-10-17",
    });
    expect(periodRange("custom", "2026-10-10", "2026-10-05", "2026-10-17")).toEqual({
      start: "2026-10-10",
      end: "2026-10-10",
    });
  });
});
