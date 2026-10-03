import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/CrudPage";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Belezi" }] }),
  component: () => (
    <CrudPage table="clients" title="Clientes" singular="cliente"
      fields={[
        { key: "name", label: "Nome", required: true },
        { key: "phone", label: "Telefone" },
        { key: "notes", label: "Observações", type: "textarea" },
      ]}
      columns={[
        { label: "Nome", render: (r) => <span className="font-medium">{r.name}</span> },
        { label: "Telefone", render: (r) => r.phone ?? "—" },
        { label: "Observações", render: (r) => <span className="text-muted-foreground">{r.notes ?? ""}</span> },
      ]}
    />
  ),
});
