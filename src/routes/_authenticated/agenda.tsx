import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, Receipt, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { db, fmtTime, todayISO } from "@/lib/db";
import { openOrder, useClients, useProfessionals, useServices } from "@/lib/lookups";
import { cn } from "@/lib/utils";
import { Pick } from "@/components/Pick";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({ meta: [{ title: "Agenda — Salão" }] }),
  component: AgendaPage,
});

function shift(date: string, days: number) {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function AgendaPage() {
  const [date, setDate] = useState(todayISO());
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: pros = [] } = useProfessionals();
  const { data: clients = [] } = useClients();
  const { data: services = [] } = useServices();
  const activePros = pros.filter((p: any) => p.active);

  const { data: appts = [] } = useQuery({
    queryKey: ["appointments", date],
    queryFn: async () => {
      const start = new Date(date + "T00:00:00").toISOString();
      const end = new Date(date + "T23:59:59").toISOString();
      const { data, error } = await db.from("appointments").select("*").gte("starts_at", start).lte("starts_at", end).order("starts_at");
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<any | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      const s = services.find((x: any) => x.id === form.service_id);
      const starts = new Date(`${date}T${form.time}:00`);
      const ends = new Date(starts.getTime() + (s?.duration_min ?? 60) * 60000);
      const { error } = await db.from("appointments").insert({
        client_id: form.client_id || null, professional_id: form.professional_id, service_id: form.service_id || null,
        starts_at: starts.toISOString(), ends_at: ends.toISOString(), notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["appointments"] }); setForm(null); toast.success("Agendado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const cancel = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.from("appointments").update({ status: "cancelado" }).eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });
  const toOrder = useMutation({
    mutationFn: (a: any) => openOrder({ appointment: a, services }),
    onSuccess: (id) => navigate({ to: "/comandas/$id", params: { id } }),
    onError: (e: any) => toast.error(e.message),
  });

  const name = (arr: any[], id: string) => arr.find((x) => x.id === id)?.name ?? "—";
  const label = new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div>
      <PageHeader title="Agenda" subtitle={label} actions={<>
        <Button variant="outline" size="icon" onClick={() => setDate(shift(date, -1))}><ChevronLeft className="h-4 w-4" /></Button>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
        <Button variant="outline" size="icon" onClick={() => setDate(shift(date, 1))}><ChevronRight className="h-4 w-4" /></Button>
        <Button variant="outline" onClick={() => setDate(todayISO())}>Hoje</Button>
        <Button onClick={() => setForm({ time: "09:00", professional_id: activePros[0]?.id ?? "" })} disabled={!activePros.length}><Plus className="mr-1 h-4 w-4" />Agendar</Button>
      </>} />

      {!activePros.length && <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Cadastre profissionais para começar a agendar.</p>}

      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(240px, 1fr))` }}>
        {activePros.map((p: any) => {
          const mine = appts.filter((a: any) => a.professional_id === p.id);
          return (
            <div key={p.id} className="rounded-lg border bg-card">
              <div className="border-b px-4 py-3">
                <p className="font-semibold">{p.name}</p>
                <p className="text-xs capitalize text-muted-foreground">{p.role} · {mine.filter((a: any) => a.status !== "cancelado").length} horários</p>
              </div>
              <div className="space-y-2 p-3">
                {mine.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Livre</p>}
                {mine.map((a: any) => (
                  <div key={a.id} className={cn("rounded-md border-l-4 bg-muted/40 p-3 text-sm",
                    a.status === "agendado" && "border-l-primary", a.status === "concluido" && "border-l-success opacity-70", a.status === "cancelado" && "border-l-destructive opacity-50 line-through")}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{fmtTime(a.starts_at)}–{fmtTime(a.ends_at)}</p>
                        <p>{name(clients, a.client_id)}</p>
                        <p className="text-muted-foreground">{name(services, a.service_id)}</p>
                      </div>
                      {a.status === "agendado" && (
                        <div className="flex flex-col gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Abrir comanda" onClick={() => toOrder.mutate(a)}><Receipt className="h-4 w-4 text-primary" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Cancelar" onClick={() => confirm("Cancelar agendamento?") && cancel.mutate(a.id)}><X className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo agendamento</DialogTitle></DialogHeader>
          {form && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Pick label="Profissional" value={form.professional_id} onChange={(v) => setForm({ ...form, professional_id: v })} items={activePros} />
              <Pick label="Serviço" value={form.service_id} onChange={(v) => setForm({ ...form, service_id: v })} items={services.filter((s: any) => s.active)} />
              <Pick label="Cliente" value={form.client_id} onChange={(v) => setForm({ ...form, client_id: v })} items={clients} />
              <div><Label className="mb-1.5 block">Horário</Label><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label className="mb-1.5 block">Observações</Label><Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={!form?.professional_id || save.isPending}>Agendar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
