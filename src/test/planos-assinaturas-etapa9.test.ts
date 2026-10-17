import { describe, it, expect } from "vitest";
import { validateSubscriptionForBooking, MODEL_LABELS } from "@/lib/subscription-engine";
import type { ClientSubscription, SalonClientPlan } from "@/types/subscription";

describe("Etapa 9 — Planos e Assinaturas dos Clientes Finais", () => {
  const mockPlanOne: SalonClientPlan = {
    id: "plan-one-1",
    name: "Belezi One",
    model: "one",
    price: 59.9,
    billing_cycle: "mensal",
    monthly_credit_limit: 1, // Exatamente 1 corte por mês
    service_ids: [],
    benefits: ["1 corte mensal incluso", "Finalização premium"],
    active: true,
  };

  const mockPlanRecorrente: SalonClientPlan = {
    id: "plan-recorrente-4x",
    name: "Clube Recorrente 4x",
    model: "recorrente",
    price: 139.9,
    billing_cycle: "mensal",
    monthly_credit_limit: 4, // 4 atendimentos no mês
    service_ids: [],
    benefits: ["Até 4 cortes ou barbas no mês", "10% off em produtos"],
    active: true,
  };

  const mockPlanIlimitado: SalonClientPlan = {
    id: "plan-ilimitado",
    name: "Clube Ilimitado Total",
    model: "ilimitado",
    price: 199.9,
    billing_cycle: "mensal",
    monthly_credit_limit: 9999,
    service_ids: [],
    benefits: ["Cortes e barbas ilimitados"],
    active: true,
  };

  const mockPlanVip: SalonClientPlan = {
    id: "plan-vip-black",
    name: "VIP Black Executive",
    model: "vip",
    price: 249.9,
    billing_cycle: "mensal",
    monthly_credit_limit: 9999,
    service_ids: [],
    benefits: ["Atendimento ilimitado", "Encaixe simultâneo VIP", "Chopp cortesia"],
    active: true,
  };

  it("garante a regra estrita do Plano One: exatamente 1 corte por mês", () => {
    // 1. Assinatura One com 0 cortes usados no ciclo: Atendimento coberto
    const subOneFresh: ClientSubscription = {
      id: "sub-1",
      client_id: "client-carlos",
      plan_id: mockPlanOne.id,
      plan: mockPlanOne,
      status: "ativa",
      starts_at: new Date().toISOString(),
      renews_at: new Date(Date.now() + 20 * 86400000).toISOString(),
      credits_used_this_period: 0,
    };

    const check1 = validateSubscriptionForBooking({ subscription: subOneFresh });
    expect(check1.isCovered).toBe(true);
    expect(check1.creditsRemaining).toBe(1);
    expect(check1.requiresExtraPayment).toBe(false);

    // 2. Assinatura One com 1 corte já utilizado: Limite atingido, cobra avulso
    const subOneUsed: ClientSubscription = {
      ...subOneFresh,
      credits_used_this_period: 1,
    };

    const check2 = validateSubscriptionForBooking({ subscription: subOneUsed });
    expect(check2.isCovered).toBe(false);
    expect(check2.creditsRemaining).toBe(0);
    expect(check2.requiresExtraPayment).toBe(true);
    expect(check2.reasonMessage).toContain("Limite do Plano One atingido: 1 de 1 corte já utilizado");
  });

  it("controla a franquia de créditos do modelo Recorrente (ex: 4 atendimentos)", () => {
    const subRecorrente: ClientSubscription = {
      id: "sub-rec",
      client_id: "client-marcos",
      plan_id: mockPlanRecorrente.id,
      plan: mockPlanRecorrente,
      status: "ativa",
      starts_at: new Date().toISOString(),
      renews_at: new Date(Date.now() + 15 * 86400000).toISOString(),
      credits_used_this_period: 2, // Usou 2 de 4
    };

    const check = validateSubscriptionForBooking({ subscription: subRecorrente });
    expect(check.isCovered).toBe(true);
    expect(check.creditsRemaining).toBe(2); // 4 - 2 = 2 restantes

    // Estourou a cota de 4
    const subRecorrenteFull: ClientSubscription = {
      ...subRecorrente,
      credits_used_this_period: 4,
    };
    const checkFull = validateSubscriptionForBooking({ subscription: subRecorrenteFull });
    expect(checkFull.isCovered).toBe(false);
    expect(checkFull.creditsRemaining).toBe(0);
    expect(checkFull.requiresExtraPayment).toBe(true);
  });

  it("assegura que planos Ilimitados e VIP não possuem trava numérica de cortes", () => {
    const subIlimitado: ClientSubscription = {
      id: "sub-ilim",
      client_id: "client-felipe",
      plan_id: mockPlanIlimitado.id,
      plan: mockPlanIlimitado,
      status: "ativa",
      starts_at: new Date().toISOString(),
      renews_at: new Date(Date.now() + 10 * 86400000).toISOString(),
      credits_used_this_period: 8, // Já fez 8 cortes no mês
    };

    const checkIlim = validateSubscriptionForBooking({ subscription: subIlimitado });
    expect(checkIlim.isCovered).toBe(true);
    expect(checkIlim.creditsRemaining).toBe("ilimitado");

    const subVip: ClientSubscription = {
      id: "sub-vip",
      client_id: "client-ricardo",
      plan_id: mockPlanVip.id,
      plan: mockPlanVip,
      status: "ativa",
      starts_at: new Date().toISOString(),
      renews_at: new Date(Date.now() + 10 * 86400000).toISOString(),
      credits_used_this_period: 12,
    };

    const checkVip = validateSubscriptionForBooking({ subscription: subVip, isVipRequested: true });
    expect(checkVip.isCovered).toBe(true);
    expect(checkVip.isVipOverrideAllowed).toBe(true); // Autoriza encaixe simultâneo VIP
  });

  it("rejeita cobertura para assinaturas expiradas ou inadimplentes", () => {
    // 1. Assinatura inadimplente
    const subInadimplente: ClientSubscription = {
      id: "sub-inad",
      client_id: "client-pedro",
      plan_id: mockPlanOne.id,
      plan: mockPlanOne,
      status: "inadimplente",
      starts_at: new Date().toISOString(),
      renews_at: new Date(Date.now() + 10 * 86400000).toISOString(),
      credits_used_this_period: 0,
    };

    const checkInad = validateSubscriptionForBooking({ subscription: subInadimplente });
    expect(checkInad.isCovered).toBe(false);
    expect(checkInad.reasonMessage).toContain("inadimplente");

    // 2. Assinatura com renovação vencida
    const subVencida: ClientSubscription = {
      id: "sub-venc",
      client_id: "client-andre",
      plan_id: mockPlanOne.id,
      plan: mockPlanOne,
      status: "ativa",
      starts_at: new Date(Date.now() - 40 * 86400000).toISOString(),
      renews_at: new Date(Date.now() - 5 * 86400000).toISOString(), // Venceu há 5 dias
      credits_used_this_period: 0,
    };

    const checkVenc = validateSubscriptionForBooking({ subscription: subVencida });
    expect(checkVenc.isCovered).toBe(false);
    expect(checkVenc.reasonMessage).toContain("expirou");
  });

  it("confirma que os 5 modelos de assinatura possuem rótulos e identidades definidas", () => {
    expect(MODEL_LABELS.one.label).toContain("Plano One");
    expect(MODEL_LABELS.recorrente.label).toBe("Recorrente");
    expect(MODEL_LABELS.ilimitado.label).toBe("Ilimitado");
    expect(MODEL_LABELS.vip.label).toBe("Clube VIP");
    expect(MODEL_LABELS.avulso.label).toBe("Pacote Avulso");
  });
});
