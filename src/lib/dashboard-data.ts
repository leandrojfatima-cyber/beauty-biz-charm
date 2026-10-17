import { db } from "@/lib/db";
import { dayBounds } from "@/lib/period";
import {
  calculateDashboardAnalytics,
  type DashboardRange,
} from "@/lib/dashboard-engine";

async function fetchAllRows(queryForPage: (from: number, to: number) => any) {
  const pageSize = 1000;
  const rows: any[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await queryForPage(from, from + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
}

export async function loadExecutiveDashboard(range: DashboardRange) {
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth.user) {
    throw new Error("Sua sessão expirou. Entre novamente para ver o painel.");
  }
  const { data: salon, error: salonError } = await db
    .from("salon_settings")
    .select("id")
    .eq("owner_id", auth.user.id)
    .maybeSingle();
  if (salonError) throw salonError;
  if (!salon?.id) {
    throw new Error("Cadastre os dados da sua barbearia antes de abrir o painel executivo.");
  }

  const { from, to } = dayBounds(range.start, range.end);
  const historyEnd = new Date(to).toISOString();
  const [
    transactions,
    orders,
    appointments,
    clients,
    professionals,
    services,
    products,
    openOrders,
    subscriptions,
  ] = await Promise.all([
    fetchAllRows((pageFrom, pageTo) =>
      db
        .from("transactions")
        .select("id,type,amount,net_amount,date,source,status,order_id,professional_id")
        .eq("salon_id", salon.id)
        .gte("date", range.start)
        .lte("date", range.end)
        .range(pageFrom, pageTo),
    ),
    fetchAllRows((pageFrom, pageTo) =>
      db
        .from("orders")
        .select("id,status,total,closed_at,client_id")
        .eq("salon_id", salon.id)
        .eq("owner_id", auth.user.id)
        .gte("closed_at", from)
        .lte("closed_at", to)
        .range(pageFrom, pageTo),
    ),
    fetchAllRows((pageFrom, pageTo) =>
      db
        .from("appointments")
        .select("id,client_id,professional_id,service_id,starts_at,ends_at,status,is_blocked")
        .eq("salon_id", salon.id)
        .lte("starts_at", historyEnd)
        .range(pageFrom, pageTo),
    ),
    fetchAllRows((pageFrom, pageTo) =>
      db
        .from("clients")
        .select("id,name,created_at")
        .eq("salon_id", salon.id)
        .range(pageFrom, pageTo),
    ),
    fetchAllRows((pageFrom, pageTo) =>
      db
        .from("professionals")
        .select("id,name,active,schedule_details")
        .eq("salon_id", salon.id)
        .range(pageFrom, pageTo),
    ),
    fetchAllRows((pageFrom, pageTo) =>
      db
        .from("services")
        .select("id,name,active")
        .eq("salon_id", salon.id)
        .range(pageFrom, pageTo),
    ),
    fetchAllRows((pageFrom, pageTo) =>
      db
        .from("products")
        .select("id,name,active,stock,min_stock")
        .eq("salon_id", salon.id)
        .range(pageFrom, pageTo),
    ),
    db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("owner_id", auth.user.id)
      .eq("status", "aberta"),
    fetchAllRows((pageFrom, pageTo) =>
      db
        .from("client_subscriptions")
        .select("id,status,starts_at,renews_at,plan:salon_client_plans(price,billing_cycle,model)")
        .eq("salon_id", salon.id)
        .eq("status", "ativa")
        .range(pageFrom, pageTo),
    ),
  ]);

  if (openOrders.error) throw openOrders.error;
  const orderIds = (orders.data ?? []).map((order: any) => order.id);
  let orderItems: any[] = [];
  if (orderIds.length) {
    const { data } = await fetchAllRows((pageFrom, pageTo) =>
      db
        .from("order_items")
        .select(
          "id,order_id,kind,service_id,product_id,professional_id,description,qty,unit_price,commission_pct",
        )
        .eq("salon_id", salon.id)
        .eq("owner_id", auth.user.id)
        .in("order_id", orderIds)
        .range(pageFrom, pageTo),
    );
    orderItems = data;
  }

  return {
    analytics: calculateDashboardAnalytics({
      range,
      transactions: transactions.data ?? [],
      subscriptions: subscriptions.data ?? [],
      orders: orders.data ?? [],
      orderItems,
      appointments: appointments.data ?? [],
      clients: clients.data ?? [],
      professionals: professionals.data ?? [],
      services: services.data ?? [],
      products: products.data ?? [],
    }),
    appointments: appointments.data ?? [],
    clients: clients.data ?? [],
    professionals: professionals.data ?? [],
    services: services.data ?? [],
    lowProducts: (products.data ?? []).filter(
      (product: any) => product.active && Number(product.stock) <= Number(product.min_stock),
    ),
    openOrders: openOrders.count ?? 0,
  };
}
