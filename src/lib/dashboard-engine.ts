export type DashboardRange = { start: string; end: string };

type Row = Partial<
  Record<
    | "id"
    | "name"
    | "status"
    | "starts_at"
    | "appointment_date"
    | "scheduled_at"
    | "ends_at"
    | "renews_at"
    | "active"
    | "client_id"
    | "clientId"
    | "created_at"
    | "professional_id"
    | "professionalId"
    | "service_id"
    | "serviceId"
    | "product_id"
    | "productId"
    | "is_blocked"
    | "schedule_details"
    | "start"
    | "end"
    | "type"
    | "date"
    | "transaction_date"
    | "amount"
    | "net_amount"
    | "total_amount"
    | "source"
    | "closed_at"
    | "completed_at"
    | "total"
    | "order_total"
    | "order_id"
    | "orderId"
    | "qty"
    | "quantity"
    | "unit_price"
    | "commission_pct"
    | "commission"
    | "kind"
    | "description"
    | "plan"
    | "price"
    | "billing_cycle",
    any
  >
>;

export function calculateSubscriptionMrr(subscriptions: Row[] = [], asOf: string): number {
  const cycleMonths: Record<string, number> = {
    mensal: 1,
    trimestral: 3,
    semestral: 6,
    anual: 12,
  };
  const list = Array.isArray(subscriptions) ? subscriptions : [];
  return list.reduce((total, subscription) => {
    if (!subscription) return total;
    const startsAt = subscription.starts_at || subscription.start_date || "";
    const renewsAt = subscription.renews_at || subscription.renew_date || "";
    if (
      subscription.status !== "ativa" ||
      (typeof startsAt === "string" && startsAt.slice(0, 10) > asOf) ||
      (typeof renewsAt === "string" && renewsAt.slice(0, 10) <= asOf)
    ) {
      return total;
    }
    const plan = Array.isArray(subscription.plan) ? subscription.plan[0] : subscription.plan;
    if (!plan) return total;
    const cycle = cycleMonths[String(plan.billing_cycle ?? "mensal")] ?? 1;
    return total + Number(plan.price ?? 0) / cycle;
  }, 0);
}

const completed = (appointment: Row) => {
  if (!appointment) return false;
  const status = String(appointment.status ?? "").toLowerCase();
  const isDone =
    status === "concluido" ||
    status === "realizado" ||
    status === "finalizado" ||
    status === "pago";
  const hasClient = Boolean(
    appointment.client_id || appointment.clientId || appointment.customer_id,
  );
  return isDone && hasClient;
};

export function dashboardDateKey(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  }
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

function addDays(value: string, amount: number): string {
  try {
    const base = value || new Date().toISOString().slice(0, 10);
    const date = new Date(`${base}T12:00:00`);
    if (!Number.isFinite(date.getTime())) return base;
    date.setDate(date.getDate() + amount);
    return dashboardDateKey(date);
  } catch {
    return value || "";
  }
}

function scheduleMinutes(start?: string | null, end?: string | null): number {
  if (!start || !end || typeof start !== "string" || typeof end !== "string") return 0;
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return 0;
  return Math.max(
    0,
    (endHour ?? 0) * 60 +
      (endMinute ?? 0) -
      ((startHour ?? 0) * 60 + (startMinute ?? 0)),
  );
}

const weekdayNames = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function businessMinutes(professionals: Row[] = [], range: DashboardRange): number {
  let total = 0;
  const proList = Array.isArray(professionals) ? professionals : [];
  for (let date = range.start; date <= range.end; date = addDays(date, 1)) {
    const dateObj = new Date(`${date}T12:00:00`);
    if (!Number.isFinite(dateObj.getTime())) continue;
    const weekday = weekdayNames[dateObj.getDay()] ?? "sunday";
    for (const professional of proList) {
      if (!professional || professional.active === false) continue;
      const day = professional.schedule_details?.[weekday];
      if (day?.active && day.start && day.end) {
        total += scheduleMinutes(day.start, day.end);
      }
    }
  }
  return total;
}

