import type {
  CashFlowStats,
  FinancialCategory,
  FinancialTransactionRecord,
  PaymentMethod,
  ProfessionalAdvanceRecord,
  ProfessionalCommissionSummary,
} from "@/types/financial";
import type { ProfessionalData, SalonSettingsData } from "@/types/salon";
import { brl, fmtDate } from "@/lib/db";

export const FINANCIAL_CATEGORY_LABELS: Record<FinancialCategory | string, string> = {
  atendimento: "Serviços e Atendimentos",
  produtos: "Venda de Produtos",
  assinaturas: "Assinaturas do Clube (Clientes)",
  comissões: "Comissões dos Barbeiros",
  vales: "Vales e Adiantamentos",
  aluguel: "Aluguel e Condomínio",
  estoque: "Compra de Estoque / Insumos",
  luz_agua: "Luz, Água e Internet",
  taxas_cartao: "Taxas de Cartão / Maquininha",
  marketing: "Marketing e Divulgação",
  impostos: "Impostos e Tributos",
  equipamentos: "Manutenção e Equipamentos",
  geral: "Despesas Gerais",
  outros: "Outros Lançamentos",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod | string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  assinatura_clube: "Assinatura / Clube",
  boleto: "Boleto",
  outro: "Outro",
};

export const ADVANCE_TYPE_LABELS = {
  vale: { label: "Vale Compras / Retirada", isDeduction: true },
  adiantamento: { label: "Adiantamento Salarial / Pix", isDeduction: true },
  bonificacao: { label: "Bonificação por Meta", isDeduction: false },
  ajuste: { label: "Ajuste / Acerto", isDeduction: true },
};

/**
 * Calcula o valor líquido da transação após dedução da taxa de cartão
 */
export function calculateNetTransactionAmount(amount: number, cardFee: number = 0): number {
  const gross = Number(amount) || 0;
  const fee = Number(cardFee) || 0;
  return Math.max(0, gross - fee);
}

/**
 * Calcula estatísticas do fluxo de caixa separando Realizado vs Previsto
 */
export function calculateCashFlowStats(
  transactions: FinancialTransactionRecord[],
  balanceBefore = 0,
): CashFlowStats {
  let realizedIncome = 0;
  let realizedExpense = 0;
  let projectedIncome = 0;
  let projectedExpense = 0;

  for (const tx of transactions) {
    if (tx.status === "cancelado") continue;

    const netAmount = Number(tx.net_amount ?? tx.amount) || 0;

    if (tx.status === "realizado") {
      if (tx.type === "receita") {
        realizedIncome += netAmount;
      } else {
        realizedExpense += netAmount;
      }
    } else if (tx.status === "previsto") {
      if (tx.type === "receita") {
        projectedIncome += netAmount;
      } else {
        projectedExpense += netAmount;
      }
    }
  }

  const realizedBalance = balanceBefore + realizedIncome - realizedExpense;
  const projectedBalance = projectedIncome - projectedExpense;
  const totalLiquidForecast = realizedBalance + projectedBalance;
  const operatingProfitPct =
    realizedIncome > 0
      ? Math.round(((realizedIncome - realizedExpense) / realizedIncome) * 100)
      : 0;

  return {
    realizedIncome,
    realizedExpense,
    realizedBalance,
    projectedIncome,
    projectedExpense,
    projectedBalance,
    balanceBefore,
    totalLiquidForecast,
    operatingProfitPct,
  };
}

/**
 * Motor de apuração de comissões por barbeiro considerando serviços,
 * produtos, vales abatidos e bonificações por metas.
 */
