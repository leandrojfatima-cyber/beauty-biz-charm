import { createFileRoute, Link } from "@tanstack/react-router";
import { CrudPage } from "@/components/CrudPage";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Crown, Cake, MessageCircle, AlertTriangle, Lock } from "lucide-react";
import { generateWhatsAppUrl } from "@/lib/automation-engine";
import { fmtDate } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes & Clube VIP — Belezi" },
      {
        name: "description",
        content:
          "Gerencie clientes do seu salão, aniversários, faltas e membros do Clube VIP no Belezi.",
      },
    ],
  }),
  component: () => (
    <CrudPage
      table="clients"
      title="Clientes"
      subtitle="Base de clientes, datas de aniversário, controle de faltas e membros do Clube VIP"
      singular="cliente"
      fields={[
        { key: "name", label: "Nome Completo", required: true },
        { key: "phone", label: "Telefone / WhatsApp" },
        { key: "birth_date", label: "Data de Nascimento (Aniversário)", type: "text" },
        {
          key: "is_vip",
          label: "Cliente VIP / Assinante de Clube",
          type: "boolean",
          default: false,
        },
        {
          key: "vip_plan_name",
          label: "Plano Vinculado",
          type: "select",
          options: [
            { value: "Nenhum", label: "Nenhum / Cliente Padrão" },
            { value: "Plano One (1 Corte/mês)", label: "Plano One (1 Corte/mês)" },
            {
              value: "VIP Club Ouro (Cortes Ilimitados)",
              label: "VIP Club Ouro (Cortes Ilimitados)",
            },
            {
              value: "VIP Black Executive (Cabelo + Barba)",
              label: "VIP Black Executive (Cabelo + Barba)",
            },
            { value: "Clube da Barba Premium", label: "Clube da Barba Premium" },
            { value: "Recorrente 4x (4 Atendimentos)", label: "Recorrente 4x (4 Atendimentos)" },
          ],
        },
        {
          key: "is_blocked_booking",
          label: "Bloquear Agendamentos Online (Penalidade por Faltas)",
          type: "boolean",
          default: false,
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
              {r.is_blocked_booking && (
                <Badge className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0 flex items-center gap-0.5">
                  <Lock className="h-2.5 w-2.5" /> Bloqueado
                </Badge>
              )}
            </div>
          ),
        },
        {
          label: "WhatsApp",
          render: (r) =>
            r?.phone ? (
              <a
                href={generateWhatsAppUrl(
                  r.phone,
                  `Olá, ${String(r?.name || "Cliente").split(" ")[0]}! Mensagem da barbearia.`,
                )}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-600 hover:underline flex items-center gap-1 font-medium"
              >
                <MessageCircle className="h-3 w-3" />
                {r.phone}
              </a>
            ) : (
              <span className="text-muted-foreground text-xs">—</span>
            ),
        },
        {
          label: "Aniversário",
          render: (r) =>
            r?.birth_date ? (
              <span className="text-xs flex items-center gap-1 text-muted-foreground">
                <Cake className="h-3 w-3 text-pink-500" />
                {fmtDate(r.birth_date)}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            ),
        },
        {
          label: "Faltas (No-Show)",
          render: (r) =>
            Number(r?.no_shows_count ?? 0) > 0 ? (
              <Badge className="bg-rose-500/15 text-rose-700 border-rose-500/30 text-xs">
                {r.no_shows_count} falta(s)
              </Badge>
            ) : (
              <span className="text-xs text-emerald-600 font-medium">0 faltas</span>
            ),
        },
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
      ]}
    />
  ),
});