function occupiedMinutes(
  appointments: Row[] = [],
  professionals: Row[] = [],
  range: DashboardRange,
): number {
  const proList = Array.isArray(professionals) ? professionals : [];
  const appList = Array.isArray(appointments) ? appointments : [];
  const professionalMap = new Map(proList.filter(Boolean).map((p) => [p.id, p]));
  const grouped = new Map<string, Array<[number, number]>>();

  for (const appointment of appList) {
    if (!appointment) continue;
    const rawStart =
      appointment.starts_at ||
      appointment.appointment_date ||
      appointment.scheduled_at ||
      appointment.date ||
      appointment.start_time;
    if (!rawStart) continue;

    const status = String(appointment.status ?? "").toLowerCase();
    if (status === "cancelado" || status === "bloqueado" || appointment.is_blocked) {
      continue;
    }
    const appDate = dashboardDateKey(rawStart);
    if (!appDate || appDate < range.start || appDate > range.end) continue;

    const start = new Date(rawStart).getTime();
    const rawEnd = appointment.ends_at || appointment.end_time || appointment.ends;
    const end = rawEnd ? new Date(rawEnd).getTime() : start + 30 * 60_000;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;

    const dateObj = new Date(`${appDate}T12:00:00`);
    if (!Number.isFinite(dateObj.getTime())) continue;
    const weekday = weekdayNames[dateObj.getDay()] ?? "sunday";

    const proId = appointment.professional_id || appointment.professionalId;
    const professional = professionalMap.get(proId);
    const day = professional?.schedule_details?.[weekday];
    if (professional?.active === false || !day?.active || !day?.start || !day?.end) continue;

    const scheduleStart = new Date(`${appDate}T${day.start}:00`).getTime();
    const scheduleEnd = new Date(`${appDate}T${day.end}:00`).getTime();
    if (!Number.isFinite(scheduleStart) || !Number.isFinite(scheduleEnd)) continue;

    const clippedStart = Math.max(start, scheduleStart);
    const clippedEnd = Math.min(end, scheduleEnd);
    if (clippedEnd <= clippedStart) continue;

    const key = `${proId ?? "unknown"}:${appDate}`;
    grouped.set(key, [...(grouped.get(key) ?? []), [clippedStart, clippedEnd]]);
  }

  let minutes = 0;
  for (const intervals of grouped.values()) {
    if (!intervals.length) continue;
    intervals.sort((a, b) => a[0] - b[0]);
    let [start, end] = intervals[0] ?? [0, 0];
    for (const next of intervals.slice(1)) {
      if (next[0] <= end) end = Math.max(end, next[1]);
      else {
        minutes += (end - start) / 60_000;
        [start, end] = next;
      }
    }
    minutes += (end - start) / 60_000;
  }
  return minutes;
}

