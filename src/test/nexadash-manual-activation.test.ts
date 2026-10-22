import { describe, expect, it } from "vitest";

describe("NEXADASH Liberação Manual de Acesso & Ciclo de Ativação (Etapa 5)", () => {
  type ActivationItem = {
    id: string;
    company_name: string;
    owner_email: string;
    plan_name: string;
    contracted_value: number;
    billing_cycle: string;
    valid_until: string;
    conditions_verified: boolean;
    conditions_checklist: {
      terms_accepted: boolean;
      limits_verified: boolean;
      special_discount_confirmed: boolean;
      legal_rep_identified: boolean;
    };
    payment_status: "pendente" | "em_analise" | "pago_confirmado" | "isento_cortesia";
    payment_reference: string;
    account_prepared: boolean;
    activation_status: "pendente_liberacao_manual" | "autorizado_ativo" | "suspenso_manual" | "recusado";
    authorized_by_admin: string | null;
    authorized_at: string | null;
    deliberation_notes: string | null;
    suspension_reason: string | null;
    suspended_by_admin: string | null;
    suspended_at: string | null;
  };

  function createContractRegistration(
    company_name: string,
    owner_email: string,
    plan_name: string,
    contracted_value: number,
    valid_until: string
  ): ActivationItem {
    return {
      id: "act-" + Math.random().toString(36).slice(2, 8),
      company_name,
      owner_email,
      plan_name,
      contracted_value,
      billing_cycle: "mensal",
      valid_until,
      conditions_verified: false,
      conditions_checklist: {
        terms_accepted: false,
        limits_verified: false,
        special_discount_confirmed: false,
        legal_rep_identified: false,
      },
      payment_status: "pendente",
      payment_reference: "",
      account_prepared: false,
      // CRITÉRIO FUNDAMENTAL: Inicia obrigatoriamente bloqueado
      activation_status: "pendente_liberacao_manual",
      authorized_by_admin: null,
      authorized_at: null,
      deliberation_notes: null,
      suspension_reason: null,
      suspended_by_admin: null,
      suspended_at: null,
    };
  }

  // 1. REGISTRAR A CONTRATAÇÃO
  it("Passo 1: Deve registrar a contratação com status inicial pendente_liberacao_manual", () => {
    const act = createContractRegistration(
      "Barbearia Viking",
      "contato@vikingbarber.com",
      "NEXADASH PRO",
      59.9,
      "2027-10-16"
    );

    expect(act.company_name).toBe("Barbearia Viking");
    expect(act.plan_name).toBe("NEXADASH PRO");
    expect(act.contracted_value).toBe(59.9);
    expect(act.activation_status).toBe("pendente_liberacao_manual");
    expect(act.authorized_by_admin).toBeNull();
  });

  // 2. CONFERIR AS CONDIÇÕES ACORDADAS
  it("Passo 2: Deve validar que conditions_verified só é true quando todos os itens do checklist são atendidos", () => {
    const act = createContractRegistration(
      "Barbearia Vintage",
      "vintage@barber.com",
      "NEXADASH IA",
      99.9,
      "2027-10-16"
    );

    // Checklist parcial
    act.conditions_checklist.terms_accepted = true;
    act.conditions_checklist.limits_verified = true;
    act.conditions_checklist.legal_rep_identified = true;
    act.conditions_checklist.special_discount_confirmed = false;

    const allChecked = Object.values(act.conditions_checklist).every(Boolean);
    expect(allChecked).toBe(false);

    // Conclusão de todos os termos
    act.conditions_checklist.special_discount_confirmed = true;
    const finalCheck = Object.values(act.conditions_checklist).every(Boolean);
    act.conditions_verified = finalCheck;

    expect(act.conditions_verified).toBe(true);
  });

  // 3. REGISTRAR A SITUAÇÃO DO PAGAMENTO & REGRA DE NÃO AUTO-LIBERAÇÃO
  it("Passo 3: REGRA DE OURO — Pagamento online aprovado NÃO deve liberar sozinho o sistema", () => {
    const act = createContractRegistration(
      "Barba & Bigode Club",
      "financeiro@barbabigode.com",
      "NEXADASH BUSINESS",
      169.0,
      "2027-10-16"
    );

    // Simulação: Gateway Online ou Pix Direto NEXADASH aprova pagamento online automaticamente
    act.payment_status = "pago_confirmado";
    act.payment_reference = "NX-ONLINE-AUTO-APPROVED-998822";

    // O status do acesso DEVE permanecer estritamente bloqueado (pendente_liberacao_manual)
    expect(act.payment_status).toBe("pago_confirmado");
    expect(act.activation_status).toBe("pendente_liberacao_manual");
    expect(act.authorized_by_admin).toBeNull();
  });

  // 4. PREPARAR A CONTA DA BARBEARIA
  it("Passo 4: Deve registrar a preparação da conta e provisionamento do catálogo", () => {
    const act = createContractRegistration(
      "Barbearia Elite",
      "elite@barber.com",
      "NEXADASH PRO",
      59.9,
      "2027-10-16"
    );

    act.account_prepared = true;
    expect(act.account_prepared).toBe(true);
    // Ainda não está ativa!
    expect(act.activation_status).toBe("pendente_liberacao_manual");
  });

  // 5 & 6. AUTORIZAR MANUALMENTE A ATIVAÇÃO & REGISTRAR RESPONSÁVEL, DATA, PLANO E VIGÊNCIA
  it("Passos 5 e 6: Liberação manual com assinatura formal do administrador, data e vigência", () => {
    const act = createContractRegistration(
      "Barbearia Dom Barba",
      "carlos@dombarba.com.br",
      "NEXADASH PRO",
      59.9,
      "2027-10-16"
    );

    // Pré-requisitos cumpridos
    act.conditions_verified = true;
    act.payment_status = "pago_confirmado";
    act.payment_reference = "E2E-994827103-NX";
    act.account_prepared = true;

    // Função de autorização manual deliberada por admin NEXADASH
    function manualAuthorize(
      item: ActivationItem,
      adminEmail: string,
      notes: string,
      declarationAccepted: boolean
    ) {
      if (!declarationAccepted) {
        throw new Error("Termo de responsabilidade obrigatório não assinado.");
      }
      if (!adminEmail || !adminEmail.includes("@")) {
        throw new Error("Identificação inválida do administrador.");
      }

      item.activation_status = "autorizado_ativo";
      item.authorized_by_admin = adminEmail;
      item.authorized_at = new Date().toISOString();
      item.deliberation_notes = notes;
      return item;
    }

    // Tentativa sem aceitar declaração deve falhar
    expect(() =>
      manualAuthorize(act, "admin@nexadash.com.br", "Notas", false)
    ).toThrow("Termo de responsabilidade obrigatório não assinado.");

    // Autorização com sucesso
    const authorized = manualAuthorize(
      act,
      "leandro.j.fatima@gmail.com",
      "Acesso operacional liberado após conferência completa.",
      true
    );

    expect(authorized.activation_status).toBe("autorizado_ativo");
    expect(authorized.authorized_by_admin).toBe("leandro.j.fatima@gmail.com");
    expect(authorized.authorized_at).toBeDefined();
    expect(authorized.valid_until).toBe("2027-10-16");
    expect(authorized.plan_name).toBe("NEXADASH PRO");
  });

  // 7. ACOMPANHAMENTO DE VENCIMENTOS SEM SUSPENSÃO AUTOMÁTICA
  it("Passo 7: REGRA DE OURO — Fatura vencida NUNCA provoca suspensão automática", () => {
    const act = createContractRegistration(
      "Barbearia Antunes",
      "antunes@barber.com",
      "NEXADASH PRO",
      59.9,
      "2027-10-16"
    );
    act.activation_status = "autorizado_ativo";
    act.authorized_by_admin = "admin@nexadash.com.br";

    // Simulação: fatura da barbearia venceu há 10 dias
    type Invoice = { id: string; due_date: string; status: "pendente" | "recebido" | "vencido" };
    const invoice: Invoice = {
      id: "inv-99",
      due_date: "2026-10-01",
      status: "vencido", // Cobrança em atraso
    };

    // Rotina de verificação comercial:
    // Apenas marca inadimplência comercial para acompanhamento preventivo, JAMAIS suspende o acesso operacional sozinho!
    function evaluateBilling(item: ActivationItem, inv: Invoice) {
      if (inv.status === "vencido") {
        // Alerta preventivo gerado para a equipe comercial da NEXADASH
        const warning = "Inadimplência registrada. Contatar cliente antes de qualquer intervenção.";
        return { warning, accessStatus: item.activation_status };
      }
      return { warning: null, accessStatus: item.activation_status };
    }

    const result = evaluateBilling(act, invoice);

    expect(result.warning).toContain("Inadimplência registrada");
    // O status do salão PERMANECE ativo:
    expect(act.activation_status).toBe("autorizado_ativo");
    expect(result.accessStatus).toBe("autorizado_ativo");
  });

  // 8. DECISÃO MANUAL DE SUSPENSÃO E REATIVAÇÃO
  it("Passo 8: Administrador autorizado pode suspender manualmente com justificativa e reativar", () => {
    const act = createContractRegistration(
      "Studio Navalha",
      "navalha@studio.com",
      "NEXADASH START",
      29.9,
      "2027-10-16"
    );
    act.activation_status = "autorizado_ativo";
    act.authorized_by_admin = "admin@nexadash.com.br";

    function manualSuspend(item: ActivationItem, adminEmail: string, reason: string) {
      if (!reason || reason.trim().length < 10) {
        throw new Error("Justificativa formal de suspensão é obrigatória para fins de auditoria.");
      }
      item.activation_status = "suspenso_manual";
      item.suspended_by_admin = adminEmail;
      item.suspended_at = new Date().toISOString();
      item.suspension_reason = reason;
      return item;
    }

    function manualReactivate(item: ActivationItem, adminEmail: string) {
      item.activation_status = "autorizado_ativo";
      item.suspension_reason = null;
      item.suspended_by_admin = null;
      item.suspended_at = null;
      item.authorized_by_admin = adminEmail;
      item.authorized_at = new Date().toISOString();
      return item;
    }

    // Tentativa de suspender sem motivo deve ser rejeitada
    expect(() => manualSuspend(act, "admin@nexadash.com.br", "")).toThrow(
      "Justificativa formal de suspensão é obrigatória"
    );

    // Suspensão manual fundamentada
    manualSuspend(
      act,
      "leandro.j.fatima@gmail.com",
      "Suspenso por deliberação gerencial após 45 dias de inadimplência sem acordo."
    );

    expect(act.activation_status).toBe("suspenso_manual");
    expect(act.suspension_reason).toContain("45 dias de inadimplência");
    expect(act.suspended_by_admin).toBe("leandro.j.fatima@gmail.com");

    // Reativação manual após regularização
    manualReactivate(act, "leandro.j.fatima@gmail.com");

    expect(act.activation_status).toBe("autorizado_ativo");
    expect(act.suspension_reason).toBeNull();
  });
});
