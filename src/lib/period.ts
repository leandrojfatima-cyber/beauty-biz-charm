import { todayISO } from "@/lib/db";

export function monthRange(ym: string) {
  const [y = 2000, m = 1] = ym.split("-").map(Number);
  const start = `${ym}-01`;
  const last = new Date(y, m, 0).getDate();
  return { start, end: `${ym}-${String(last).padStart(2, "0")}` };
}
export const currentMonth = () => todayISO().slice(0, 7);
/** Inclusive local-day range to ISO timestamps */
export const dayBounds = (start: string, end: string) => ({
  from: new Date(start + "T00:00:00").toISOString(),
  to: new Date(end + "T23:59:59").toISOString(),
});
