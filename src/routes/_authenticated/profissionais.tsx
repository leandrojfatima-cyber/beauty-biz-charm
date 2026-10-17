import { createFileRoute, Link } from "@tanstack/react-router";
import { CrudPage } from "@/components/CrudPage";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Store } from "lucide-react";

export const ROLES = [
  { value: "barbeiro_master", label: "Barbeiro Master" },
  { value: "barbeiro", label: "Barbeiro" },
  { value: "cabeleireiro", label: "Cabeleireiro(a)" },
  { value: "barboterapeuta", label: "Especialista em Barboterapia" },
  { value: "manicure", label: "Manicure" },
  { value: "esteticista", label: "Esteticista" },
  { value: "outro", label: "Outro" },
];

export const Route = createFileRoute("/_authenticated/profissionais")({
  head: () => ({
    meta: [
      { title: "Profissionais — Belezi" },
      { name: "description", content: "Gerencie profissionais do seu salão no Belezi." },
      { property: "og:title", content: "Profissionais — Belezi" },
      { property: "og:description", content: "Gerencie profissionais do seu salão no Belezi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-xs">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-primary" />
          <span>Para personalização completa com especialidades e fotos da equipe, acesse a central da barbearia.</span>
        </div>
        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
          <Link to="/salao">Central de Configurações</Link>
        </Button>
      </div>

      <CrudPage
        table="professionals"
        title="Profissionais & Barbeiros"
        subtitle="Equipe do salão com isolamento por empresa. As comissões são calculadas automaticamente."
        singular="profissional"
        fields={[
          { key: "name", label: "Nome", required: true },
          { key: "role", label: "Função / Especialidade", type: "select", options: ROLES, default: "barbeiro_master" },
          { key: "phone", label: "Telefone / WhatsApp" },
          { key: "working_hours", label: "Horários de Atendimento" },
          { key: "photo_url", label: "URL da Foto do Barbeiro" },
          { key: "active", label: "Ativo", type: "boolean" },
        ]}
        columns={[
          {
            label: "Profissional",
            render: (r) => (
              <div className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8 border">
                  <AvatarImage src={r.photo_url || ""} />
                  <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                    {r.name?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <span className="font-semibold block">{r.name}</span>
                  {r.working_hours && (
                    <span className="text-[11px] text-muted-foreground block">{r.working_hours}</span>
                  )}
                </div>
              </div>
            ),
          },
          { label: "Função", render: (r) => ROLES.find((x) => x.value === r.role)?.label ?? r.role },
          { label: "Telefone", render: (r) => r.phone ?? "—" },
          {
            label: "Status",
            render: (r) => (
              <Badge variant={r.active ? "default" : "secondary"}>
                {r.active ? "Ativo" : "Inativo"}
              </Badge>
            ),
          },
        ]}
      />
    </div>
  ),
});
