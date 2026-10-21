import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Plus,
  Trash2,
  QrCode,
  CreditCard,
  Sparkles,
  Zap,
  CheckCircle2,
  Copy,
  Clock,
  Building2,
  UserCheck,
  Percent,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  calculatePaymentSplit,
  generatePodiumPixPayload,
  loadPodiumPayRates,
} from "@/services/payments";

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

const PAY = [
  "Pix",
  "Cartão de crédito",
  "Cartão de débito",
  "Dinheiro",
  "Assinatura / Clube VIP",
];

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
      try {
        const { data, error } = await db
          .from("orders")
          .select("*, order_items(*)")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        if (data && Array.isArray(data.order_items)) {
          data.order_items.sort((a: any, b: any) =>
            String(a?.created_at ?? "").localeCompare(String(b?.created_at ?? "")),
          );
        }
        return data;
      } catch (err: any) {
        console.error("Erro ao buscar comanda:", err);
        return null;
      }
    },
  });

  const [item, setItem] = useState<any>({ kind: "servico", qty: "1" });
  const [pay, setPay] = useState("Pix");
  const [podiumModalOpen, setPodiumModalOpen] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);

  const refresh = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["orders"] });
  };
  const err = (e: any) => toast.error(e?.message || "Ocorreu um erro na operação.");

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
      toast.success("Item adicionado à comanda");
    },
    onError: err,
  });

  // Ação rápida de Venda Adicional / Upsell
  const addQuickItem = useMutation({
    mutationFn: async ({
      refItem,
      kind,
    }: {
      refItem: any;
      kind: "servico" | "produto";
    }) => {
      // Barbeiro padrão: o primeiro que já estiver na comanda, ou o primeiro ativo
      const currentProId =
        order?.order_items?.[0]?.professional_id || pros.find((p: any) => p.active)?.id;
      if (!currentProId) throw new Error("Nenhum profissional disponível para comissão.");

      const { error } = await db.from("order_items").insert({
        order_id: id,
        kind,
        service_id: kind === "servico" ? refItem.id : null,
        product_id: kind === "produto" ? refItem.id : null,
        professional_id: currentProId,
        description: refItem.name,
        qty: 1,
        unit_price: refItem.price,
        commission_pct: refItem.commission_pct ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("Venda adicional incluída com sucesso!");
    },
    onError: err,
  });

  const delItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await db.from("order_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.info("Item removido");
    },
    onError: err,
  });

  const close = useMutation({
    mutationFn: async (chosenMethod?: string) => {
      const finalMethod = chosenMethod || pay;
      const { error } = await db.rpc("close_order", {
        _order_id: id,
        _payment_method: finalMethod,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setPodiumModalOpen(false);
      refresh();
      qc.invalidateQueries();
      toast.success("Comanda fechada e pagamento confirmado!");
    },
    onError: err,
  });

  if (!order) return <p className="p-8 text-muted-foreground">Carregando comanda...</p>;
  const open = order.status === "aberta";
  const orderItems = Array.isArray(order.order_items) ? order.order_items : [];
  const subtotal = orderItems.reduce(
    (s: number, i: any) => s + Number(i?.qty ?? 0) * Number(i?.unit_price ?? 0),
    0,
  );
  const total = Math.max(subtotal - Number(order.discount ?? 0), 0);
  const proName = (pid: string) => pros.find((p: any) => p.id === pid)?.name ?? "—";
  const clientName = clients.find((c: any) => c.id === order.client_id)?.name ?? "Cliente Avulso";

  const catalog =
    item.kind === "servico"
      ? services.filter((s: any) => s.active)
      : products.filter((p: any) => p.for_sale && p.active);

  // Produtos e serviços complementares sugeridos para Upsell rápido
  const suggestedProducts = products.filter((p: any) => p.for_sale && p.active).slice(0, 4);
  const suggestedServices = services
    .filter((s: any) => s.active && !orderItems.some((oi: any) => oi.service_id === s.id))
    .slice(0, 3);

  // Cálculo de Split de Pagamento Podium Pay em tempo real
  const splitItems = useMemo(() => {
    return orderItems.map((i: any) => ({
      professional_id: i.professional_id,
      professional_name: proName(i.professional_id),
      qty: Number(i.qty || 0),
      unit_price: Number(i.unit_price || 0),
      commission_pct: Number(i.commission_pct || 0),
    }));
  }, [orderItems, pros]);

  const paymentSplit = useMemo(() => {
    return calculatePaymentSplit(splitItems, total, pay, loadPodiumPayRates());
  }, [splitItems, total, pay]);

  const pixPayload = useMemo(() => {
    return generatePodiumPixPayload({
      orderId: order.number || order.id,
      amount: total,
      clientName,
      description: `Comanda #${order.number} Belezi`,
    });
  }, [order, total, clientName]);

  const handleCopyPix = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(pixPayload.pixCode);
      setCopiedPix(true);
      toast.success("Código Pix Copia e Cola copiado!");
      setTimeout(() => setCopiedPix(false), 2500);
    }
  };

  return (
    <div className="max-w-5xl space-y-4 pb-12">
      <Link
        to="/comandas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Comandas
      </Link>
      <PageHeader
        title={`Comanda #${order.number}`}
        subtitle={`Aberta em ${fmtDate(order.opened_at)} às ${fmtTime(order.opened_at)}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge className="capitalize" variant={open ? "default" : "secondary"}>
              {order.status}
              {order.payment_method ? ` · ${order.payment_method}` : ""}
            </Badge>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* Identificação do Cliente */}
          <div className="max-w-sm rounded-lg border bg-card p-3 shadow-xs">
            {open ? (
              <Pick
                label="Cliente do Atendimento"
                value={order.client_id}
                onChange={(v) => update.mutate({ client_id: v })}
                items={clients}
              />
            ) : (
              <p className="text-sm">
                Cliente: <strong>{clientName}</strong>
              </p>
            )}
          </div>

          {/* MÓDULO DE SERVIÇOS COMPLEMENTARES E VENDA ADICIONAL RÁPIDA (ETAPA 13) */}
          {open && (
            <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/[0.02] to-transparent p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Venda Adicional & Cross-Sell Rápido
                </span>
                <span className="text-[11px] text-muted-foreground">Adicione com 1 clique</span>
              </div>

              {/* Sugestões de Produtos extras */}
              {suggestedProducts.length > 0 && (
                <div className="mb-2.5">
                  <span className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
                    Produtos em Estoque:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedProducts.map((p: any) => (
                      <Button
                        key={p.id}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs bg-card hover:bg-primary/10 hover:text-primary hover:border-primary/40 gap-1.5"
                        onClick={() => addQuickItem.mutate({ refItem: p, kind: "produto" })}
                        disabled={addQuickItem.isPending}
                      >
                        <Plus className="h-3 w-3" />
                        <span>{p.name}</span>
                        <strong className="text-foreground">{brl(p.price)}</strong>
                        <span className="text-[10px] text-muted-foreground">
                          ({p.stock ?? 0} un)
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sugestões de Serviços extras */}
              {suggestedServices.length > 0 && (
                <div>
                  <span className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
                    Serviços Complementares:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedServices.map((s: any) => (
                      <Button
                        key={s.id}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs bg-card hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/40 gap-1.5"
                        onClick={() => addQuickItem.mutate({ refItem: s, kind: "servico" })}
                        disabled={addQuickItem.isPending}
                      >
                        <Zap className="h-3 w-3 text-emerald-500" />
                        <span>{s.name}</span>
                        <strong className="text-foreground">{brl(s.price)}</strong>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Adicionar Item Manual */}
          {open && (
            <div className="rounded-lg border bg-card p-4">
              <p className="mb-3 text-sm font-semibold">Adicionar item manual</p>
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
                  items={catalog.map((c: any) => ({
                    ...c,
                    name: `${c.name} · ${brl(c.price)}${c.stock !== undefined ? ` (${c.stock} em estoque)` : ""}`,
                  }))}
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

          {/* Tabela de Itens e Comissões Calculadas em Tempo Real */}
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
                {orderItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum item adicionado ainda. Use as sugestões rápidas acima.
                    </td>
                  </tr>
                )}
                {orderItems.map((i: any) => {
                  const t = Number(i.qty) * Number(i.unit_price);
                  return (
                    <tr key={i.id} className="border-b last:border-0">
                      <td data-label="Item" className="px-4 py-3">
                        <span className="font-medium">{i.description}</span>{" "}
                        <Badge
                          variant="outline"
                          className={`ml-1 text-[10px] ${i.kind === "produto" ? "border-amber-500/40 text-amber-600" : ""}`}
                        >
                          {i.kind}
                        </Badge>
                      </td>
                      <td data-label="Profissional" className="px-4 py-3">
                        {proName(i.professional_id)}
                      </td>
                      <td data-label="Qtd" className="px-4 py-3 text-right">
                        {Number(i.qty)}
                      </td>
                      <td data-label="Total" className="px-4 py-3 text-right font-medium">
                        {brl(t)}
                      </td>
                      <td
                        data-label="Comissão"
                        className="px-4 py-3 text-right text-muted-foreground"
                      >
                        <span className="font-semibold text-foreground">
                          {brl((t * Number(i.commission_pct)) / 100)}
                        </span>{" "}
                        <span className="text-xs">({Number(i.commission_pct)}%)</span>
                      </td>
                      <td data-label="Ações" className="px-2 text-right">
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

        {/* Barra Lateral: Total, Desconto e Fechamento com PODIUM PAY */}
        <aside className="h-fit space-y-4 rounded-lg border bg-card p-5 shadow-xs">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">{brl(subtotal)}</span>
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

          <div className="flex justify-between border-t pt-3 font-display text-xl font-bold">
            <span>Total a Pagar</span>
            <span className="text-primary">{brl(open ? total : order.total)}</span>
          </div>

          {open && (
            <>
              {/* Botão de Cobrança Online PODIUM PAY */}
              <div className="rounded-lg border border-[#FF6500]/30 bg-[#FF6500]/5 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#FF6500] flex items-center gap-1.5">
                    <QrCode className="h-4 w-4" /> Podium Pay Online
                  </span>
                  <Badge variant="outline" className="border-[#FF6500]/40 text-[#FF6500] text-[10px]">
                    Pix & Split
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mb-3">
                  Gere o QR Code Pix instantâneo para o cliente e divida recebíveis automaticamente.
                </p>
                <Button
                  className="w-full bg-[#FF6500] hover:bg-[#E55B00] text-white gap-2 text-xs font-semibold shadow-sm"
                  disabled={!orderItems.length}
                  onClick={() => setPodiumModalOpen(true)}
                >
                  <QrCode className="h-4 w-4" /> Cobrança Podium Pay (Pix/Cartão)
                </Button>
              </div>

              {/* Fechamento Padrão de Caixa */}
              <div>
                <Label className="mb-1.5 block text-xs">Forma de Pagamento</Label>
                <Select value={pay} onValueChange={setPay}>
                  <SelectTrigger className="h-9">
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
                disabled={!orderItems.length || close.isPending}
                onClick={() => close.mutate(pay)}
              >
                Fechar Comanda no Caixa
              </Button>

              <Button
                variant="ghost"
                className="w-full text-destructive text-xs hover:bg-destructive/10"
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

      {/* MODAL PODIUM PAY: RECEBIMENTO ONLINE E SPLIT DE RECEBÍVEIS */}
      <Dialog open={podiumModalOpen} onOpenChange={setPodiumModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF6500]/10 text-[#FF6500]">
                <QrCode className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base">Podium Pay — Cobrança & Split</DialogTitle>
                <DialogDescription className="text-xs">
                  Comanda #{order.number} · {clientName}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Valor e QR Code Pix */}
            <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-4 text-center">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Valor Total</span>
              <p className="font-display text-3xl font-black text-foreground mt-0.5">{brl(total)}</p>

              <div className="mt-3 p-2 rounded-lg bg-white shadow-sm border border-border/80">
                <img
                  src={pixPayload.qrCodeUrl}
                  alt="QR Code Pix"
                  className="h-44 w-44 object-contain"
                />
              </div>

              <div className="mt-3 w-full flex items-center gap-2">
                <Input
                  readOnly
                  value={pixPayload.pixCode}
                  className="h-8 text-[11px] font-mono bg-muted/40 truncate"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 shrink-0 text-xs"
                  onClick={handleCopyPix}
                >
                  {copiedPix ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copiar Código
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Divisão de Recebíveis (Split de Pagamento) */}
            <div className="rounded-xl border bg-muted/20 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                <span className="flex items-center gap-1.5">
                  <Percent className="h-3.5 w-3.5 text-primary" /> Divisão de Recebíveis (Split)
                </span>
                <Badge variant="outline" className="text-[10px]">
                  Taxa Gateway: {paymentSplit.feePct}% ({brl(paymentSplit.feeAmount)})
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border bg-card p-2.5">
                  <span className="text-muted-foreground text-[10px] uppercase font-semibold flex items-center gap-1">
                    <Building2 className="h-3 w-3 text-primary" /> Salão / Barbearia
                  </span>
                  <p className="font-bold text-sm text-foreground mt-0.5">
                    {brl(paymentSplit.salonNet)}
                  </p>
                  <span className="text-[10px] text-muted-foreground">Líquido na conta</span>
                </div>

                <div className="rounded-lg border bg-card p-2.5">
                  <span className="text-muted-foreground text-[10px] uppercase font-semibold flex items-center gap-1">
                    <UserCheck className="h-3 w-3 text-emerald-500" /> Barbeiro(s)
                  </span>
                  <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {brl(
                      paymentSplit.professionals.reduce(
                        (acc: number, p: any) => acc + p.netCommission,
                        0,
                      ),
                    )}
                  </p>
                  <span className="text-[10px] text-muted-foreground">Comissão líquida</span>
                </div>
              </div>

              {/* Detalhe por profissional se houver */}
              {paymentSplit.professionals.map((pro: any) => (
                <div
                  key={pro.proId}
                  className="flex items-center justify-between text-[11px] pt-1 border-t text-muted-foreground"
                >
                  <span>{pro.proName}</span>
                  <span className="font-semibold text-foreground">{brl(pro.netCommission)}</span>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" size="sm" onClick={() => setPodiumModalOpen(false)}>
              Fechar
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold"
              disabled={close.isPending}
              onClick={() => close.mutate("Pix (Podium Pay)")}
            >
              <CheckCircle2 className="h-4 w-4" /> Confirmar Pagamento Pix & Encerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
