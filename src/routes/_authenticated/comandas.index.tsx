import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brl, db, fmtDate, fmtTime } from "@/lib/db";
import { openOrder, useClients } from "@/lib/lookups";

export const Route = createFileRoute("/_authenticated/comandas/")({
  head: () => ({
    meta: [
      { title: "Comandas — Belezi" },
      { name: "description", content: "Gerencie comandas do seu salão no Belezi." },
      { property: "og:title", content: "Comandas — Belezi" },
      { property: "og:description", content: "Gerencie comandas do seu salão no Belezi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComandasPage,
});

function ComandasPage() {
  const [status, setStatus] = useState("aberta");
  const navigate = useNavigate();
  const { data: clients = [] } = useClients();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", status],
    queryFn: async () => {
      const { data, error } = await db
        .from("orders")
        .select("*, order_items(qty, unit_price)")
        .eq("status", status)
        .order("opened_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });
  const create = useMutation({
    mutationFn: () => openOrder({}),
    onSuccess: (id) => navigate({ to: "/comandas/$id", params: { id } }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Comandas"
        subtitle="Atendimentos com serviços e produtos por profissional."
        actions={
          <Button onClick={() => create.mutate()}>
            <Plus className="mr-1 h-4 w-4" />
            Nova comanda
          </Button>
        }
      />
      <Tabs value={status} onValueChange={setStatus} className="mb-4">
        <TabsList>
          <TabsTrigger value="aberta">Abertas</TabsTrigger>
          <TabsTrigger value="fechada">Fechadas</TabsTrigger>
          <TabsTrigger value="cancelada">Canceladas</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && <p className="text-muted-foreground">Carregando...</p>}
        {!isLoading && orders.length === 0 && (
          <p className="col-span-full rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            Nenhuma comanda aqui.
          </p>
        )}
        {orders.map((o: any) => {
          const sub = o.order_items.reduce(
            (s: number, i: any) => s + Number(i.qty) * Number(i.unit_price),
            0,
          );
          return (
            <Link
              key={o.id}
              to="/comandas/$id"
              params={{ id: o.id }}
              className="rounded-lg border bg-card p-4 transition-colors hover:border-primary"
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-semibold">#{o.number}</span>
                <Badge
                  variant={o.status === "aberta" ? "default" : "secondary"}
                  className="capitalize"
                >
                  {o.status}
                </Badge>
              </div>
              <p className="mt-1">
                {clients.find((c: any) => c.id === o.client_id)?.name ?? "Sem cliente"}
              </p>
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 text-sm text-muted-foreground">
                <span>
                  {fmtDate(o.opened_at)} {fmtTime(o.opened_at)} · {o.order_items.length} itens
                </span>
                <span className="font-semibold text-foreground">
                  {brl(o.status === "fechada" ? o.total : sub)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
