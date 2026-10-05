import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { brl, db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/master")({
  head: () => ({ meta: [{ title: "Conta Master — Belezi" }, { name: "description", content: "Consulte a auditoria e gerencie os valores de venda do Belezi com acesso restrito." }, { property: "og:title", content: "Conta Master — Belezi" }, { property: "og:description", content: "Consulte a auditoria e gerencie os valores de venda do Belezi com acesso restrito." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: MasterPage,
});

function MasterPage() {
  const qc = useQueryClient();
  const { data: isMaster, isLoading } = useQuery({
    queryKey: ["is-master"],
    queryFn: async () => { const { data, error } = await db.rpc("claim_master"); if (error) throw error; return !!data; },
  });
  const { data: logs = [] } = useQuery({
    queryKey: ["audit"], enabled: !!isMaster,
    queryFn: async () => { const { data, error } = await db.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(300); if (error) throw error; return data; },
  });
  const { data: plans = [] } = useQuery({
    queryKey: ["plans"], enabled: !!isMaster,
    queryFn: async () => { const { data, error } = await db.from("plans").select("*").order("created_at"); if (error) throw error; return data; },
  });
  const [filter, setFilter] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["plans"] });
  const err = (e: any) => toast.error(e.message);

  const save = useMutation({
    mutationFn: async (p: any) => {
      const { id, created_at, ...patch } = p;
      const { error } = await db.from("plans").update(patch).eq("id", id);
      if (error) throw error;
      await logAudit("Alterou plano de venda", `${p.name}: ${brl(p.price)} ou ${p.installments}x ${brl(p.installment_price)}${p.optional ? " (opcional)" : ""}${p.active ? "" : " (inativo)"}`);
    },
    onSuccess: () => { refresh(); toast.success("Plano salvo"); }, onError: err,
  });
  const add = useMutation({
    mutationFn: async () => { const { error } = await db.from("plans").insert({ name: "Novo plano" }); if (error) throw error; await logAudit("Criou plano de venda"); },
    onSuccess: refresh, onError: err,
  });
  const del = useMutation({
    mutationFn: async (p: any) => { const { error } = await db.from("plans").delete().eq("id", p.id); if (error) throw error; await logAudit("Excluiu plano de venda", p.name); },
    onSuccess: refresh, onError: err,
  });

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!isMaster) return <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Acesso restrito à Conta Master.</p>;

  const shown = logs.filter((l: any) => !filter || `${l.email} ${l.action} ${l.details ?? ""}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-10">
      <section>
        <PageHeader title="Valores de venda" subtitle="Planos oferecidos aos donos de salão. Marque como opcional e escolha os valores."
          actions={<Button onClick={() => add.mutate()}><Plus className="mr-1 h-4 w-4" />Novo plano</Button>} />
        <div className="space-y-3">
          {plans.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum plano cadastrado.</p>}
          {plans.map((p: any) => <PlanRow key={p.id} plan={p} onSave={(v) => save.mutate(v)} onDelete={() => confirm("Excluir plano?") && del.mutate(p)} />)}
        </div>
      </section>

      <section>
        <PageHeader title="Auditoria" subtitle="Tudo o que foi feito no sistema" actions={<Input placeholder="Buscar..." value={filter} onChange={(e) => setFilter(e.target.value)} className="w-56" />} />
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="mobile-table w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">Data / hora</th><th className="px-4 py-3">Usuário / e-mail</th><th className="px-4 py-3">Ação</th><th className="px-4 py-3">Dispositivo</th><th className="px-4 py-3">Detalhes</th></tr>
            </thead>
            <tbody>
              {shown.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum registro.</td></tr>}
              {shown.map((l: any) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td data-label="Data / hora" className="whitespace-nowrap px-4 py-3">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                  <td data-label="Usuário / e-mail" className="px-4 py-3">{l.email}</td>
                  <td data-label="Ação" className="px-4 py-3 font-medium">{l.action}</td>
                  <td data-label="Dispositivo" className="px-4 py-3 text-muted-foreground">{l.device}</td>
                  <td data-label="Detalhes" className="px-4 py-3 text-muted-foreground">{l.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PlanRow({ plan, onSave, onDelete }: { plan: any; onSave: (p: any) => void; onDelete: () => void }) {
  const [p, setP] = useState(plan);
  const num = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setP({ ...p, [k]: Number(e.target.value || 0) });
  return (
    <div className="grid grid-cols-2 items-end gap-3 rounded-lg border bg-card p-4 xl:grid-cols-[1fr_120px_90px_120px_auto_auto_auto]">
      <label className="col-span-2 text-xs text-muted-foreground xl:col-span-1">Nome<Input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></label>
      <label className="text-xs text-muted-foreground">À vista (R$)<Input type="number" step="0.01" value={p.price} onChange={num("price")} /></label>
      <label className="text-xs text-muted-foreground">Parcelas<Input type="number" min="1" value={p.installments} onChange={num("installments")} /></label>
      <label className="text-xs text-muted-foreground">Valor parcela<Input type="number" step="0.01" value={p.installment_price} onChange={num("installment_price")} /></label>
      <label className="flex items-center gap-2 pb-2 text-sm"><Switch checked={p.optional} onCheckedChange={(v) => setP({ ...p, optional: v })} />Opcional</label>
      <label className="flex items-center gap-2 pb-2 text-sm"><Switch checked={p.active} onCheckedChange={(v) => setP({ ...p, active: v })} />Ativo</label>
      <div className="flex gap-1"><Button onClick={() => onSave(p)}>Salvar</Button><Button variant="ghost" size="icon" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
    </div>
  );
}
