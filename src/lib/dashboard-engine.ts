export type DashboardRange = { start: string; end: string };

type Row = Partial<
  Record<
    | "id"
    | "name"
    | "status"
    | "starts_at"
    | "ends_at"
    | "renews_at"
    | "active"
    | "client_id"
    | "created_at"
    | "professional_id"
    | "service_id"
    | "product_id"
    | "is_blocked"
    | "schedule_details"
    | "start"
    | "end"
    | "type"
    | "date"
    | "amount"
    | "net_amount"
    | "source"
    | "closed_at"
    | "total"
    | "order_id"
    | "qty"
    | "unit_price"
    | "commission_pct"
    | "kind"
    | "description"
    | "plan"
    | "price"
    | "billing_cycle",
    any
  >
>;

export function calculateSubscriptionMrr(subscriptions: Row[], asOf: string) {
  const cycleMonths: Record<string, number> = {
    mensal: 1,
    trimestral: 3,
    semestral: 6,
    anual: 12,
  };
  return subscriptions.reduce((total, subscription) => {
    if (
      subscription.status !== "ativa" ||
      (subscription.starts_at && subscription.starts_at.slice(0, 10) > asOf) ||
      (subscription.renews_at && subscription.renews_at.slice(0, 10) <= asOf)
    ) {
      return total;
    }
    const plan = Array.isArray(subscription.plan) ? subscription.plan[0] : subscription.plan;
    if (!plan) return total;
    return total + Number(plan.price ?? 0) / (cycleMonths[plan.billing_cycle] ?? 1);
  }, 0);
}

const completed = (appointment: Row) =>
  appointment.status === "concluido" && Boolean(appointment.client_id);

export function dashboardDateKey(value: string | Date): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(value: string, amount: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return dashboardDateKey(date);
}

