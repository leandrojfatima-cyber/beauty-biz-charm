import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDownUp } from "lucide-react";
import { toast } from "sonner";
import { CrudPage } from "@/components/CrudPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl, db } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({ meta: [{ title: "Produtos e estoque — Belezi" }, { name: "description", content: "Gerencie produtos e estoque do seu salão no Belezi." }, { property: "og:title", content: "Produtos e estoque — Belezi" }, { property: "og:description", content: "Gerencie produtos e estoque do seu salão no Belezi." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ProdutosPage,
});

const TYPES = [
  { value: "entrada", label: "Entrada (compra)", sign: 1 },
  { value: "uso", label: "Uso interno", sign: -1 },
  { value: "ajuste", label: "Ajuste / perda", sign: -1 },
];

function ProdutosPage() {
  const qc = useQueryClient();
  const [mov, setMov] = useState<{ product: any; type: string; qty: string; note: string; cost: boolean } | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      const t = TYPES.find((x) => x.value === mov!.type)!;
      const qty = Number(mov!.qty) * t.sign;
      const { error } = await db.from("stock_movements").insert({ product_id: mov!.product.id, qty, type: t.value, note: mov!.note || null });
      if (error) throw error;
      if (t.value === "entrada" && mov!.cost) {
        const amount = Number(mov!.qty) * Number(mov!.product.cost);
        if (amount > 0) {
          const { error: e2 } = await db.from("transactions").insert({ type: "despesa", category: "produtos", description: `Compra: ${mov!.product.name}`, amount });
          if (e2) throw e2;
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries(); setMov(null); toast.success("Estoque atualizado"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <CrudPage table="products" title="Produtos e estoque" subtitle="Catálogo para uso interno e venda. Vendas em comandas baixam o estoque automaticamente." singular="produto"
        fields={[
          { key: "name", label: "Nome", required: true },
          { key: "sku", label: "Código" },
          { key: "price", label: "Preço de venda (R$)", type: "number" },
          { key: "cost", label: "Custo (R$)", type: "number" },
          { key: "stock", label: "Estoque atual", type: "number" },
          { key: "min_stock", label: "Estoque mínimo", type: "number" },
          { key: "commission_pct", label: "Comissão na venda (%)", type: "number" },
          { key: "for_sale", label: "Disponível para venda (desligado = só uso interno)", type: "boolean" },
        ]}
        columns={[
          { label: "Produto", render: (r) => <div><span className="font-medium">{r.name}</span>{r.sku && <span className="ml-2 text-xs text-muted-foreground">{r.sku}</span>}</div> },
          { label: "Tipo", render: (r) => <Badge variant="outline">{r.for_sale ? "Venda" : "Uso interno"}</Badge> },
          { label: "Estoque", render: (r) => (
            <span className={Number(r.stock) <= Number(r.min_stock) ? "font-semibold text-destructive" : ""}>
              {Number(r.stock)}{Number(r.stock) <= Number(r.min_stock) && " · baixo"}
            </span>) },
          { label: "Custo", render: (r) => brl(r.cost), className: "text-right" },
          { label: "Venda", render: (r) => brl(r.price), className: "text-right" },
          { label: "Comissão", render: (r) => `${Number(r.commission_pct)}%`, className: "text-right" },
        ]}
        extraActions={(r) => (
          <Button size="sm" variant="outline" className="mr-1" onClick={() => setMov({ product: r, type: "entrada", qty: "1", note: "", cost: true })}>
            <ArrowDownUp className="mr-1 h-3.5 w-3.5" /> Movimentar
          </Button>
        )}
      />
      <Dialog open={!!mov} onOpenChange={(o) => !o && setMov(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Movimentar estoque — {mov?.product.name}</DialogTitle></DialogHeader>
          {mov && (
            <div className="grid gap-4">
              <div><Label className="mb-1.5 block">Tipo</Label>
                <Select value={mov.type} onValueChange={(v) => setMov({ ...mov, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label className="mb-1.5 block">Quantidade</Label><Input type="number" step="0.01" value={mov.qty} onChange={(e) => setMov({ ...mov, qty: e.target.value })} /></div>
              <div><Label className="mb-1.5 block">Observação</Label><Input value={mov.note} onChange={(e) => setMov({ ...mov, note: e.target.value })} /></div>
              {mov.type === "entrada" && (
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mov.cost} onChange={(e) => setMov({ ...mov, cost: e.target.checked })} />
                  Lançar despesa de {brl(Number(mov.qty) * Number(mov.product.cost))} no financeiro</label>
              )}
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setMov(null)}>Cancelar</Button><Button onClick={() => save.mutate()} disabled={save.isPending}>Confirmar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
