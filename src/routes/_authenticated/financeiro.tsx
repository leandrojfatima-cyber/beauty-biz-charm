import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Stat } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { brl, db, fmtDate, todayISO } from "@/lib/db";
import { currentMonth, monthRange } from "@/lib/period";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Belezi" }] }),
  component: FinanceiroPage,
});

function FinanceiroPage() {
  const [month, setMonth] = useState(currentMonth());
  const { start, end } = monthRange(month);
  const qc = useQueryClient();
  const { data: tx = [] } = useQuery({
    queryKey: ["transactions", month],
    queryFn: async () => {
      const { data, error } = await db.from("transactions").select("*").gte("date", start).lte("date", end).order("date", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: before = 0 } = useQuery({
    queryKey: ["balance-before", month],
    queryFn: async () => {
      const { data, error } = await db.from("transactions").select("type, amount").lt("date", start);
      if (error) throw error;
      return data.reduce((s: number, t: any) => s + (t.type === "receita" ? 1 : -1) * Number(t.amount), 0);
    },
  });
  const [form, setForm] = useState<any | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await db.from("transactions").insert({ ...form, amount: Number(form.amount) });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries(); setForm(null); toast.success("Lançamento salvo"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.from("transactions").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries(),
  });

  const income = tx.filter((t: any) => t.type === "receita").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const expense = tx.filter((t: any) => t.type === "despesa").reduce((s: number, t: any) => s + Number(t.amount), 0);

  // daily cash flow
  const days: Record<string, { in: number; out: number }> = {};
  tx.forEach((t: any) => { const d = (days[t.date] ??= { in: 0, out: 0 }); d[t.type === "receita" ? "in" : "out"] += Number(t.amount); });
  let running = before;
  const flow = Object.keys(days).sort().map((d) => { const v = days[d]!; running += v.in - v.out; return { d, in: v.in, out: v.out, bal: running }; });
  const max = Math.max(1, ...flow.map((f) => Math.max(f.in, f.out)));

  const byCat: Record<string, number> = {};
  tx.filter((t: any) => t.type === "despesa").forEach((t: any) => (byCat[t.category] = (byCat[t.category] ?? 0) + Number(t.amount)));

  return (
    <div>
      <PageHeader title="Financeiro" subtitle="Fluxo de caixa, receitas e despesas" actions={<>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
        <Button variant="outline" onClick={() => setForm({ type: "despesa", category: "geral", description: "", amount: "", date: todayISO() })}><Minus className="mr-1 h-4 w-4" />Despesa</Button>
        <Button onClick={() => setForm({ type: "receita", category: "geral", description: "", amount: "", date: todayISO() })}><Plus className="mr-1 h-4 w-4" />Receita</Button>
      </>} />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Saldo inicial" value={brl(before)} />
        <Stat label="Receitas" value={brl(income)} tone="success" />
        <Stat label="Despesas" value={brl(expense)} tone="destructive" />
        <Stat label="Saldo final" value={brl(before + income - expense)} tone="primary" />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-4 text-sm font-semibold">Fluxo de caixa diário</p>
          {flow.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Sem movimentações no mês.</p> : (
            <div className="flex h-40 items-end gap-1.5 overflow-x-auto">
              {flow.map((f) => (
                <div key={f.d} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${fmtDate(f.d + "T12:00")}: +${brl(f.in)} / -${brl(f.out)} · saldo ${brl(f.bal)}`}>
                  <div className="flex h-32 w-full items-end gap-0.5">
                    <div className="flex-1 rounded-t bg-success" style={{ height: `${(f.in / max) * 100}%` }} />
                    <div className="flex-1 rounded-t bg-destructive/80" style={{ height: `${(f.out / max) * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{f.d.slice(8)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-semibold">Despesas por categoria</p>
          {Object.keys(byCat).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma despesa.</p>}
          {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => (
            <div key={c} className="mb-2"><div className="flex justify-between text-sm capitalize"><span>{c}</span><span>{brl(v)}</span></div>
              <div className="mt-1 h-1.5 rounded bg-muted"><div className="h-full rounded bg-destructive/70" style={{ width: `${(v / expense) * 100}%` }} /></div></div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="mobile-table w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3 text-right">Valor</th><th /></tr>
          </thead>
          <tbody>
            {tx.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum lançamento.</td></tr>}
            {tx.map((t: any) => (
              <tr key={t.id} className="border-b last:border-0">
                <td data-label="Data" className="px-4 py-3">{fmtDate(t.date + "T12:00")}</td>
                <td data-label="Descrição" className="px-4 py-3">{t.description}</td>
                <td data-label="Categoria" className="px-4 py-3"><Badge variant="outline" className="capitalize">{t.category}</Badge></td>
                <td data-label="Valor" className={"px-4 py-3 text-right font-medium " + (t.type === "receita" ? "text-success" : "text-destructive")}>{t.type === "receita" ? "+" : "−"}{brl(t.amount)}</td>
                <td data-label="Ações" className="px-2">{!t.order_id && <Button size="icon" variant="ghost" onClick={() => confirm("Excluir lançamento?") && del.mutate(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova {form?.type}</DialogTitle></DialogHeader>
          {form && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label className="mb-1.5 block">Descrição</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={form.type === "despesa" ? "Ex.: Aluguel, energia, salário" : "Ex.: Venda avulsa"} /></div>
              <div><Label className="mb-1.5 block">Valor (R$)</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><Label className="mb-1.5 block">Data</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label className="mb-1.5 block">Categoria</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} list="cats" />
                <datalist id="cats">{["aluguel", "energia", "água", "salários", "comissões", "produtos", "marketing", "impostos", "geral"].map((c) => <option key={c} value={c} />)}</datalist></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={!form?.description || !form?.amount || save.isPending}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
