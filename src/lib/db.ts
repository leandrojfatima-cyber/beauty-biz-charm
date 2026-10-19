import { supabase } from "@/integrations/supabase/client";

// Loosely typed client for brevity across CRUD screens; RLS scopes all rows to the signed-in owner.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabase as any;

export async function list<T = any>(
  table: string,
  order = "created_at",
  ascending = false,
): Promise<T[]> {
  try {
    const { data, error } = await db.from(table).select("*").order(order, { ascending });
    if (!error && Array.isArray(data)) {
      return data;
    }
    if (error) {
      console.warn(`[db.list] Falha ao ordenar ${table} por ${order}:`, error.message);
      const { data: fallbackData, error: fallbackErr } = await db.from(table).select("*").limit(2000);
      if (!fallbackErr && Array.isArray(fallbackData)) {
        return fallbackData;
      }
    }
    return [];
  } catch (err: any) {
    console.warn(`[db.list] Exceção na tabela ${table}:`, err?.message || err);
    return [];
  }
}

export const brl = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "";
  try {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString("pt-BR");
  } catch {
    return String(d ?? "");
  }
};

export const fmtTime = (d: string | Date | null | undefined) => {
  if (!d) return "--:--";
  try {
    if (typeof d === "string" && /^\d{2}:\d{2}/.test(d)) return d.slice(0, 5);
    const dt = new Date(d);
    return isNaN(dt.getTime())
      ? String(d)
      : dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
};

export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
