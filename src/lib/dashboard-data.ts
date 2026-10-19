import { db } from "@/lib/db";
import { dayBounds } from "@/lib/period";
import {
  calculateDashboardAnalytics,
  dashboardDateKey,
  type DashboardRange,
} from "@/lib/dashboard-engine";

/**
 * Safely fetches rows from a Supabase table using progressive fallback strategies.
 * Strategy 1: query filtered by salon_id OR owner_id
 * Strategy 2: query filtered by owner_id
 * Strategy 3: query select("*") with limit
 * If table or column does not exist, catches error and returns [].
 */
async function fetchTableSafely(
  tableName: string,
  userId?: string,
  salonId?: string,
): Promise<any[]> {
  try {
    // Strategy 1: Filter by salon_id or owner_id if both IDs are available
    if (salonId && userId && salonId !== userId) {
      try {
        const { data, error } = await db
          .from(tableName)
          .select("*")
          .or(`salon_id.eq.${salonId},owner_id.eq.${userId}`)
          .limit(2000);
        if (!error && Array.isArray(data)) {
          return data;
        }
      } catch {
        // Continue to fallback
      }
    }

    // Strategy 2: Filter by owner_id
    if (userId) {
      try {
        const { data, error } = await db
          .from(tableName)
          .select("*")
          .eq("owner_id", userId)
          .limit(2000);
        if (!error && Array.isArray(data)) {
          return data;
        }
      } catch {
        // Continue to fallback
      }
    }

    // Strategy 3: Plain select("*")
    const { data, error } = await db.from(tableName).select("*").limit(2000);
    if (!error && Array.isArray(data)) {
      return data;
    }

    return [];
  } catch (err: any) {
    console.warn(`[dashboard-data] Safe fetch for table "${tableName}" caught:`, err?.message || err);
    return [];
  }
}

/**
 * Normalizes an appointment record to handle schema discrepancies
 * (e.g. starts_at vs appointment_date vs date vs scheduled_at).
 */
function normalizeAppointment(raw: any) {
  if (!raw) return null;
  const startsAt =
    raw.starts_at ||
    raw.appointment_date ||
    raw.scheduled_at ||
    raw.date ||
    raw.start_time ||
    raw.time ||
    raw.created_at ||
    "";
  const endsAt = raw.ends_at || raw.end_time || raw.ends || "";
  return {
    id: raw.id || "",
    client_id: raw.client_id || raw.clientId || raw.customer_id || null,
    professional_id: raw.professional_id || raw.professionalId || raw.barber_id || null,
    service_id: raw.service_id || raw.serviceId || null,
    starts_at: startsAt,
    appointment_date: startsAt,
    ends_at: endsAt,
    status: raw.status || "concluido",
    is_blocked: Boolean(raw.is_blocked || raw.blocked || false),
    is_vip: Boolean(raw.is_vip || false),
    notes: raw.notes || "",
  };
}

/**
 * Normalizes an order record (e.g. total vs total_amount, closed_at vs date).
 */
function normalizeOrder(raw: any) {
  if (!raw) return null;
  const total = Number(
    raw.total ?? raw.total_amount ?? raw.amount ?? raw.order_total ?? raw.price ?? raw.value ?? 0,
  );
  const closedAt =
    raw.closed_at ||
    raw.completed_at ||
    raw.order_date ||
    raw.date ||
    raw.closedAt ||
    raw.created_at ||
    "";
  return {
    id: raw.id || "",
    client_id: raw.client_id || raw.clientId || null,
    status: raw.status || "fechada",
    total: Number.isFinite(total) ? total : 0,
    total_amount: Number.isFinite(total) ? total : 0,
    closed_at: closedAt,
    opened_at: raw.opened_at || raw.created_at || "",
    discount: Number(raw.discount ?? 0),
    payment_method: raw.payment_method || "",
  };
}

/**
 * Normalizes a transaction record (e.g. amount vs total_amount vs net_amount).
 */