export function calculateDashboardAnalytics(input: {
  range: DashboardRange;
  transactions?: Row[];
  subscriptions?: Row[];
  orders?: Row[];
  orderItems?: Row[];
  appointments?: Row[];
  clients?: Row[];
  professionals?: Row[];
  services?: Row[];
  products?: Row[];
}) {
  const defaultResult = {
    revenue: 0,
    averageTicket: 0,
    closedOrders: 0,
    recurringRevenue: 0,
    subscriptionMrr: 0,
    oneOffRevenue: 0,
    netRevenue: 0,
    expenses: 0,
    operatingResult: 0,
    occupationRate: 0,
    occupiedMinutes: 0,
    availableMinutes: 0,
    newClients: 0,
    returningClients: 0,
    inactiveClients: 0,
    churnRate: 0,
    retentionRate: 0,
    retainedClients: 0,
    churnedClients: 0,
    activeClients: 0,
    clientCount: 0,
    completedAppointments: 0,
    projectedRevenue: 0,
    profitMargin: 0,
    cashFlow: [] as Array<{
      date: string;
      revenue: number;
      expenses: number;
      balance: number;
      cumulative: number;
    }>,
    proOccupancy: [] as Array<{
      id: string;
      name: string;
      occupationRate: number;
      occupiedMinutes: number;
      availableMinutes: number;
      cuts: number;
      revenue: number;
      commissions: number;
    }>,
    hourlyDistribution: [] as Array<{
      slot: string;
      count: number;
      percentage: number;
      isPeak: boolean;
      isLow: boolean;
    }>,
    absentClients: [] as Array<{
      id: string;
      name: string;
      phone: string;
      lastVisit: string | null;
      daysAbsent: number;
      whatsappUrl: string;
    }>,
    idleSlotPromotions: [] as Array<{
      id: string;
      title: string;
      targetSlot: string;
      suggestedDiscount: string;
      description: string;
      suggestedCopy: string;
    }>,
    dailyRevenue: [] as Array<{ date: string; revenue: number }>,
    professionals: [] as Array<{ id: string; name: string; revenue: number; commissions: number; cuts: number }>,
    bestServices: [] as Array<{ id: string; name: string; quantity: number; revenue: number }>,
    bestProducts: [] as Array<{ id: string; name: string; quantity: number; revenue: number }>,
  };

  try {
    const range = input?.range ?? { start: todayISO(), end: todayISO() };
    const transactions = Array.isArray(input?.transactions) ? input.transactions : [];
    const subscriptions = Array.isArray(input?.subscriptions) ? input.subscriptions : [];
    const orders = Array.isArray(input?.orders) ? input.orders : [];
    const orderItems = Array.isArray(input?.orderItems) ? input.orderItems : [];
    const appointments = Array.isArray(input?.appointments) ? input.appointments : [];
    const clients = Array.isArray(input?.clients) ? input.clients : [];
    const professionals = Array.isArray(input?.professionals) ? input.professionals : [];
    const services = Array.isArray(input?.services) ? input.services : [];
    const products = Array.isArray(input?.products) ? input.products : [];

    const actualRevenue = transactions.filter((row) => {
      if (!row) return false;
      const rawDate = row.date || row.transaction_date || row.created_at;
      const rowDate = dashboardDateKey(rawDate);
      const rowType = String(row.type ?? "receita").toLowerCase();
      const rowStatus = String(row.status ?? "realizado").toLowerCase();
      return (
        rowType === "receita" &&
        rowStatus !== "previsto" &&
        rowStatus !== "cancelado" &&
        rowDate >= range.start &&
        rowDate <= range.end
      );
    });

    const revenue = actualRevenue.reduce(
      (sum, row) => sum + Number(row?.amount ?? row?.total_amount ?? row?.total ?? row?.value ?? 0),
      0,
    );
    const netRevenue = actualRevenue.reduce(
      (sum, row) =>
        sum +
        Number(
          row?.net_amount ?? row?.amount ?? row?.total_amount ?? row?.total ?? row?.value ?? 0,
        ),
      0,
    );
    const recurringRevenue = actualRevenue
      .filter((row) => row?.source === "assinatura")
      .reduce(
        (sum, row) =>
          sum + Number(row?.amount ?? row?.total_amount ?? row?.total ?? row?.value ?? 0),
        0,
      );
    const subscriptionMrr = calculateSubscriptionMrr(subscriptions, range.end);
    const oneOffRevenue = actualRevenue
      .filter((row) => row?.source !== "assinatura")
      .reduce(
        (sum, row) =>
          sum + Number(row?.amount ?? row?.total_amount ?? row?.total ?? row?.value ?? 0),
        0,
      );

    const expenses = transactions
      .filter((row) => {
        if (!row) return false;
        const rawDate = row.date || row.transaction_date || row.created_at;
        const rowDate = dashboardDateKey(rawDate);
        const rowType = String(row.type ?? "receita").toLowerCase();
        const rowStatus = String(row.status ?? "realizado").toLowerCase();
        return (
          rowType === "despesa" &&
          rowStatus !== "previsto" &&
          rowStatus !== "cancelado" &&
          rowDate >= range.start &&
          rowDate <= range.end
        );
      })
      .reduce(
        (sum, row) =>
          sum + Number(row?.amount ?? row?.total_amount ?? row?.total ?? row?.value ?? 0),
        0,
      );

    const ordersInRange = orders.filter((order) => {
      if (!order) return false;
      const status = String(order.status ?? "fechada").toLowerCase();
      if (
        status !== "fechada" &&
        status !== "paga" &&
        status !== "concluida" &&
        status !== "finalizada"
      ) {
        return false;
      }
      const rawClosed =
        order.closed_at || order.completed_at || order.order_date || order.date || order.created_at;
      const closedDate = dashboardDateKey(rawClosed);
      return closedDate >= range.start && closedDate <= range.end;
    });

    const completedAppointments = appointments.filter((appointment) => {
      if (!appointment || !completed(appointment)) return false;
      const rawStart =
        appointment.starts_at ||
        appointment.appointment_date ||
        appointment.scheduled_at ||
        appointment.date;
      if (!rawStart) return false;
      const appDate = dashboardDateKey(rawStart);
      return appDate >= range.start && appDate <= range.end;
    });

    const visitsByClient = new Map<string, string[]>();
    for (const appointment of appointments) {
      if (!appointment || !completed(appointment)) continue;
      const rawStart =
        appointment.starts_at ||
        appointment.appointment_date ||
        appointment.scheduled_at ||
        appointment.date;
      if (!rawStart) continue;
      const appDate = dashboardDateKey(rawStart);
      if (!appDate || appDate > range.end) continue;
      const clientId = String(appointment.client_id || appointment.clientId || "");
      if (!clientId) continue;
      visitsByClient.set(clientId, [...(visitsByClient.get(clientId) ?? []), appDate]);
    }

    const currentClients = new Set(
      completedAppointments
        .map((appointment) => String(appointment.client_id || appointment.clientId || ""))
        .filter(Boolean),
    );
    const previousDays = Math.max(
      1,
      Math.round(
        (new Date(`${range.end}T12:00:00`).getTime() -
          new Date(`${range.start}T12:00:00`).getTime()) /
          86_400_000,
      ) + 1,
    );
    const previousStart = addDays(range.start, -previousDays);
    const previouslyActive = new Set<string>();
    const firstVisitClients = new Set<string>();
    const returningClients = new Set<string>();

    for (const [clientId, visits] of visitsByClient) {
      const first = visits.reduce((min, date) => (date < min ? date : min), visits[0] ?? "");
      if (first >= range.start && first <= range.end) firstVisitClients.add(clientId);
      if (currentClients.has(clientId) && visits.some((date) => date < range.start)) {
        returningClients.add(clientId);
      }
      if (visits.some((date) => date >= previousStart && date < range.start)) {
        previouslyActive.add(clientId);
      }
    }

    const churnedClients = [...previouslyActive].filter((id) => !currentClients.has(id)).length;
    const retainedClients = [...previouslyActive].filter((id) => currentClients.has(id)).length;
    const newClientIds = new Set(firstVisitClients);
    const inactiveClientIds = new Set<string>();

    for (const client of clients) {
      if (!client?.id) continue;
      const created = client.created_at ? dashboardDateKey(client.created_at) : undefined;
      if (created && created >= range.start && created <= range.end) newClientIds.add(client.id);
      if (!currentClients.has(client.id) && (!created || created < range.start)) {
        inactiveClientIds.add(client.id);
      }
    }
    for (const clientId of visitsByClient.keys()) {
      if (!currentClients.has(clientId)) inactiveClientIds.add(clientId);
    }

    const availableMinutes = businessMinutes(professionals, range);
    const occupied = occupiedMinutes(appointments, professionals, range);

    const orderMap = new Map(ordersInRange.map((order) => [order.id, order]));
    const professionalsById = new Map(professionals.filter(Boolean).map((p) => [p.id, p]));
    const servicesById = new Map(services.filter(Boolean).map((s) => [s.id, s]));
    const productsById = new Map(products.filter(Boolean).map((p) => [p.id, p]));
    const professionalStats = new Map<string, { revenue: number; commissions: number; cuts: number }>();
    const serviceStats = new Map<string, { quantity: number; revenue: number }>();
    const productStats = new Map<string, { quantity: number; revenue: number }>();
    const dailyRevenue = new Map<string, number>();

    for (const transaction of actualRevenue) {
      const rawDate = transaction.date || transaction.transaction_date || transaction.created_at;
      const date = dashboardDateKey(rawDate) || range.start;
      const val = Number(
        transaction?.amount ?? transaction?.total_amount ?? transaction?.total ?? 0,
      );
      dailyRevenue.set(date, (dailyRevenue.get(date) ?? 0) + val);
    }
    for (const appointment of completedAppointments) {
      const rawStart =
        appointment.starts_at ||
        appointment.appointment_date ||
        appointment.scheduled_at ||
        appointment.date;
      const day = dashboardDateKey(rawStart);
      if (day) dailyRevenue.set(day, dailyRevenue.get(day) ?? 0);
    }

    for (const item of orderItems) {
      if (!item) continue;
      const order = orderMap.get(item.order_id || item.orderId);
      if (!order) continue;
      const quantity = Number(item.qty ?? item.quantity ?? 1);
      const unitPrice = Number(item.unit_price ?? item.price ?? item.unitPrice ?? 0);
      const commissionPct = Number(item.commission_pct ?? item.commission ?? item.commissionPct ?? 0);
      const amount = quantity * unitPrice;
      const commission = (amount * commissionPct) / 100;

      const proId = item.professional_id || item.professionalId;
      if (proId) {
        const stats = professionalStats.get(proId) ?? {
          revenue: 0,
          commissions: 0,
          cuts: 0,
        };
        stats.revenue += amount;
        stats.commissions += commission;
        if (item.kind === "servico") stats.cuts += quantity;
        professionalStats.set(proId, stats);
      }
      if (item.kind === "servico") {
        const key = item.service_id || item.serviceId || item.description || "servico";
        const stats = serviceStats.get(key) ?? { quantity: 0, revenue: 0 };
        stats.quantity += quantity;
        stats.revenue += amount;
        serviceStats.set(key, stats);
      } else if (item.kind === "produto") {
        const key = item.product_id || item.productId || item.description || "produto";
        const stats = productStats.get(key) ?? { quantity: 0, revenue: 0 };
        stats.quantity += quantity;
        stats.revenue += amount;
        productStats.set(key, stats);
      }
    }

    const ranking = <T extends { quantity?: number; revenue: number }>(
      stats: Map<string, T>,
      catalog: Map<string, Row>,
    ) =>
      [...stats.entries()]
        .map(([id, values]) => ({ id, name: catalog.get(id)?.name ?? id, ...values }))
        .sort((a, b) => b.revenue - a.revenue);

    const dailyExpenses = new Map<string, number>();
    for (const transaction of transactions) {
      if (!transaction) continue;
      const rawType = String(transaction.type ?? "receita").toLowerCase();
      const rawStatus = String(transaction.status ?? "realizado").toLowerCase();
      if (rawType !== "despesa" || rawStatus === "cancelado" || rawStatus === "previsto") continue;
      const rawDate = transaction.date || transaction.transaction_date || transaction.created_at;
      const date = dashboardDateKey(rawDate);
      if (!date || date < range.start || date > range.end) continue;
      const val = Number(
        transaction?.amount ?? transaction?.total_amount ?? transaction?.total ?? 0,
      );
      dailyExpenses.set(date, (dailyExpenses.get(date) ?? 0) + val);
    }

    const daily: Array<{ date: string; revenue: number }> = [];
    const dailyCashFlow: Array<{
      date: string;
      revenue: number;
      expenses: number;
      balance: number;
      cumulative: number;
    }> = [];
    let cumulativeBalance = 0;

    for (let date = range.start; date <= range.end; date = addDays(date, 1)) {
      const dayRev = dailyRevenue.get(date) ?? 0;
      const dayExp = dailyExpenses.get(date) ?? 0;
      const dayBal = dayRev - dayExp;
      cumulativeBalance += dayBal;
      daily.push({ date, revenue: dayRev });
      dailyCashFlow.push({
        date,
        revenue: dayRev,
        expenses: dayExp,
        balance: dayBal,
        cumulative: cumulativeBalance,
      });
    }

    const chart =
      daily.length > 90
        ? [...new Set(daily.map(({ date }) => date.slice(0, 7)))].map((month) => ({
            date: month,
            revenue: daily
              .filter((day) => day.date.startsWith(month))
              .reduce((sum, day) => sum + day.revenue, 0),
          }))
        : daily;

    const cashFlow =
      dailyCashFlow.length > 90
        ? [...new Set(dailyCashFlow.map(({ date }) => date.slice(0, 7)))].map((month) => {
            const monthDays = dailyCashFlow.filter((d) => d.date.startsWith(month));
            const mRev = monthDays.reduce((s, d) => s + d.revenue, 0);
            const mExp = monthDays.reduce((s, d) => s + d.expenses, 0);
            return {
              date: month,
              revenue: mRev,
              expenses: mExp,
              balance: mRev - mExp,
              cumulative: monthDays[monthDays.length - 1]?.cumulative ?? 0,
            };
          })
        : dailyCashFlow;

    const avgTicket = ordersInRange.length
      ? ordersInRange.reduce(
          (sum, order) =>
            sum +
            Number(
              order.total ?? order.total_amount ?? order.amount ?? order.price ?? order.value ?? 0,
            ),
          0,
        ) / ordersInRange.length
      : 0;

    // Faturamento Previsto (Receita realizada + receitas previstas em transações + agendamentos abertos no período)
    const pendingTransactionsRev = transactions
      .filter((row) => {
        if (!row) return false;
        const rawDate = row.date || row.transaction_date || row.created_at;
        const rowDate = dashboardDateKey(rawDate);
        const rowType = String(row.type ?? "receita").toLowerCase();
        const rowStatus = String(row.status ?? "").toLowerCase();
        return (
          rowType === "receita" &&
          (rowStatus === "previsto" || rowStatus === "pendente") &&
          rowDate >= range.start &&
          rowDate <= range.end
        );
      })
      .reduce((sum, r) => sum + Number(r?.amount ?? r?.total_amount ?? r?.total ?? 0), 0);

    const openAppointmentsInPeriod = appointments.filter((a) => {
      if (!a) return false;
      const st = String(a.status ?? "").toLowerCase();
      if (st === "cancelado" || st === "concluido" || st === "pago" || st === "finalizado" || a.is_blocked) {
        return false;
      }
      const rawStart = a.starts_at || a.appointment_date || a.scheduled_at || a.date;
      const date = dashboardDateKey(rawStart);
      return date >= range.start && date <= range.end;
    });

    const openAppointmentsRev = openAppointmentsInPeriod.reduce((sum, a) => {
      const svc = servicesById.get(a.service_id || a.serviceId);
      const price = Number(svc?.price ?? (avgTicket > 0 ? avgTicket : 45));
      return sum + (Number.isFinite(price) ? price : 45);
    }, 0);

    const projectedRevenue = Math.max(revenue, revenue + pendingTransactionsRev + openAppointmentsRev);
    const profitMargin = revenue > 0
      ? Number((((netRevenue - expenses) / revenue) * 100).toFixed(1))
      : 0;

    // Ocupação por profissional
    const proOccupancy = professionals.filter(Boolean).map((pro) => {
      const proId = pro.id;
      const stats = professionalStats.get(proId) ?? { revenue: 0, commissions: 0, cuts: 0 };
      const singleProList = [pro];
      const proAvailable = businessMinutes(singleProList, range);
      const proAppts = appointments.filter(
        (a) => (a.professional_id === proId || a.professionalId === proId) && a.status !== "cancelado"
      );
      const proOccupied = occupiedMinutes(proAppts, singleProList, range);
      const rate = proAvailable > 0 ? Math.min(100, (proOccupied / proAvailable) * 100) : 0;
      return {
        id: proId,
        name: pro.name || "Profissional",
        occupationRate: Number(rate.toFixed(1)),
        occupiedMinutes: proOccupied,
        availableMinutes: proAvailable,
        cuts: stats.cuts,
        revenue: stats.revenue,
        commissions: stats.commissions,
      };
    }).sort((a, b) => b.occupationRate - a.occupationRate);

    // Identificação dos horários de pico (Slots de Horário)
    const slotDefinitions = [
      { key: "08h - 10h", startH: 8, endH: 10 },
      { key: "10h - 12h", startH: 10, endH: 12 },
      { key: "12h - 14h", startH: 12, endH: 14 },
      { key: "14h - 16h", startH: 14, endH: 16 },
      { key: "16h - 18h", startH: 16, endH: 18 },
      { key: "18h - 20h", startH: 18, endH: 20 },
      { key: "20h+", startH: 20, endH: 24 },
    ];
    const slotCounts = new Map<string, number>();
    slotDefinitions.forEach((s) => slotCounts.set(s.key, 0));

    let totalSlotAppts = 0;
    for (const a of appointments) {
      if (!a || a.status === "cancelado" || a.is_blocked) continue;
      const rawStart = a.starts_at || a.appointment_date || a.scheduled_at || a.date;
      const appDate = dashboardDateKey(rawStart);
      if (!appDate || appDate < range.start || appDate > range.end) continue;

      let hour = 10;
      if (typeof rawStart === "string" && rawStart.includes("T")) {
        hour = parseInt(rawStart.split("T")[1].slice(0, 2), 10) || 10;
      } else if (typeof rawStart === "string" && rawStart.includes(" ")) {
        hour = parseInt(rawStart.split(" ")[1].slice(0, 2), 10) || 10;
      }

      const foundSlot =
        slotDefinitions.find((s) => hour >= s.startH && hour < s.endH) ||
        slotDefinitions[slotDefinitions.length - 1];
      slotCounts.set(foundSlot.key, (slotCounts.get(foundSlot.key) ?? 0) + 1);
      totalSlotAppts++;
    }

    const countsList = Array.from(slotCounts.values());
    const maxSlotCount = Math.max(...countsList, 0);
    const nonZeroCounts = countsList.filter((c) => c > 0);
    const minSlotCount = nonZeroCounts.length > 0 ? Math.min(...nonZeroCounts) : 0;

    const hourlyDistribution = slotDefinitions.map((s) => {
      const count = slotCounts.get(s.key) ?? 0;
      const percentage =
        totalSlotAppts > 0 ? Number(((count / totalSlotAppts) * 100).toFixed(1)) : 0;
      return {
        slot: s.key,
        count,
        percentage,
        isPeak: count > 0 && count === maxSlotCount,
        isLow: count > 0 && count === minSlotCount && maxSlotCount > minSlotCount,
      };
    });

    // Módulo PUMP & Retenção de Clientes (ausentes há mais de 30 dias com link WhatsApp)
    const absentClients: Array<{
      id: string;
      name: string;
      phone: string;
      lastVisit: string | null;
      daysAbsent: number;
      whatsappUrl: string;
    }> = [];

    const nowTimestamp = new Date(`${range.end}T12:00:00`).getTime();

    for (const client of clients) {
      if (!client?.id) continue;
      const clientVisits = visitsByClient.get(client.id) ?? [];
      let lastVisit: string | null = null;
      if (clientVisits.length > 0) {
        lastVisit = clientVisits.reduce((latest, d) => (d > latest ? d : latest), clientVisits[0]);
      }

      let daysAbsent = 0;
      if (lastVisit) {
        const visitTs = new Date(`${lastVisit}T12:00:00`).getTime();
        daysAbsent = Math.max(0, Math.floor((nowTimestamp - visitTs) / (1000 * 60 * 60 * 24)));
      } else if (client.created_at) {
        const createdDate = dashboardDateKey(client.created_at);
        if (createdDate) {
          const createTs = new Date(`${createdDate}T12:00:00`).getTime();
          daysAbsent = Math.max(0, Math.floor((nowTimestamp - createTs) / (1000 * 60 * 60 * 24)));
        }
      }

      if (daysAbsent >= 30) {
        const rawPhone = String(client.phone || "").replace(/\D/g, "");
        const firstName = String(client.name || "Cliente").split(" ")[0];
        const msg = `Olá, ${firstName}! Sentimos sua falta aqui na barbearia Belezi. Que tal garantir um horário esta semana para renovar seu visual? Responda a esta mensagem para agendarmos!`;
        const phoneWithCountry =
          rawPhone.length === 10 || rawPhone.length === 11 ? `55${rawPhone}` : rawPhone;
        const whatsappUrl = rawPhone
          ? `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`
          : "";

        absentClients.push({
          id: client.id,
          name: client.name || "Cliente",
          phone: client.phone || "",
          lastVisit,
          daysAbsent,
          whatsappUrl,
        });
      }
    }

    absentClients.sort((a, b) => b.daysAbsent - a.daysAbsent);

    // Recomendações estratégicas automáticas de promoções para dias/horários ociosos
    const idleSlotPromotions = [
      {
        id: "promo-meio-semana",
        title: "Terça & Quarta Turbo",
        targetSlot: "Terças e Quartas (09h às 14h)",
        suggestedDiscount: "15% OFF",
        description: "Incentive agendamentos nos dias de menor procura da semana com desconto em serviços combinados (Corte + Barba).",
        suggestedCopy: "🔥 Terça e Quarta Turbo na Belezi! Garanta 15% de desconto no combo Cabelo + Barba das 09h às 14h. Vagas limitadas!",
      },
      {
        id: "promo-manha",
        title: "Happy Hour Matinal",
        targetSlot: "Segunda a Sexta (08h às 11h)",
        suggestedDiscount: "10% OFF + Café Espresso",
        description: "Preencha a grade matinal oferecendo benefício exclusivo para clientes que cuidam do visual no primeiro horário.",
        suggestedCopy: "☕ Comece o dia no estilo! Atendimentos entre 08h e 11h com 10% OFF e café espresso cortesia.",
      },
      {
        id: "promo-fidelidade-reativacao",
        title: "Campanha Volte Sempre (PUMP)",
        targetSlot: "Clientes ausentes (+30 dias)",
        suggestedDiscount: "R$ 15 OFF no retorno",
        description: "Disparo automático ou manual de reativação para clientes em risco de churn com cupom exclusivo de retorno.",
        suggestedCopy: "✂️ Sentimos sua falta! Volte esta semana e ganhe R$ 15 de desconto em qualquer serviço. Responda para reservar seu horário!",
      },
    ];

    return {
      revenue,
      averageTicket: Number.isFinite(avgTicket) ? avgTicket : 0,
      closedOrders: ordersInRange.length,
      recurringRevenue,
      subscriptionMrr,
      oneOffRevenue,
      netRevenue,
      expenses,
      operatingResult: netRevenue - expenses,
      projectedRevenue,
      profitMargin,
      cashFlow,
      proOccupancy,
      hourlyDistribution,
      absentClients,
      idleSlotPromotions,
      occupationRate: availableMinutes ? Math.min(100, (occupied / availableMinutes) * 100) : 0,
      occupiedMinutes: occupied,
      availableMinutes,
      newClients: newClientIds.size,
      returningClients: returningClients.size,
      inactiveClients: inactiveClientIds.size,
      churnRate: previouslyActive.size ? (churnedClients / previouslyActive.size) * 100 : 0,
      retentionRate: previouslyActive.size ? (retainedClients / previouslyActive.size) * 100 : 0,
      retainedClients,
      churnedClients,
      activeClients: currentClients.size,
      clientCount: clients.length,
      completedAppointments: completedAppointments.length,
      dailyRevenue: chart,
      professionals: ranking(professionalStats, professionalsById),
      bestServices: ranking(serviceStats, servicesById) as Array<{
        id: string;
        name: string;
        quantity: number;
        revenue: number;
      }>,
      bestProducts: ranking(productStats, productsById) as Array<{
        id: string;
        name: string;
        quantity: number;
        revenue: number;
      }>,
    };
  } catch (err) {
    console.warn("[dashboard-engine] Analytics calculation error:", err);
    return defaultResult;
  }
}

