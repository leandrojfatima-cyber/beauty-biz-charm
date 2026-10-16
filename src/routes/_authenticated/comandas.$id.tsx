import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { brl, db, fmtDate, fmtTime } from "@/lib/db";
import { useClients, useProducts, useProfessionals, useServices } from "@/lib/lookups";
import { Pick } from "@/components/Pick";

export const Route = createFileRoute("/_authenticated/comandas/$id")({
  head: () => ({
    meta: [
      { title: "Comanda — Belezi" },
      {
        name: "description",
        content: "Consulte serviços, produtos, comissões e pagamento desta comanda no Belezi.",
      },
      { property: "og:title", content: "Comanda — Belezi" },
      {
        property: "og:description",
        content: "Consulte serviços, produtos, comissões e pagamento desta comanda no Belezi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComandaPage,
});

const PAY = ["Dinheiro", "Pix", "Cartão de débito", "Cartão de crédito"];

function ComandaPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: pros = [] } = useProfessionals();
  const { data: clients = [] } = useClients();
  const { data: services = [] } = useServices();
  const { data: products = [] } = useProducts();
  const { data: order, refetch } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await db
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      data.order_items.sort((a: any, b: any) => a.created_at.localeCompare(b.created_at));
      return data;
    },
  });
  const [item, setItem] = useState<any>({ kind: "servico", qty: "1" });
  const [pay, setPay] = useState("Pix");
  const refresh = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["orders"] });
  };
  const err = (e: any) => toast.error(e.message);

  const update = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await db.from("orders").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: err,
  });
  const addItem = useMutation({
    mutationFn: async () => {
      const src =
        item.kind === "servico"
          ? services.find((s: any) => s.id === item.ref)
          : products.find((p: any) => p.id === item.ref);
      if (!src) throw new Error("Selecione o item");
      if (!item.professional_id) throw new Error("Selecione o profissional");
      const { error } = await db.from("order_items").insert({
        order_id: id,
        kind: item.kind,
        service_id: item.kind === "servico" ? src.id : null,
        product_id: item.kind === "produto" ? src.id : null,
        professional_id: item.professional_id,
        description: src.name,
        qty: Number(item.qty || 1),
        unit_price: src.price,
        commission_pct: src.commission_pct,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setItem({ kind: item.kind, qty: "1", professional_id: item.professional_id });
      refresh();
    },
    onError: err,
  });
  const delItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await db.from("order_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: err,
  });
  const close = useMutation({
    mutationFn: async () => {
      const { error } = await db.rpc("close_order", { _order_id: id, _payment_method: pay });
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      qc.invalidateQueries();
      toast.success("Comanda fechada e receita lançada");
    },
    onError: err,
  });

  if (!order) return <p className="text-muted-foreground">Carregando...</p>;
  const open = order.status === "aberta";
  const subtotal = order.order_items.reduce(
    (s: number, i: any) => s + Number(i.qty) * Number(i.unit_price),
    0,
  );
  const total = Math.max(subtotal - Number(order.discount), 0);
  const proName = (pid: string) => pros.find((p: any) => p.id === pid)?.name ?? "—";
  const catalog =
    item.kind === "servico"
      ? services.filter((s: any) => s.active)
      : products.filter((p: any) => p.for_sale && p.active);

  return (
    <div className="max-w-5xl">
      <Link
        to="/comandas"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Comandas
      </Link>
      <PageHeader
        title={`Comanda #${order.number}`}
        subtitle={`Aberta em ${fmtDate(order.opened_at)} às ${fmtTime(order.opened_at)}`}
        actions={
          <Badge className="capitalize" variant={open ? "default" : "secondary"}>
            {order.status}
            {order.payment_method ? ` · ${order.payment_method}` : ""}
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <div className="max-w-sm">
            {open ? (
              <Pick
                label="Cliente"
                value={order.client_id}
                onChange={(v) => update.mutate({ client_id: v })}
                items={clients}
              />
            ) : (
              <p className="text-sm">
                Cliente:{" "}
                <strong>{clients.find((c: any) => c.id === order.client_id)?.name ?? "—"}</strong>
              </p>
            )}
          </div>

          {open && (
            <div className="rounded-lg border bg-card p-4">
              <p className="mb-3 text-sm font-semibold">Adicionar item</p>
              <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[130px_minmax(0,1fr)_minmax(0,1fr)_80px_auto]">
                <div>
                  <Label className="mb-1.5 block">Tipo</Label>
                  <Select
                    value={item.kind}
                    onValueChange={(v) => setItem({ ...item, kind: v, ref: undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="servico">Serviço</SelectItem>
                      <SelectItem value="produto">Produto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Pick
                  label={item.kind === "servico" ? "Serviço" : "Produto"}
                  value={item.ref}
                  onChange={(v) => setItem({ ...item, ref: v })}
                  items={catalog.map((c: any) => ({ ...c, name: `${c.name} · ${brl(c.price)}` }))}
                />
                <Pick
                  label="Profissional"
                  value={item.professional_id}
                  onChange={(v) => setItem({ ...item, professional_id: v })}
                  items={pros.filter((p: any) => p.active)}
                />
                <div>
                  <Label className="mb-1.5 block">Qtd</Label>
                  <Input
                    type="number"
                    min="1"
                    value={item.qty}
                    onChange={(e) => setItem({ ...item, qty: e.target.value })}
                  />
                </div>
                <Button onClick={() => addItem.mutate()} disabled={addItem.isPending}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="mobile-table w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Profissional</th>
                  <th className="px-4 py-3 text-right">Qtd</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Comissão</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {order.order_items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum item.
                    </td>
                  </tr>
                )}
                {order.order_items.map((i: any) => {
                  const t = Number(i.qty) * Number(i.unit_price);
                  return (
                    <tr key={i.id} className="border-b last:border-0">
                      <td data-label="Item" className="px-4 py-3">
                        <span className="font-medium">{i.description}</span>{" "}
                        <Badge variant="outline" className="ml-1 text-[10px]">
                          {i.kind}
                        </Badge>
                      </td>
                      <td data-label="Profissional" className="px-4 py-3">
                        {proName(i.professional_id)}
                      </td>
                      <td data-label="Qtd" className="px-4 py-3 text-right">
                        {Number(i.qty)}
                      </td>
                      <td data-label="Total" className="px-4 py-3 text-right">
                        {brl(t)}
                      </td>
                      <td
                        data-label="Comissão"
                        className="px-4 py-3 text-right text-muted-foreground"
                      >
                        {brl((t * Number(i.commission_pct)) / 100)}{" "}
                        <span className="text-xs">({Number(i.commission_pct)}%)</span>
                      </td>
                      <td data-label="Ações" className="px-2">
                        {open && (
                          <Button size="icon" variant="ghost" onClick={() => delItem.mutate(i.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="h-fit space-y-4 rounded-lg border bg-card p-5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{brl(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Desconto</span>
            {open ? (
              <Input
                type="number"
                step="0.01"
                className="h-8 w-28 text-right"
                defaultValue={order.discount}
                onBlur={(e) => update.mutate({ discount: Number(e.target.value || 0) })}
              />
            ) : (
              <span>{brl(order.discount)}</span>
            )}
          </div>
          <div className="flex justify-between border-t pt-3 font-display text-xl font-semibold">
            <span>Total</span>
            <span>{brl(open ? total : order.total)}</span>
          </div>
          {open && (
            <>
              <div>
                <Label className="mb-1.5 block">Pagamento</Label>
                <Select value={pay} onValueChange={setPay}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAY.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                size="lg"
                disabled={!order.order_items.length || close.isPending}
                onClick={() => close.mutate()}
              >
                Fechar comanda
              </Button>
              <Button
                variant="ghost"
                className="w-full text-destructive"
                onClick={() =>
                  confirm("Cancelar esta comanda?") && update.mutate({ status: "cancelada" })
                }
              >
                Cancelar comanda
              </Button>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