function normalizeTransaction(raw: any) {
  if (!raw) return null;
  const amount = Number(
    raw.amount ?? raw.total_amount ?? raw.total ?? raw.value ?? raw.net_amount ?? 0,
  );
  const netAmount = Number(
    raw.net_amount ?? raw.netAmount ?? raw.amount ?? raw.total_amount ?? raw.total ?? 0,
  );
  const date =
    raw.date ||
    raw.transaction_date ||
    raw.due_date ||
    (raw.created_at ? String(raw.created_at).slice(0, 10) : "");
  return {
    id: raw.id || "",
    type: raw.type || (amount >= 0 ? "receita" : "despesa"),
    amount: Number.isFinite(amount) ? amount : 0,
    net_amount: Number.isFinite(netAmount) ? netAmount : (Number.isFinite(amount) ? amount : 0),
    total_amount: Number.isFinite(amount) ? amount : 0,
    date: date,
    status: raw.status || "realizado",
    source: raw.source || "avulso",
    order_id: raw.order_id || raw.orderId || null,
    professional_id: raw.professional_id || raw.professionalId || null,
  };
}

/**
 * Normalizes an order item record.
 */
function normalizeOrderItem(raw: any) {
  if (!raw) return null;
  const qty = Number(raw.qty ?? raw.quantity ?? 1);
  const unitPrice = Number(raw.unit_price ?? raw.price ?? raw.unitPrice ?? 0);
  const commissionPct = Number(raw.commission_pct ?? raw.commission ?? raw.commissionPct ?? 0);
  return {
    id: raw.id || "",
    order_id: raw.order_id || raw.orderId || "",
    kind: raw.kind || (raw.product_id ? "produto" : "servico"),
    service_id: raw.service_id || raw.serviceId || null,
    product_id: raw.product_id || raw.productId || null,
    professional_id: raw.professional_id || raw.professionalId || null,
    description: raw.description || raw.name || "",
    qty: Number.isFinite(qty) ? qty : 1,
    unit_price: Number.isFinite(unitPrice) ? unitPrice : 0,
    commission_pct: Number.isFinite(commissionPct) ? commissionPct : 0,
  };
}

