import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, Stat } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brl, db, todayISO } from "@/lib/db";
import { useProfessionals } from "@/lib/lookups";
import { currentMonth, dayBounds, monthRange } from "@/lib/period";

export const Route = createFileRoute("/_authenticated/comissoes")({
  head: () => ({ meta: [{ title: "Comissões — Salão" }] }),
  component: ComissoesPage,
});

function ComissoesPage() {
  const m = monthRange(currentMonth());
  const [start, setStart] = useState(m.start);
  const [end, setEnd] = useState(m.end);
  const [open, setOpen] = useState<string | null>(null);
  const qc = useQueryClient();
  const { data: pros = [] } = useProfessionals();
  const { data: items = [] } = useQuery({
    queryKey: ["commission-items", start, end],
    queryFn: async () => {
      const { from, to } = dayBounds(start, end);
      const { data, error } = await db.from("order_items").select("*, orders!inner(number, status, closed_at)")
        .eq("orders.status", "fechada").gte("orders.closed_at", from).lte("orders.closed_at", to);
      if (error) throw error;
      return data;
    },
  });

  const rows = pros.map((p: any) => {
    const mine = items.filter((i: any) => i.professional_id === p.id);
    const sum = (kind: string, f: (i: any) => number) => mine.filter((i: any) => i.kind === kind).reduce((s: number, i: any) => s + f(i), 0);
    const total = (i: any) => Number(i.qty) * Number(i.unit_price);
    const comm = (i: any) => total(i) * Number(i.commission_pct) / 100;
    return { p, mine, svcSales: sum("servico", total), svcComm: sum("servico", comm), prodSales: sum("produto", total), prodComm: sum("produto", comm) };
  }).filter((r: any) => r.mine.length || r.p.active);

  const totalComm = rows.reduce((s: number, r: any) => s + r.svcComm + r.prodComm, 0);
  const totalSales = rows.reduce((s: number, r: any) => s + r.svcSales + r.prodSales, 0);

  const pay = useMutation({
    mutationFn: async (r: any) => {
      const { error } = await db.from("transactions").insert({ type: "despesa", category: "comissões", description: `Comissão ${r.p.name} (${start} a ${end})`, amount: r.svcComm + r.prodComm, date: todayISO() });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transactions"] }); toast.success("Pagamento lançado como despesa"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="Relatório de comissões" subtitle="Calculado sobre comandas fechadas no período" actions={<>
        <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-40" />
        <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-40" />
      </>} />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Vendas no período" value={brl(totalSales)} />
        <Stat label="Comissões a pagar" value={brl(totalComm)} tone="primary" />
        <Stat label="Profissionais" value={String(rows.length)} />
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-4 py-3">Profissional</th><th className="px-4 py-3 text-right">Serviços</th><th className="px-4 py-3 text-right">Com. serviços</th><th className="px-4 py-3 text-right">Produtos</th><th className="px-4 py-3 text-right">Com. produtos</th><th className="px-4 py-3 text-right">Total comissão</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (<Fragment key={r.p.id}>
              <tr className="cursor-pointer border-b hover:bg-muted/30" onClick={() => setOpen(open === r.p.id ? null : r.p.id)}>
                <td className="px-4 py-3 font-medium">{r.p.name}</td>
                <td className="px-4 py-3 text-right">{brl(r.svcSales)}</td>
                <td className="px-4 py-3 text-right">{brl(r.svcComm)}</td>
                <td className="px-4 py-3 text-right">{brl(r.prodSales)}</td>
                <td className="px-4 py-3 text-right">{brl(r.prodComm)}</td>
                <td className="px-4 py-3 text-right font-semibold text-primary">{brl(r.svcComm + r.prodComm)}</td>
                <td className="px-2 text-right"><Button size="sm" variant="outline" disabled={r.svcComm + r.prodComm <= 0}
                  onClick={(e) => { e.stopPropagation(); confirm(`Lançar pagamento de ${brl(r.svcComm + r.prodComm)} para ${r.p.name}?`) && pay.mutate(r); }}>Pagar</Button></td>
              </tr>
              {open === r.p.id && r.mine.map((i: any) => (
                <tr key={i.id} className="border-b bg-muted/20 text-xs text-muted-foreground">
                  <td className="px-8 py-2" colSpan={2}>#{i.orders.number} · {i.description} ×{Number(i.qty)}</td>
                  <td className="px-4 py-2 text-right" colSpan={3}>{brl(Number(i.qty) * Number(i.unit_price))} × {Number(i.commission_pct)}%</td>
                  <td className="px-4 py-2 text-right">{brl(Number(i.qty) * Number(i.unit_price) * Number(i.commission_pct) / 100)}</td><td />
                </tr>
              ))}
            </Fragment>))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Clique em um profissional para ver o detalhamento.</p>
    </div>
  );
}
