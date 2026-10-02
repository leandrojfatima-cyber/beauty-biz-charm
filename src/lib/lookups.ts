import { useQuery } from "@tanstack/react-query";
import { db, list } from "@/lib/db";

export const useProfessionals = () => useQuery({ queryKey: ["professionals"], queryFn: () => list("professionals", "name", true) });
export const useClients = () => useQuery({ queryKey: ["clients"], queryFn: () => list("clients", "name", true) });
export const useServices = () => useQuery({ queryKey: ["services"], queryFn: () => list("services", "name", true) });
export const useProducts = () => useQuery({ queryKey: ["products"], queryFn: () => list("products", "name", true) });

/** Opens a comanda (optionally from an appointment) and returns its id. */
export async function openOrder(opts: { client_id?: string | null; appointment?: any; services?: any[] }) {
  const { data, error } = await db
    .from("orders")
    .insert({ client_id: opts.client_id ?? opts.appointment?.client_id ?? null, appointment_id: opts.appointment?.id ?? null })
    .select("id")
    .single();
  if (error) throw error;
  const a = opts.appointment;
  if (a?.service_id) {
    const s = opts.services?.find((x) => x.id === a.service_id);
    if (s) {
      const { error: e2 } = await db.from("order_items").insert({
        order_id: data.id, kind: "servico", service_id: s.id, professional_id: a.professional_id,
        description: s.name, qty: 1, unit_price: s.price, commission_pct: s.commission_pct,
      });
      if (e2) throw e2;
    }
  }
  return data.id as string;
}