export function calculateProfessionalCommissions(
  professionals: ProfessionalData[] | any[],
  orderItems: any[],
  advances: ProfessionalAdvanceRecord[] = [],
  subscriptions: any[] = [],
): ProfessionalCommissionSummary[] {
  return professionals
    .map((pro) => {
      // Itens de comandas fechadas realizados pelo profissional
      const proItems = orderItems.filter((i) => i.professional_id === pro.id);

      const sumKind = (kind: string, calc: (i: any) => number) =>
        proItems.filter((i) => i.kind === kind).reduce((acc, i) => acc + calc(i), 0);

      const itemTotal = (i: any) => (Number(i.qty) || 1) * (Number(i.unit_price) || 0);
      const itemComm = (i: any) => (itemTotal(i) * (Number(i.commission_pct) || 0)) / 100;

      const serviceSales = sumKind("servico", itemTotal);
      const serviceCommission = sumKind("servico", itemComm);

      const productSales = sumKind("produto", itemTotal);
      const productCommission = sumKind("produto", itemComm);

      // Comissões sobre assinaturas vinculadas (se houver profissional atribuído)
      const proSubscriptions = subscriptions.filter(
        (s) => s.professional_id === pro.id && s.status === "ativa",
      );
      const subscriptionSales = proSubscriptions.reduce(
        (acc, s) => acc + (Number(s.plans?.price) || 0),
        0,
      );
      // Por padrão comissão de assinatura se configurada ou 10%
      const subscriptionCommission = proSubscriptions.reduce(
        (acc, s) =>
          acc +
          ((Number(s.plans?.price) || 0) * (Number(s.professional_commission_pct) || 10)) / 100,
        0,
      );

      const totalGrossCommission =
        serviceCommission + productCommission + subscriptionCommission;

      // Vales, adiantamentos e bonificações vinculados
      const proAdvances = advances.filter((a) => a.professional_id === pro.id);

      // Vales e adiantamentos pendentes para dedução
      const pendingAdvances = proAdvances
        .filter((a) => (a.type === "vale" || a.type === "adiantamento") && a.status === "pendente")
        .reduce((acc, a) => acc + Number(a.amount || 0), 0);

      // Bonificações por metas para somar
      const bonuses = proAdvances
        .filter((a) => a.type === "bonificacao" && a.status === "pendente")
        .reduce((acc, a) => acc + Number(a.amount || 0), 0);

      const netPayableCommission = Math.max(0, totalGrossCommission - pendingAdvances + bonuses);

      return {
        professional: pro,
        orderItems: proItems,
        advances: proAdvances,
        serviceSales,
        serviceCommission,
        productSales,
        productCommission,
        subscriptionSales,
        subscriptionCommission,
        totalGrossCommission,
        pendingAdvances,
        bonuses,
        netPayableCommission,
      };
    })
    .filter((summary) => summary.orderItems.length > 0 || summary.advances.length > 0 || summary.professional.active);
}

/**
 * Exportar lançamentos de transações para arquivo CSV
 */
