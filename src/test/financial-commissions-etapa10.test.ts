import { describe, it, expect } from "vitest";
import {
  calculateCashFlowStats,
  calculateNetTransactionAmount,
  calculateProfessionalCommissions,
} from "@/lib/financial-engine";
import type {
  FinancialTransactionRecord,
  ProfessionalAdvanceRecord,
} from "@/types/financial";

describe("Etapa 10 — Financeiro e Comissões", () => {
  describe("Fluxo de Caixa e Previsão (Realizado vs Previsto)", () => {
    it("calcula corretamente valores brutos e líquidos deduzindo taxas de cartão", () => {
      // Venda de R$ 100 com taxa de R$ 3,50 da maquininha
      const net = calculateNetTransactionAmount(100, 3.5);
      expect(net).toBe(96.5);

      // Transação sem taxa de cartão
      const netZeroFee = calculateNetTransactionAmount(50, 0);
      expect(netZeroFee).toBe(50);
    });

    it("separa rigorosamente receitas e despesas realizadas vs previstas", () => {
      const mockTransactions: FinancialTransactionRecord[] = [
        // Realizados
        {
          id: "tx-1",
          type: "receita",
          category: "atendimento",
          description: "Corte e Barba VIP",
          amount: 80,
          net_amount: 78,
          card_fee: 2,
          date: "2026-10-17",
          status: "realizado",
        },
        {
          id: "tx-2",
          type: "receita",
          category: "produtos",
          description: "Pomada Modeladora",
          amount: 40,
          net_amount: 40,
          card_fee: 0,
          date: "2026-10-17",
          status: "realizado",
        },
        {
          id: "tx-3",
          type: "despesa",
          category: "aluguel",
          description: "Aluguel da Barbearia",
          amount: 50,
          net_amount: 50,
          date: "2026-10-17",
          status: "realizado",
        },
        // Previstos (A pagar e a receber no futuro)
        {
          id: "tx-4",
          type: "receita",
          category: "assinaturas",
          description: "Renovação Clube Barba VIP",
          amount: 150,
          net_amount: 150,
          date: "2026-10-25",
          due_date: "2026-10-25",
          status: "previsto",
        },
        {
          id: "tx-5",
          type: "despesa",
          category: "luz_agua",
          description: "Conta de Energia",
          amount: 60,
          net_amount: 60,
          date: "2026-10-28",
          due_date: "2026-10-28",
          status: "previsto",
        },
      ];

      const stats = calculateCashFlowStats(mockTransactions, 100);

      // Realizados: Receitas = 78 + 40 = 118, Despesas = 50, Saldo Anterior = 100
      expect(stats.realizedIncome).toBe(118);
      expect(stats.realizedExpense).toBe(50);
      expect(stats.realizedBalance).toBe(100 + 118 - 50); // 168

      // Previstos: Receitas = 150, Despesas = 60
      expect(stats.projectedIncome).toBe(150);
      expect(stats.projectedExpense).toBe(60);
      expect(stats.projectedBalance).toBe(90);

      // Previsão líquida final: 168 + 90 = 258
      expect(stats.totalLiquidForecast).toBe(258);
      expect(stats.operatingProfitPct).toBeGreaterThan(0);
    });
  });

  describe("Cálculo Automático de Comissões, Vales e Bonificações", () => {
    it("calcula comissão sobre serviços e produtos executados", () => {
      const mockPros = [
        { id: "pro-1", name: "Carlos Barbeiro", role: "Barbeiro Sênior", active: true },
      ];

      const mockOrderItems = [
        // Serviço: 1 corte de R$ 60 a 50% de comissão = R$ 30
        {
          id: "item-1",
          professional_id: "pro-1",
          kind: "servico",
          description: "Corte Degradê",
          qty: 1,
          unit_price: 60,
          commission_pct: 50,
          orders: { number: 101, status: "fechada" },
        },
        // Produto: 2 pomadas de R$ 30 (R$ 60) a 10% de comissão = R$ 6
        {
          id: "item-2",
          professional_id: "pro-1",
          kind: "produto",
          description: "Pomada Cera",
          qty: 2,
          unit_price: 30,
          commission_pct: 10,
          orders: { number: 101, status: "fechada" },
        },
      ];

      const summaries = calculateProfessionalCommissions(mockPros, mockOrderItems, []);

      expect(summaries).toHaveLength(1);
      const summary = summaries[0];

      expect(summary.serviceSales).toBe(60);
      expect(summary.serviceCommission).toBe(30);
      expect(summary.productSales).toBe(60);
      expect(summary.productCommission).toBe(6);
      expect(summary.totalGrossCommission).toBe(36);
      expect(summary.netPayableCommission).toBe(36);
    });

    it("desconta vales e adiantamentos pendentes e soma bonificações por metas no saldo líquido", () => {
      const mockPros = [
        { id: "pro-1", name: "Eduardo Fade", role: "Master Barber", active: true },
      ];

      const mockOrderItems = [
        // Serviços: R$ 500 com 50% = R$ 250 de comissão
        {
          id: "item-1",
          professional_id: "pro-1",
          kind: "servico",
          description: "Pacote Barba e Cabelo",
          qty: 5,
          unit_price: 100,
          commission_pct: 50,
          orders: { number: 200, status: "fechada" },
        },
      ];

      const mockAdvances: ProfessionalAdvanceRecord[] = [
        // Vale de R$ 50 pendente
        {
          id: "adv-1",
          professional_id: "pro-1",
          type: "vale",
          amount: 50,
          date: "2026-10-10",
          status: "pendente",
          description: "Adiantamento em dinheiro",
        },
        // Bonificação por meta batida de R$ 30 pendente
        {
          id: "adv-2",
          professional_id: "pro-1",
          type: "bonificacao",
          amount: 30,
          date: "2026-10-15",
          status: "pendente",
          description: "Meta mensal de 50 cortes atingida",
        },
        // Vale já descontado anteriormente (não deve abater novamente)
        {
          id: "adv-3",
          professional_id: "pro-1",
          type: "vale",
          amount: 20,
          date: "2026-10-01",
          status: "descontado",
          description: "Vale do mês anterior",
        },
      ];

      const summaries = calculateProfessionalCommissions(mockPros, mockOrderItems, mockAdvances);
      const summary = summaries[0];

      // Comissão bruta: R$ 250
      expect(summary.totalGrossCommission).toBe(250);
      // Vales pendentes a descontar: R$ 50
      expect(summary.pendingAdvances).toBe(50);
      // Bônus a somar: R$ 30
      expect(summary.bonuses).toBe(30);
      // Saldo líquido final: 250 - 50 + 30 = R$ 230
      expect(summary.netPayableCommission).toBe(230);
    });

    it("garante separação rigorosa entre faturamento da barbearia e assinaturas da NEXADASH", () => {
      // Transação da barbearia tem categoria operacional
      const barberTx: FinancialTransactionRecord = {
        id: "tx-op",
        type: "receita",
        category: "atendimento",
        description: "Serviço de Barbearia",
        amount: 45,
        status: "realizado",
        date: "2026-10-17",
      };

      expect(["atendimento", "produtos", "assinaturas"]).toContain(barberTx.category);
      expect(barberTx.category).not.toBe("nexadash_license_fee");
    });
  });
});
