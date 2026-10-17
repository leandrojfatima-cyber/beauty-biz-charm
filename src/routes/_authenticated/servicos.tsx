import { createFileRoute, Link } from "@tanstack/react-router";
import { CrudPage } from "@/components/CrudPage";
import { brl } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Store } from "lucide-react";

const CATS = [
  { value: "cabelo", label: "Cabelo" },
  { value: "barba", label: "Barba" },
  { value: "combo", label: "Combos & Barboterapia" },
  { value: "estetica", label: "Estética & Tratamentos" },
  { value: "infantil", label: "Infantil" },
  { value: "outro", label: "Outro" },
];

export const Route = createFileRoute("/_authenticated/servicos")({
  head: () => ({
    meta: [
      { title: "Serviços — Belezi" },
      { name: "description", content: "Gerencie serviços do seu salão no Belezi." },
      { property: "og:title", content: "Serviços — Belezi" },
      { property: "og:description", content: "Gerencie serviços do seu salão no Belezi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-xs">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-primary" />
          <span>Para personalização completa da vitrine, serviços em destaque e regras de agendamento, acesse a central da barbearia.</span>
        </div>
        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
          <Link to="/salao">Central de Configurações</Link>
        </Button>
      </div>

      <CrudPage
        table="services"
        title="Catálogo de Serviços"
        subtitle="Preço, tempo de cadeira e comissão de cada serviço isolados por salon_id."
        singular="serviço"
        fields={[
          { key: "name", label: "Nome do Serviço", required: true },
          { key: "category", label: "Categoria", type: "select", options: CATS, default: "cabelo" },
          { key: "description", label: "Descrição do Procedimento", type: "textarea" },
          { key: "price", label: "Preço (R$)", type: "number" },
          { key: "duration_min", label: "Duração (minutos)", type: "number", default: 45 },
          { key: "commission_pct", label: "Comissão (%)", type: "number", default: 50 },
          { key: "highlight", label: "Destaque no Catálogo", type: "boolean" },
          { key: "active", label: "Ativo", type: "boolean" },
        ]}
        columns={[
          {
            label: "Serviço",
            render: (r) => (
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold">{r.name}</span>
                  {r.highlight && (
                    <Badge variant="outline" className="text-[9px] text-amber-500 border-amber-500/40">
                      <Star className="h-2.5 w-2.5 fill-amber-500 mr-0.5 inline" /> Destaque
                    </Badge>
                  )}
                </div>
                {r.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-1">{r.description}</p>
                )}
              </div>
            ),
          },
          {
            label: "Categoria",
            render: (r) => CATS.find((c) => c.value === r.category)?.label ?? r.category,
          },
          { label: "Duração", render: (r) => `${r.duration_min} min` },
          { label: "Preço", render: (r) => brl(r.price), className: "text-right font-medium" },
          {
            label: "Comissão",
            render: (r) => `${Number(r.commission_pct)}%`,
            className: "text-right",
          },
        ]}
      />
    </div>
  ),
});
