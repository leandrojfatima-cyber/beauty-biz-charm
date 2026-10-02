import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/CrudPage";
import { Badge } from "@/components/ui/badge";

export const ROLES = [
  { value: "cabeleireiro", label: "Cabeleireiro(a)" },
  { value: "manicure", label: "Manicure" },
  { value: "esteticista", label: "Esteticista" },
  { value: "outro", label: "Outro" },
];

export const Route = createFileRoute("/_authenticated/profissionais")({
  head: () => ({ meta: [{ title: "Profissionais — Salão" }] }),
  component: () => (
    <CrudPage table="professionals" title="Profissionais" subtitle="Equipe do salão. As comissões são definidas em cada serviço e produto." singular="profissional"
      fields={[
        { key: "name", label: "Nome", required: true },
        { key: "role", label: "Função", type: "select", options: ROLES, default: "cabeleireiro" },
        { key: "phone", label: "Telefone" },
        { key: "active", label: "Ativo", type: "boolean" },
      ]}
      columns={[
        { label: "Nome", render: (r) => <span className="font-medium">{r.name}</span> },
        { label: "Função", render: (r) => ROLES.find((x) => x.value === r.role)?.label ?? r.role },
        { label: "Telefone", render: (r) => r.phone ?? "—" },
        { label: "Status", render: (r) => <Badge variant={r.active ? "default" : "secondary"}>{r.active ? "Ativo" : "Inativo"}</Badge> },
      ]}
    />
  ),
});
