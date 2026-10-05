import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/CrudPage";
import { brl } from "@/lib/db";

const CATS = [
  { value: "cabelo", label: "Cabelo" },
  { value: "unhas", label: "Unhas" },
  { value: "estetica", label: "Estética" },
  { value: "outro", label: "Outro" },
];

export const Route = createFileRoute("/_authenticated/servicos")({
  head: () => ({ meta: [{ title: "Serviços — Belezi" }, { name: "description", content: "Gerencie serviços do seu salão no Belezi." }, { property: "og:title", content: "Serviços — Belezi" }, { property: "og:description", content: "Gerencie serviços do seu salão no Belezi." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => (
    <CrudPage table="services" title="Serviços" subtitle="Preço, duração e comissão de cada serviço." singular="serviço"
      fields={[
        { key: "name", label: "Nome", required: true },
        { key: "category", label: "Categoria", type: "select", options: CATS, default: "cabelo" },
        { key: "price", label: "Preço (R$)", type: "number" },
        { key: "duration_min", label: "Duração (min)", type: "number", default: 60 },
        { key: "commission_pct", label: "Comissão (%)", type: "number" },
        { key: "active", label: "Ativo", type: "boolean" },
      ]}
      columns={[
        { label: "Serviço", render: (r) => <span className="font-medium">{r.name}</span> },
        { label: "Categoria", render: (r) => CATS.find((c) => c.value === r.category)?.label ?? r.category },
        { label: "Duração", render: (r) => `${r.duration_min} min` },
        { label: "Preço", render: (r) => brl(r.price), className: "text-right" },
        { label: "Comissão", render: (r) => `${Number(r.commission_pct)}%`, className: "text-right" },
      ]}
    />
  ),
});