export async function loadExecutiveDashboard(range: DashboardRange) {
  const emptyResult = {
    analytics: calculateDashboardAnalytics({
      range,
      transactions: [],
      subscriptions: [],
      orders: [],
      orderItems: [],
      appointments: [],
      clients: [],
      professionals: [],
      services: [],
      products: [],
    }),
    appointments: [],
    clients: [],
    professionals: [],
    services: [],
    lowProducts: [],
    openOrders: 0,
  };

  try {
    let userId: string | undefined;
    try {
      const { data: auth } = await db.auth.getUser();
      userId = auth?.user?.id;
    } catch {
      // Ignore auth error, proceed with public/safe fetch
    }

    // Resolve salon id safely
    let salonId: string | undefined = userId;
    if (userId) {
      try {
        const { data: salon } = await db
          .from("salon_settings")
          .select("id")
          .eq("owner_id", userId)
          .maybeSingle();

        if (salon?.id) {
          salonId = salon.id;
        } else {
          const { data: anySalon } = await db.from("salon_settings").select("id").limit(1).maybeSingle();
          if (anySalon?.id) salonId = anySalon.id;
        }
      } catch {
        salonId = userId;
      }
    }

    const { from, to } = dayBounds(range.start, range.end);
    const historyEnd = new Date(to).toISOString();

    // Fetch all tables safely using parallel requests that never throw
    const [
      rawTransactions,
      rawOrders,
      rawAppointments,
      rawClients,
      rawProfessionals,
      rawServices,
      rawProducts,
      rawSubscriptions,
      rawOrderItems,
    ] = await Promise.all([
      fetchTableSafely("transactions", userId, salonId),
      fetchTableSafely("orders", userId, salonId),
      fetchTableSafely("appointments", userId, salonId),
      fetchTableSafely("clients", userId, salonId),
      fetchTableSafely("professionals", userId, salonId),
      fetchTableSafely("services", userId, salonId),
      fetchTableSafely("products", userId, salonId),
      fetchTableSafely("client_subscriptions", userId, salonId),
      fetchTableSafely("order_items", userId, salonId),
    ]);

    // Normalize all records defensively
    const normalizedAppointments = rawAppointments
      .map(normalizeAppointment)
      .filter((a): a is NonNullable<typeof a> => Boolean(a && a.id));

    const normalizedOrders = rawOrders
      .map(normalizeOrder)
      .filter((o): o is NonNullable<typeof o> => Boolean(o && o.id));

    const normalizedTransactions = rawTransactions
      .map(normalizeTransaction)
      .filter((t): t is NonNullable<typeof t> => Boolean(t && t.id));

    const normalizedOrderItems = rawOrderItems
      .map(normalizeOrderItem)
      .filter((i): i is NonNullable<typeof i> => Boolean(i && i.id));

    const normalizedClients = (rawClients || []).map((c: any) => ({
      id: c?.id || "",
      name: c?.name || c?.full_name || "Cliente",
      phone: c?.phone || c?.whatsapp || "",
      created_at: c?.created_at || c?.createdAt || "",
      is_vip: Boolean(c?.is_vip || false),
    }));

    const normalizedProfessionals = (rawProfessionals || []).map((p: any) => ({
      id: p?.id || "",
      name: p?.name || "Profissional",
      active: p?.active !== false,
      schedule_details: p?.schedule_details || p?.working_hours || null,
    }));

    const normalizedServices = (rawServices || []).map((s: any) => ({
      id: s?.id || "",
      name: s?.name || "Serviço",
      active: s?.active !== false,
      price: Number(s?.price ?? 0),
    }));

    const normalizedProducts = (rawProducts || []).map((p: any) => ({
      id: p?.id || "",
      name: p?.name || "Produto",
      stock: Number(p?.stock ?? p?.quantity ?? 0),
      min_stock: Number(p?.min_stock ?? p?.minStock ?? 0),
      active: p?.active !== false,
      price: Number(p?.price ?? 0),
    }));

    const normalizedSubscriptions = (rawSubscriptions || []).map((sub: any) => ({
      id: sub?.id || "",
      status: sub?.status || "ativa",
      starts_at: sub?.starts_at || sub?.start_date || "",
      renews_at: sub?.renews_at || sub?.renew_date || "",
      plan: sub?.plan || { price: Number(sub?.price ?? 0), billing_cycle: sub?.billing_cycle || "mensal" },
    }));

    // In-memory date filtering using resilient date helpers
    const filteredOrders = normalizedOrders.filter((order) => {
      const isClosed = order.status === "fechada" || order.status === "paga" || order.status === "concluida";
      if (!isClosed) return false;
      const closedDate = dashboardDateKey(order.closed_at);
      if (!closedDate) return true; // Include if date missing to avoid dropping revenue
      return closedDate >= range.start && closedDate <= range.end;
    });

    const filteredAppointments = normalizedAppointments.filter((appointment) => {
      const appDate = dashboardDateKey(appointment.starts_at);
      if (!appDate) return true;
      return appDate <= historyEnd.slice(0, 10);
    });

    const openOrdersCount = normalizedOrders.filter(
      (order) => order.status === "aberta" || order.status === "pendente",
    ).length;

    const analytics = calculateDashboardAnalytics({
      range,
      transactions: normalizedTransactions,
      subscriptions: normalizedSubscriptions,
      orders: filteredOrders,
      orderItems: normalizedOrderItems,
      appointments: filteredAppointments,
      clients: normalizedClients,
      professionals: normalizedProfessionals,
      services: normalizedServices,
      products: normalizedProducts,
    });

    return {
      analytics,
      appointments: normalizedAppointments,
      clients: normalizedClients,
      professionals: normalizedProfessionals,
      services: normalizedServices,
      lowProducts: normalizedProducts.filter(
        (product) => product.active && product.stock <= product.min_stock,
      ),
      openOrders: openOrdersCount,
    };
  } catch (err: any) {
    console.error("[dashboard-data] Unexpected error in loadExecutiveDashboard:", err);
    return emptyResult;
  }
}
