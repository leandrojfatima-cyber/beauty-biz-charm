import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/AppShell";
import { db, list } from "@/lib/db";

export type Field = {
  key: string;
  label: string;
  type?: "text" | "number" | "boolean" | "textarea" | "select";
  options?: { value: string; label: string }[];
  required?: boolean;
  default?: unknown;
};

export type Column = { label: string; render: (row: any) => ReactNode; className?: string };

export function CrudPage({
  table, title, subtitle, singular, fields, columns, extraActions, orderBy = "name",
}: {
  table: string; title: string; subtitle?: string | undefined; singular: string;
  fields: Field[]; columns: Column[]; extraActions?: (row: any) => ReactNode; orderBy?: string;
}) {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: [table], queryFn: () => list(table, orderBy, true) });
  const [editing, setEditing] = useState<any | null>(null);
  const [search, setSearch] = useState("");

  const save = useMutation({
    mutationFn: async (row: any) => {
      const payload: any = {};
      for (const f of fields) {
        let v = row[f.key];
        if (f.type === "number") v = v === "" || v == null ? 0 : Number(v);
        if (f.type === "boolean") v = !!v;
        payload[f.key] = v === "" ? null : v;
      }
      const q = row.id ? db.from(table).update(payload).eq("id", row.id) : db.from(table).insert(payload);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [table] }); setEditing(null); toast.success("Salvo"); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.from(table).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [table] }); toast.success("Excluído"); },
    onError: (e: any) => toast.error(e.message),
  });

  const blank = () => Object.fromEntries(fields.map((f) => [f.key, f.default ?? (f.type === "boolean" ? true : "")]));
  const filtered = data.filter((r: any) => !search || String(r.name ?? "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} actions={
        <Button onClick={() => setEditing(blank())}><Plus className="mr-1 h-4 w-4" /> Novo {singular}</Button>
      } />
      <Input placeholder="Buscar pelo nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4 max-w-sm" />
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>{columns.map((c) => <th key={c.label} className={"px-4 py-3 font-medium " + (c.className ?? "")}>{c.label}</th>)}<th className="w-px" /></tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="px-4 py-6 text-muted-foreground" colSpan={columns.length + 1}>Carregando...</td></tr>}
            {!isLoading && filtered.length === 0 && <tr><td className="px-4 py-10 text-center text-muted-foreground" colSpan={columns.length + 1}>Nenhum registro ainda.</td></tr>}
            {filtered.map((row: any) => (
              <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                {columns.map((c) => <td key={c.label} className={"px-4 py-3 " + (c.className ?? "")}>{c.render(row)}</td>)}
                <td className="whitespace-nowrap px-2 py-2 text-right">
                  {extraActions?.(row)}
                  <Button size="icon" variant="ghost" onClick={() => setEditing(row)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => confirm("Excluir este registro?") && remove.mutate(row.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Novo"} {singular}</DialogTitle></DialogHeader>
          {editing && (
            <form id="crud-form" className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(editing); }}>
              {fields.map((f) => (
                <div key={f.key} className={f.type === "textarea" || f.type === "boolean" ? "sm:col-span-2" : ""}>
                  {f.type === "boolean" ? (
                    <label className="flex items-center gap-2 text-sm"><Switch checked={!!editing[f.key]} onCheckedChange={(v) => setEditing({ ...editing, [f.key]: v })} />{f.label}</label>
                  ) : (
                    <>
                      <Label className="mb-1.5 block">{f.label}</Label>
                      {f.type === "textarea" ? (
                        <Textarea value={editing[f.key] ?? ""} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} />
                      ) : f.type === "select" ? (
                        <Select value={editing[f.key] ?? ""} onValueChange={(v) => setEditing({ ...editing, [f.key]: v })}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>{f.options!.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (
                        <Input type={f.type === "number" ? "number" : "text"} step="0.01" required={f.required}
                          value={editing[f.key] ?? ""} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} />
                      )}
                    </>
                  )}
                </div>
              ))}
            </form>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button type="submit" form="crud-form" disabled={save.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
