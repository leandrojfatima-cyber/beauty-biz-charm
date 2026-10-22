import { describe, expect, it } from "vitest";

describe("NEXADASH Commercial Subscriptions & Billing (Etapa 4)", () => {
  type Subscription = {
    id: string;
    customer_id: string;
    customer_name: string;
    plan_name: string;
    billing_cycle: "mensal" | "trimestral" | "semestral" | "anual";
    contracted_price: number;
    special_conditions?: string;
    started_at: string;
    valid_until: string;
    status: "ativa" | "trial" | "suspensa" | "cancelada" | "encerrada";
    next_due_date: string;
  };

  type Invoice = {
    id: string;
    subscription_id: string;
    customer_name: string;
    invoice_number: string;
    amount: number;
    due_date: string;
    status: "pendente" | "recebido" | "vencido" | "cancelado";
    payment_method: string;
    paid_at: string | null;
    confirmation_notes: string | null;
    payment_link?: string;
  };

  type Proposal = {
    id: string;
    lead_name: string;
    plan_name: string;
    price: number;
    discount: number;
    status: "enviada" | "aceita" | "recusada" | "cancelada";
  };

  const sampleProposals: Proposal[] = [
    { id: "prop-1", lead_name: "Barbearia Dom Barba", plan_name: "NEXADASH PRO", price: 59.9, discount: 10, status: "enviada" },
    { id: "prop-2", lead_name: "Navalha de Ouro", plan_name: "NEXADASH BUSINESS", price: 199.0, discount: 30, status: "aceita" },
  ];

  const sampleSubscriptions: Subscription[] = [
    {
      id: "sub-1",
      customer_id: "cust-1",
      customer_name: "Barbearia Retrô São Paulo",
      plan_name: "NEXADASH PRO",
      billing_cycle: "mensal",
      contracted_price: 59.9,
      started_at: "2026-08-15",
      valid_until: "2027-08-15",
      status: "ativa",
      next_due_date: "2026-11-15",
    },
    {
      id: "sub-2",
      customer_id: "cust-2",
      customer_name: "Clube dos Homens",
      plan_name: "NEXADASH IA",
      billing_cycle: "mensal",
      contracted_price: 99.9,
      started_at: "2026-09-01",
      valid_until: "2027-09-01",
      status: "ativa",
      next_due_date: "2026-11-01",
    },
    {
      id: "sub-3",
      customer_id: "cust-3",
      customer_name: "Studio Vintage",
      plan_name: "NEXADASH START",
      billing_cycle: "mensal",
      contracted_price: 29.9,
      started_at: "2026-07-01",
      valid_until: "2027-07-01",
      status: "suspensa",
      next_due_date: "2026-10-05",
    },
  ];

  const sampleInvoices: Invoice[] = [
    {
      id: "inv-1",
      subscription_id: "sub-1",
      customer_name: "Barbearia Retrô São Paulo",
      invoice_number: "FAT-2026-001",
      amount: 59.9,
      due_date: "2026-10-15",
      status: "recebido",
      payment_method: "Pix",
      paid_at: "2026-10-14T14:32:00Z",
      confirmation_notes: "Confirmado: Pix Banco Inter - E2E-994827103",
      payment_link: "https://pix.nexadash.com.br/FAT-2026-001",
    },
    {
      id: "inv-2",
      subscription_id: "sub-2",
      customer_name: "Clube dos Homens",
      invoice_number: "FAT-2026-002",
      amount: 99.9,
      due_date: "2026-10-25",
      status: "pendente",
      payment_method: "Pix Direto NEXADASH",
      paid_at: null,
      confirmation_notes: null,
      payment_link: "https://pix.nexadash.com.br/FAT-2026-002",
    },
    {
      id: "inv-3",
      subscription_id: "sub-3",
      customer_name: "Studio Vintage",
      invoice_number: "FAT-2026-003",
      amount: 29.9,
      due_date: "2026-10-05",
      status: "vencido",
      payment_method: "Boleto",
      paid_at: null,
      confirmation_notes: null,
    },
  ];

  it("distinguishes proposals, active sales, contracted revenue, billed amounts and confirmed receipts", () => {
    // 1. Propostas em aberto
    const pendingProposals = sampleProposals.filter((p) => p.status === "enviada");
    const proposalVolume = pendingProposals.reduce((sum, p) => sum + (p.price - p.discount), 0);
    expect(pendingProposals).toHaveLength(1);
    expect(proposalVolume).toBe(49.9);

    // 2. Vendas Fechadas (Assinaturas Ativas)
    const activeSubs = sampleSubscriptions.filter((s) => s.status === "ativa");
    expect(activeSubs).toHaveLength(2);

    // 3. Valores Contratados (MRR / ARR)
    const mrr = activeSubs.reduce((sum, s) => sum + s.contracted_price, 0);
    expect(mrr).toBeCloseTo(159.8, 2);
    const arr = mrr * 12;
    expect(arr).toBeCloseTo(1917.6, 2);

    // 4. Cobranças Emitidas
    const totalBilled = sampleInvoices.reduce((sum, i) => sum + i.amount, 0);
    expect(totalBilled).toBeCloseTo(189.7, 2);

    // 5. Pagamentos Efetivamente Recebidos (Confirmados)
    const totalReceived = sampleInvoices
      .filter((i) => i.status === "recebido")
      .reduce((sum, i) => sum + i.amount, 0);
    expect(totalReceived).toBeCloseTo(59.9, 2);

    // 6. Inadimplência em Aberto
    const totalOverdue = sampleInvoices
      .filter((i) => i.status === "vencido")
      .reduce((sum, i) => sum + i.amount, 0);
    expect(totalOverdue).toBeCloseTo(29.9, 2);
  });

  it("strictly enforces confirmation requirement before marking invoice as received", () => {
    function confirmInvoicePayment(
      invoice: Invoice,
      confirmation: { paid_at: string; transaction_code: string; method: string; notes?: string }
    ): { success: boolean; updatedInvoice?: Invoice; error?: string } {
      if (!confirmation.transaction_code || !confirmation.transaction_code.trim()) {
        return { success: false, error: "Nenhum pagamento pode ser registrado sem código de autenticação/transação válido." };
      }
      if (!confirmation.paid_at) {
        return { success: false, error: "Data efetiva do crédito é obrigatória." };
      }

      return {
        success: true,
        updatedInvoice: {
          ...invoice,
          status: "recebido",
          payment_method: confirmation.method,
          paid_at: new Date(confirmation.paid_at).toISOString(),
          confirmation_notes: `Confirmado: ${confirmation.method} - Cód: ${confirmation.transaction_code}. ${confirmation.notes || ""}`.trim(),
        },
      };
    }

    const pendingInvoice = sampleInvoices[1]!;

    // Tentativa de marcar como recebido sem código de transação
    const invalidAttempt = confirmInvoicePayment(pendingInvoice, {
      paid_at: "2026-10-16",
      transaction_code: "",
      method: "Pix",
    });
    expect(invalidAttempt.success).toBe(false);
    expect(invalidAttempt.error).toContain("Nenhum pagamento pode ser registrado");

    // Confirmação válida e auditada
    const validAttempt = confirmInvoicePayment(pendingInvoice, {
      paid_at: "2026-10-16",
      transaction_code: "E2E-NX-77889900",
      method: "Pix Direto NEXADASH",
      notes: "Aprovado via Gateway Direto NEXADASH",
    });
    expect(validAttempt.success).toBe(true);
    expect(validAttempt.updatedInvoice?.status).toBe("recebido");
    expect(validAttempt.updatedInvoice?.confirmation_notes).toContain("E2E-NX-77889900");
  });

  it("handles online payments via payment links and manual payments via Pix/Boleto", () => {
    const onlineInvoice = sampleInvoices.find((i) => Boolean(i.payment_link));
    expect(onlineInvoice?.payment_link).toBeDefined();
    expect(onlineInvoice?.payment_link).toMatch(/^https:\/\//);

    const manualInvoice = sampleInvoices.find((i) => i.payment_method === "Boleto");
    expect(manualInvoice?.payment_link).toBeUndefined();
    expect(manualInvoice?.payment_method).toBe("Boleto");
  });

  it("manages subscription lifecycle (renewal, suspension, reactivation)", () => {
    let sub = { ...sampleSubscriptions[0]! };
    expect(sub.status).toBe("ativa");

    // Suspender por inadimplência
    sub = { ...sub, status: "suspensa" };
    expect(sub.status).toBe("suspensa");

    // Reativar / Renovar adicionando ciclo
    const nextDate = new Date(sub.next_due_date);
    nextDate.setMonth(nextDate.getMonth() + 1);
    sub = { ...sub, status: "ativa", next_due_date: nextDate.toISOString().slice(0, 10) };

    expect(sub.status).toBe("ativa");
    expect(sub.next_due_date).toBe("2026-12-15");
  });
});
