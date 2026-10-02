import { supabase } from "@/integrations/supabase/client";

// Loosely typed client for brevity across CRUD screens; RLS scopes all rows to the signed-in owner.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabase as any;

export async function list<T = any>(table: string, order = "created_at", ascending = false): Promise<T[]> {
  const { data, error } = await db.from(table).select("*").order(order, { ascending });
  if (error) throw error;
  return data ?? [];
}

export const brl = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString("pt-BR");
export const fmtTime = (d: string | Date) =>
  new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
