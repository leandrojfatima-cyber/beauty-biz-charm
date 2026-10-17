import { createFileRoute, Link } from "@tanstack/react-router";
import { CrudPage } from "@/components/CrudPage";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Crown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes & Clube VIP — Belezi" },
      { name: "description", content: "Gerencie clientes do seu salão e membros do Clube VIP no Belezi." },
      { property: "og:title", content: "Clientes & Clube VIP — Belezi" },
      { property: "og:description", content: "Gerencie clientes do seu salão e membros do Clube VIP no Belezi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <CrudPage
      table="clients"
      title="Clientes"
      subtitle="Base de clientes e assinantes de planos VIP da barbearia"
      singular="cliente"
      fields={[
        { key: "name", label: "Nome", required: true },
        { key: "phone", label: "Telefone / WhatsApp" },
        { key: "is_vip", label: "Cliente VIP / Assinante de Clube", type: "boolean", default: false },
        {
          key: "vip_plan_name",
          label: "Plano Vinculado",
          type: "select",
          options: [
            { value: "Nenhum", label: "Nenhum / Cliente Padrão" },
            { value: "Plano One (1 Corte/mês)", label: "Plano One (1 Corte/mês)" },
            { value: "VIP Club Ouro (Cortes Ilimitados)", label: "VIP Club Ouro (Cortes Ilimitados)" },
            { value: "VIP Black Executive (Cabelo + Barba)", label: "VIP Black Executive (Cabelo + Barba)" },
            { value: "Clube da Barba Premium", label: "Clube da Barba Premium" },
            { value: "Recorrente 4x (4 Atendimentos)", label: "Recorrente 4x (4 Atendimentos)" },
          ],
        },
        { key: "notes", label: "Observações", type: "textarea" },
      ]}
      columns={[
        {
          label: "Nome",
          render: (r) => (
            <div className="flex items-center gap-2">
              <span className="font-medium">{r.name}</span>
              {r.is_vip && (
                <Badge className="bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0 flex items-center gap-0.5">
                  <Sparkles className="h-2.5 w-2.5" /> VIP
                </Badge>
              )}
            </div>
          ),
        },
        { label: "Telefone", render: (r) => r.phone ?? "—" },
        {
          label: "Plano do Clube",
          render: (r) =>
            r.is_vip ? (
              <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                {r.vip_plan_name || "Membro VIP"}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Padrão</span>
            ),
        },
        {
          label: "Gestão do Plano",
          render: (r) => (
            <Link
              to="/planos-assinaturas"
              className="text-primary hover:underline text-xs inline-flex items-center gap-1 font-medium"
            >
              <Crown className="h-3 w-3 text-amber-500" />
              <span>{r.is_vip ? "Franquia & Créditos" : "Vincular Assinatura"}</span>
            </Link>
          ),
        },
        {
          label: "Observações",
          render: (r) => <span className="text-muted-foreground text-xs">{r.notes ?? ""}</span>,
        },
      ]}
    />
  ),
});