export function dashboardCsvRows(analytics: ReturnType<typeof calculateDashboardAnalytics>) {
  if (!analytics) return [["Sem dados para o período"]];
  return [
    ["Relatório Executivo Belezi"],
    ["Faturamento", analytics.revenue ?? 0],
    ["Faturamento Realizado", analytics.revenue ?? 0],
    ["Faturamento Previsto", analytics.projectedRevenue ?? (analytics.revenue ?? 0)],
    ["Despesas Operacionais", analytics.expenses ?? 0],
    ["Margem de Lucro (%)", analytics.profitMargin ?? 0],
    ["Ticket médio por atendimento", analytics.averageTicket ?? 0],
    ["Receita recorrente", analytics.recurringRevenue ?? 0],
    ["MRR estimado de assinaturas ativas", analytics.subscriptionMrr ?? 0],
    ["Receita avulsa", analytics.oneOffRevenue ?? 0],
    ["Receita líquida após taxas", analytics.netRevenue ?? 0],
    ["Resultado do período", analytics.operatingResult ?? 0],
    ["Ocupação da agenda (%)", analytics.occupationRate ?? 0],
    ["Clientes novos", analytics.newClients ?? 0],
    ["Clientes recorrentes", analytics.returningClients ?? 0],
    ["Clientes inativos", analytics.inactiveClients ?? 0],
    ["Retenção (%)", analytics.retentionRate ?? 0],
    ["Churn (%)", analytics.churnRate ?? 0],
    [],
    ["Faturamento por período", "Receita"],
    ...(analytics.dailyRevenue ?? []).map((row) => [row.date, row.revenue]),
    [],
    ["Desempenho por profissional", "Faturamento", "Cortes", "Comissões"],
    ...(analytics.professionals ?? []).map((row) => [
      row.name,
      row.revenue,
      row.cuts ?? 0,
      row.commissions,
    ]),
    [],
    ["Serviços mais vendidos", "Quantidade", "Faturamento"],
    ...(analytics.bestServices ?? []).map((row) => [row.name, row.quantity ?? 0, row.revenue]),
    [],
    ["Produtos mais vendidos", "Quantidade", "Faturamento"],
    ...(analytics.bestProducts ?? []).map((row) => [row.name, row.quantity ?? 0, row.revenue]),
  ];
}

export function downloadDashboardCsv(
  analytics: ReturnType<typeof calculateDashboardAnalytics>,
  range: DashboardRange,
) {
  try {
    const csv = dashboardCsvRows(analytics)
      .map((row) =>
        row
          .map((value) => {
            let text = String(value ?? "");
            if (typeof value === "string" && /^\s*[=+\-@]/.test(text)) text = `'${text}`;
            return `"${text.replaceAll('"', '""')}"`;
          })
          .join(";"),
      )
      .join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-executivo-${range?.start ?? "data"}-a-${range?.end ?? "data"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Erro ao gerar CSV do painel:", err);
  }
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function periodRange(period: string, customStart: string, customEnd: string, today: string) {
  const currentToday = today || todayISO();
  if (period === "today") return { start: currentToday, end: currentToday };
  if (period === "7days") return { start: addDays(currentToday, -6), end: currentToday };
  if (period === "month") return { start: `${currentToday.slice(0, 7)}-01`, end: currentToday };
  return {
    start: customStart || currentToday,
    end: customEnd && customEnd >= (customStart || currentToday) ? customEnd : customStart || currentToday,
  };
}