function scheduleMinutes(start: string, end: string): number {
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

function businessMinutes(professionals: Row[], range: DashboardRange): number {
  let total = 0;
  for (let date = range.start; date <= range.end; date = addDays(date, 1)) {
    const weekday = weekdayNames[new Date(`${date}T12:00:00`).getDay()] ?? "sunday";
    for (const professional of professionals) {
      const day = professional.schedule_details?.[weekday];
      if (professional.active !== false && day?.active && day.start && day.end) {
        total += scheduleMinutes(day.start, day.end);
      }
    }
  }
  return total;
}

function occupiedMinutes(
  appointments: Row[],
  professionals: Row[],
  range: DashboardRange,
): number {
  const professionalMap = new Map(professionals.map((professional) => [professional.id, professional]));
  const grouped = new Map<string, Array<[number, number]>>();
  for (const appointment of appointments) {
    if (
      appointment.status === "cancelado" ||
      appointment.status === "bloqueado" ||
      appointment.is_blocked ||
      dashboardDateKey(appointment.starts_at) < range.start ||
      dashboardDateKey(appointment.starts_at) > range.end
    ) {
      continue;
    }
    const start = new Date(appointment.starts_at).getTime();
    const end = new Date(appointment.ends_at).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const date = dashboardDateKey(appointment.starts_at);
    const weekday = weekdayNames[new Date(`${date}T12:00:00`).getDay()] ?? "sunday";
    const professional = professionalMap.get(appointment.professional_id);
    const day = professional?.schedule_details?.[weekday];
    if (professional?.active === false || !day?.active || !day.start || !day.end) continue;
    const scheduleStart = new Date(`${date}T${day.start}:00`).getTime();
    const scheduleEnd = new Date(`${date}T${day.end}:00`).getTime();
    const clippedStart = Math.max(start, scheduleStart);
    const clippedEnd = Math.min(end, scheduleEnd);
    if (clippedEnd <= clippedStart) continue;
    const key = `${appointment.professional_id ?? "unknown"}:${date}`;
    grouped.set(key, [...(grouped.get(key) ?? []), [clippedStart, clippedEnd]]);
  }

  let minutes = 0;
  for (const intervals of grouped.values()) {
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
  transactions: Row[];
  subscriptions?: Row[];
  orders: Row[];
  orderItems: Row[];
  appointments: Row[];
  clients: Row[];
  professionals: Row[];
  services: Row[];
  products: Row[];
}) {
  const {
    range,
    transactions,
    subscriptions = [],
    orders,
    orderItems,
    appointments,
    clients,
    professionals,
    services,
    products,
  } = input;

  const actualRevenue = transactions.filter(
    (row) =>
      row.type === "receita" &&
      row.status !== "previsto" &&
      row.status !== "cancelado" &&
      row.date >= range.start &&
      row.date <= range.end,
  );
  const revenue = actualRevenue.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const netRevenue = actualRevenue.reduce(
    (sum, row) => sum + Number(row.net_amount ?? row.amount ?? 0),
    0,
  );
  const recurringRevenue = actualRevenue
    .filter((row) => row.source === "assinatura")
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const subscriptionMrr = calculateSubscriptionMrr(subscriptions, range.end);
  const oneOffRevenue = actualRevenue
    .filter((row) => row.source !== "assinatura")
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const expenses = transactions
    .filter(
      (row) =>
        row.type === "despesa" &&
        row.status !== "previsto" &&
        row.status !== "cancelado" &&
        row.date >= range.start &&
        row.date <= range.end,
    )
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

  const ordersInRange = orders.filter(
    (order) =>
      order.status === "fechada" &&
      order.closed_at &&
      dashboardDateKey(order.closed_at) >= range.start &&
      dashboardDateKey(order.closed_at) <= range.end,
  );
  const completedAppointments = appointments.filter(
    (appointment) =>
      completed(appointment) &&
      dashboardDateKey(appointment.starts_at) >= range.start &&
      dashboardDateKey(appointment.starts_at) <= range.end,
  );
  const visitsByClient = new Map<string, string[]>();
  for (const appointment of appointments) {
    if (!completed(appointment) || dashboardDateKey(appointment.starts_at) > range.end) continue;
    visitsByClient.set(appointment.client_id, [
      ...(visitsByClient.get(appointment.client_id) ?? []),
      dashboardDateKey(appointment.starts_at),
    ]);
  }

  const currentClients = new Set(completedAppointments.map((appointment) => appointment.client_id));
  const previousDays =
    Math.max(
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
    if (!client.id) continue;
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
  const professionalsById = new Map(professionals.map((professional) => [professional.id, professional]));
  const servicesById = new Map(services.map((service) => [service.id, service]));
  const productsById = new Map(products.map((product) => [product.id, product]));
  const professionalStats = new Map<string, { revenue: number; commissions: number; cuts: number }>();
  const serviceStats = new Map<string, { quantity: number; revenue: number }>();
  const productStats = new Map<string, { quantity: number; revenue: number }>();
  const dailyRevenue = new Map<string, number>();

  for (const transaction of actualRevenue) {
    dailyRevenue.set(
      transaction.date,
      (dailyRevenue.get(transaction.date) ?? 0) + Number(transaction.amount ?? 0),
    );
  }
  for (const appointment of completedAppointments) {
    const day = dashboardDateKey(appointment.starts_at);
    dailyRevenue.set(day, dailyRevenue.get(day) ?? 0);
  }
  for (const item of orderItems) {
    const order = orderMap.get(item.order_id);
    if (!order) continue;
    const quantity = Number(item.qty ?? 0);
    const amount = quantity * Number(item.unit_price ?? 0);
    const commission = amount * Number(item.commission_pct ?? 0) / 100;

    if (item.professional_id) {
      const stats = professionalStats.get(item.professional_id) ?? { revenue: 0, commissions: 0, cuts: 0 };
      stats.revenue += amount;
      stats.commissions += commission;
      if (item.kind === "servico") stats.cuts += quantity;
      professionalStats.set(item.professional_id, stats);
    }
    if (item.kind === "servico") {
      const key = item.service_id ?? item.description ?? "servico";
      const stats = serviceStats.get(key) ?? { quantity: 0, revenue: 0 };
      stats.quantity += quantity;
      stats.revenue += amount;
      serviceStats.set(key, stats);
    } else if (item.kind === "produto") {
      const key = item.product_id ?? item.description ?? "produto";
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

  const daily: Array<{ date: string; revenue: number }> = [];
  for (let date = range.start; date <= range.end; date = addDays(date, 1)) {
    daily.push({ date, revenue: dailyRevenue.get(date) ?? 0 });
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

  return {
    revenue,
    averageTicket: ordersInRange.length
      ? ordersInRange.reduce((sum, order) => sum + Number(order.total ?? 0), 0) / ordersInRange.length
      : 0,
    closedOrders: ordersInRange.length,
    recurringRevenue,
    subscriptionMrr,
    oneOffRevenue,
    netRevenue,
    expenses,
    operatingResult: netRevenue - expenses,
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
    bestServices: ranking(serviceStats, servicesById),
    bestProducts: ranking(productStats, productsById),
  };
}

export function dashboardCsvRows(analytics: ReturnType<typeof calculateDashboardAnalytics>) {
  return [
    ["Relatório Executivo Belezi"],
    ["Faturamento", analytics.revenue],
    ["Ticket médio por comanda", analytics.averageTicket],
    ["Receita recorrente", analytics.recurringRevenue],
    ["MRR estimado de assinaturas ativas", analytics.subscriptionMrr],
    ["Receita avulsa", analytics.oneOffRevenue],
    ["Receita líquida após taxas", analytics.netRevenue],
    ["Despesas realizadas", analytics.expenses],
    ["Resultado do período", analytics.operatingResult],
    ["Ocupação da agenda (%)", analytics.occupationRate],
    ["Clientes novos", analytics.newClients],
    ["Clientes recorrentes", analytics.returningClients],
    ["Clientes inativos", analytics.inactiveClients],
    ["Retenção (%)", analytics.retentionRate],
    ["Churn (%)", analytics.churnRate],
    [],
    ["Faturamento por período", "Receita"],
    ...analytics.dailyRevenue.map((row) => [row.date, row.revenue]),
    [],
    ["Desempenho por profissional", "Faturamento", "Cortes", "Comissões"],
    ...analytics.professionals.map((row) => [row.name, row.revenue, row.cuts ?? 0, row.commissions]),
    [],
    ["Serviços mais vendidos", "Quantidade", "Faturamento"],
    ...analytics.bestServices.map((row) => [row.name, row.quantity ?? 0, row.revenue]),
    [],
    ["Produtos mais vendidos", "Quantidade", "Faturamento"],
    ...analytics.bestProducts.map((row) => [row.name, row.quantity ?? 0, row.revenue]),
  ];
}

export function downloadDashboardCsv(
  analytics: ReturnType<typeof calculateDashboardAnalytics>,
  range: DashboardRange,
) {
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
  link.download = `relatorio-executivo-${range.start}-a-${range.end}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function periodRange(period: string, customStart: string, customEnd: string, today: string) {
  if (period === "today") return { start: today, end: today };
  if (period === "7days") return { start: addDays(today, -6), end: today };
  if (period === "month") return { start: `${today.slice(0, 7)}-01`, end: today };
  return {
    start: customStart || today,
    end: customEnd && customEnd >= (customStart || today) ? customEnd : customStart || today,
  };
}