export function exportTransactionsToCsv(
  transactions: FinancialTransactionRecord[],
  filename = "fluxo_de_caixa.csv",
) {
  const headers = [
    "Data",
    "Tipo",
    "Categoria",
    "Descrição",
    "Valor Bruto (R$)",
    "Taxa Cartão (R$)",
    "Valor Líquido (R$)",
    "Status",
    "Forma de Pagamento",
    "Data Vencimento",
  ];

  const rows = transactions.map((t) => [
    t.date,
    t.type === "receita" ? "Receita" : "Despesa",
    FINANCIAL_CATEGORY_LABELS[t.category] || t.category,
    `"${(t.description || "").replace(/"/g, '""')}"`,
    Number(t.amount).toFixed(2),
    Number(t.card_fee || 0).toFixed(2),
    Number(t.net_amount ?? t.amount).toFixed(2),
    t.status === "realizado" ? "Realizado" : t.status === "previsto" ? "Previsto" : "Cancelado",
    PAYMENT_METHOD_LABELS[t.payment_method || ""] || t.payment_method || "-",
    t.due_date || "-",
  ]);

  const csvContent =
    "data:text/csv;charset=utf-8,\uFEFF" +
    [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exportar fechamento de comissões para arquivo CSV
 */
export function exportCommissionsToCsv(
  summaries: ProfessionalCommissionSummary[],
  period: { start: string; end: string },
) {
  const headers = [
    "Profissional",
    "Vendas Serviços (R$)",
    "Comissão Serviços (R$)",
    "Vendas Produtos (R$)",
    "Comissão Produtos (R$)",
    "Comissão Bruta Total (R$)",
    "Vales/Adiantamentos (-) (R$)",
    "Bonificações (+) (R$)",
    "Saldo Líquido a Pagar (R$)",
  ];

  const rows = summaries.map((s) => [
    `"${s.professional.name}"`,
    s.serviceSales.toFixed(2),
    s.serviceCommission.toFixed(2),
    s.productSales.toFixed(2),
    s.productCommission.toFixed(2),
    s.totalGrossCommission.toFixed(2),
    s.pendingAdvances.toFixed(2),
    s.bonuses.toFixed(2),
    s.netPayableCommission.toFixed(2),
  ]);

  const csvContent =
    "data:text/csv;charset=utf-8,\uFEFF" +
    [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `comissoes_${period.start}_a_${period.end}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Gera visualização HTML formatada para impressão direta / salvar em PDF
 * do extrato individual de prestação de contas do barbeiro.
 */
export function printProfessionalStatement(
  salon: SalonSettingsData | null,
  summary: ProfessionalCommissionSummary,
  period: { start: string; end: string },
) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const salonName = salon?.name || "BELEZI Barbearia";
  const proName = summary.professional.name;
  const startFmt = fmtDate(period.start);
  const endFmt = fmtDate(period.end);

  const itemsRows = summary.orderItems
    .map(
      (item) => `
      <tr>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">#${item.orders?.number || "-"}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.kind === "servico" ? "Serviço" : "Produto"}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${brl(Number(item.qty) * Number(item.unit_price))}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${Number(item.commission_pct)}%</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${brl((Number(item.qty) * Number(item.unit_price) * Number(item.commission_pct)) / 100)}</td>
      </tr>`,
    )
    .join("");

  const advancesRows = summary.advances
    .filter((a) => a.status === "pendente" || a.status === "descontado")
    .map(
      (adv) => `
      <tr>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${fmtDate(adv.date)}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${adv.description}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${adv.type === "bonificacao" ? '<span style="color: #059669;">Bonificação (+)</span>' : '<span style="color: #dc2626;">Vale/Adiantamento (-)</span>'}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${brl(adv.amount)}</td>
      </tr>`,
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <title>Extrato de Comissão — ${proName}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1f2937; margin: 30px; font-size: 13px; line-height: 1.4; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #111827; padding-bottom: 16px; margin-bottom: 20px; }
        .title { font-size: 20px; font-weight: bold; margin: 0; color: #111827; }
        .subtitle { font-size: 12px; color: #6b7280; margin-top: 4px; }
        .summary-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 24px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .stat-label { font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 600; }
        .stat-value { font-size: 16px; font-weight: bold; color: #111827; margin-top: 2px; }
        .table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 24px; font-size: 12px; }
        .table th { background: #f3f4f6; padding: 8px; text-align: left; font-weight: 600; border-bottom: 1px solid #d1d5db; }
        .section-title { font-size: 14px; font-weight: bold; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
        .signatures { margin-top: 48px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
        .signature-line { border-top: 1px solid #9ca3af; padding-top: 8px; text-align: center; font-size: 11px; }
        @media print { body { margin: 15mm; } .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1 class="title">${salonName}</h1>
          <div class="subtitle">Prestação de Contas & Fechamento de Comissões</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: bold; font-size: 14px;">${proName}</div>
          <div class="subtitle">Período: ${startFmt} a ${endFmt}</div>
        </div>
      </div>

      <div class="summary-card">
        <div>
          <div class="stat-label">Comissão Serviços</div>
          <div class="stat-value">${brl(summary.serviceCommission)}</div>
        </div>
        <div>
          <div class="stat-label">Comissão Produtos</div>
          <div class="stat-value">${brl(summary.productCommission)}</div>
        </div>
        <div>
          <div class="stat-label">Vales & Descontos</div>
          <div class="stat-value" style="color: #dc2626;">- ${brl(summary.pendingAdvances)}</div>
        </div>
        <div>
          <div class="stat-label">Líquido a Pagar</div>
          <div class="stat-value" style="color: #059669; font-size: 18px;">${brl(summary.netPayableCommission)}</div>
        </div>
      </div>

      <div class="section-title">Detalhamento dos Serviços e Produtos Executados (${summary.orderItems.length})</div>
      <table class="table">
        <thead>
          <tr>
            <th>Comanda</th>
            <th>Item / Descrição</th>
            <th style="text-align: center;">Tipo</th>
            <th style="text-align: right;">Valor Venda</th>
            <th style="text-align: right;">% Com.</th>
            <th style="text-align: right;">Comissão</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows || '<tr><td colspan="6" style="padding: 12px; text-align: center; color: #9ca3af;">Nenhum item registrado no período.</td></tr>'}
        </tbody>
      </table>

      ${
        advancesRows
          ? `
        <div class="section-title">Vales, Adiantamentos e Bonificações</div>
        <table class="table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th style="text-align: center;">Tipo</th>
              <th style="text-align: right;">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${advancesRows}
          </tbody>
        </table>
      `
          : ""
      }

      <div style="background: #f9fafb; border: 1px dashed #d1d5db; padding: 12px; border-radius: 6px; font-size: 11px; color: #4b5563; margin-top: 16px;">
        <strong>Declaração de Quitação:</strong> Confirmo o recebimento integral dos valores correspondentes às comissões do período acima apurado, dando plena e geral quitação de quaisquer diferenças.
      </div>

      <div class="signatures">
        <div>
          <div style="height: 40px;"></div>
          <div class="signature-line">
            <strong>${proName}</strong><br>
            Barbeiro / Profissional
          </div>
        </div>
        <div>
          <div style="height: 40px;"></div>
          <div class="signature-line">
            <strong>${salonName}</strong><br>
            Administração / Financeiro
          </div>
        </div>
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
