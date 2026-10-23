import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { logAudit } from "@/lib/audit";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  Receipt,
  Users,
  Scissors,
  Package,
  Wallet,
  Percent,
  UserRound,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Store,
  Smartphone,
  Crown,
  MessageCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { checkIsMaster } from "@/lib/master-auth";

const nav = [
  { to: "/painel", label: "Painel", icon: LayoutDashboard },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/comandas", label: "Comandas", icon: Receipt },
  { to: "/clientes", label: "Clientes", icon: UserRound },
  { to: "/planos-assinaturas", label: "Clube & Assinaturas", icon: Crown },
  { to: "/automacoes", label: "Automações & WhatsApp", icon: MessageCircle },
  { to: "/profissionais", label: "Profissionais", icon: Users },
  { to: "/servicos", label: "Serviços", icon: Scissors },
  { to: "/produtos", label: "Produtos e estoque", icon: Package },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/comissoes", label: "Comissões", icon: Percent },
  { to: "/salao", label: "Configuração da Barbearia", icon: Store },
  { to: "/agendar", label: "App do Cliente (PWA)", icon: Smartphone, highlight: true },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: isMaster } = useQuery({
    queryKey: ["is-master"],
    queryFn: checkIsMaster,
    staleTime: 30000,
  });

  async function signOut() {
    try {
      await logAudit("Saiu do sistema");
    } catch {
      // audit failure ignored
    }
    try {
      localStorage.removeItem("belezi_preview_authenticated");
      localStorage.removeItem("belezi_preview_user");
      localStorage.removeItem("nexadash_master_authenticated");
    } catch {
      // localStorage failure ignored
    }
    await qc.cancelQueries().catch(() => {});
    qc.clear();
    await supabase.auth.signOut().catch(() => {});
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="app-shell min-h-screen bg-background md:flex">
      {/* Header Mobile com navegação e botão de menu */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-sidebar px-4 py-3 text-sidebar-foreground md:hidden shadow-xs">
        <div className="flex items-center gap-2.5">
          <img
            src="/assets/aistudio/avatar_9eef1d34.png"
            alt="NEXADASH — Sistemas Inteligentes"
            className="h-8 w-8 rounded-lg object-contain bg-white p-0.5 shrink-0 shadow-xs"
          />
          <div>
            <span className="font-display text-sm font-black tracking-wide text-sidebar-accent-foreground block leading-tight">
              NEXA<span className="text-[#FF6500]">DASH</span>
            </span>
            <span className="text-[10px] text-sidebar-foreground/70 font-semibold block leading-tight">
              Módulo Barbearia · Belezi
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
          aria-expanded={open}
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {open ? <X className="h-5 w-5 text-[#FF6500]" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>

      {/* Barra Lateral com rolagem controlada, sem cortes de tela */}
      <aside
        className={cn(
          "w-full shrink-0 flex-col bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:flex md:h-screen md:max-h-screen md:w-64 border-r border-sidebar-border/40 select-none z-30 transition-all",
          open ? "flex max-h-[calc(100dvh-3.75rem)]" : "hidden md:flex",
        )}
      >
        {/* Topo Institucional Fixo */}
        <div className="shrink-0 hidden px-5 py-4 md:block border-b border-sidebar-border/40">
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/avatar_9eef1d34.png"
              alt="NEXADASH — Sistemas Inteligentes"
              className="h-10 w-10 rounded-xl object-contain bg-white p-1 shadow-sm border border-white/20 shrink-0"
            />
            <div className="min-w-0">
              <span className="font-display text-base font-extrabold tracking-wide text-sidebar-accent-foreground block truncate leading-tight">
                NEXA<span className="text-[#FF6500]">DASH</span>
              </span>
              <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/70 font-semibold truncate leading-tight mt-0.5">
                Sistemas Inteligentes
              </p>
            </div>
          </div>
          <div className="mt-3 rounded-md bg-sidebar-accent/60 px-2.5 py-1 text-[11px] text-sidebar-foreground/90 flex items-center justify-between border border-sidebar-border/30">
            <span className="font-medium">Módulo Barbearia</span>
            <span className="text-[10px] text-[#FF6500] font-bold">BELEZI</span>
          </div>
        </div>

        {/* Lista de Navegação com Rolagem Suave (sidebar-scroll) */}
        <nav
          className="sidebar-scroll flex-1 min-h-0 px-2.5 py-2.5 space-y-1 overscroll-contain"
          aria-label="Navegação Principal"
        >
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/40">
            Operação & Atendimento
          </div>
          {nav.slice(0, 4).map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs md:text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/90"
              activeProps={{
                className:
                  "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs [&>svg]:text-primary",
              }}
            >
              <Icon className="h-4 w-4 shrink-0 text-sidebar-foreground/70" />
              <span className="truncate">{label}</span>
            </Link>
          ))}

          <div className="pt-2 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/40">
            Crescimento & Gestão
          </div>
          {nav.slice(4, 9).map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs md:text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/90"
              activeProps={{
                className:
                  "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs [&>svg]:text-primary",
              }}
            >
              <Icon className="h-4 w-4 shrink-0 text-sidebar-foreground/70" />
              <span className="truncate">{label}</span>
            </Link>
          ))}

          <div className="pt-2 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/40">
            Finanças & Barbearia
          </div>
          {nav.slice(9).map((item) => {
            const Icon = item.icon;
            const isPWA = "highlight" in item && item.highlight;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-xs md:text-sm font-medium transition-colors text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isPWA && "border border-primary/20 bg-primary/5 hover:bg-primary/10",
                )}
                activeProps={{
                  className:
                    "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs [&>svg]:text-primary",
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={cn("h-4 w-4 shrink-0", isPWA ? "text-primary" : "text-sidebar-foreground/70")} />
                  <span className="truncate">{item.label}</span>
                </div>
                {isPWA && (
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                    App
                  </span>
                )}
              </Link>
            );
          })}

          {/* PAINEL MASTER NEXADASH — ESTRITAMENTE EXCLUSIVO PARA O ADMINISTRADOR MASTER (LEANDRO) */}
          {Boolean(isMaster) && (
            <div className="pt-3 border-t border-sidebar-border/30 mt-2" data-master-only="true">
              <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#FF8C38] flex items-center justify-between">
                <span>Governança Geral</span>
                <span className="text-[9px] bg-[#FF6500]/20 text-[#FF6500] px-1.5 py-0.5 rounded font-mono font-bold">
                  EXCLUSIVO MASTER
                </span>
              </div>
              <Link
                to="/master"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-xs md:text-sm font-bold transition-all text-white bg-gradient-to-r from-[#0B192C] to-[#1E3E62] border border-[#FF6500]/50 hover:border-[#FF6500] hover:shadow-md hover:shadow-[#FF6500]/10 shadow-xs group"
                activeProps={{
                  className: "bg-gradient-to-r from-[#FF6500] to-[#E55B00] text-white border-[#FF6500] shadow-sm [&>div>svg]:text-white",
                }}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-[#FF6500] group-hover:scale-110 transition-transform" />
                  <div className="truncate text-left leading-tight">
                    <span className="truncate block font-bold text-xs text-white">Painel Master NEXADASH</span>
                    <span className="text-[9px] text-white/70 font-mono block font-normal">Exclusivo Leandro (Admin)</span>
                  </div>
                </div>
                <span className="text-[8px] bg-[#FF6500] text-white px-1.5 py-0.5 rounded uppercase font-mono font-bold tracking-wider shrink-0">
                  Restrito
                </span>
              </Link>
            </div>
          )}
        </nav>

        {/* Rodapé Fixo da Barra Lateral */}
        <div className="shrink-0 border-t border-sidebar-border/30 p-2.5 md:p-3 bg-sidebar/50">
          <Button
            variant="ghost"
            onClick={signOut}
            className="w-full justify-start gap-3 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-xs md:text-sm font-medium h-9 px-3 rounded-lg"
          >
            <LogOut className="h-4 w-4 shrink-0 text-rose-400" />
            <span>Sair do Sistema</span>
          </Button>
          <div className="mt-2 flex items-center justify-between px-2 text-[10px] text-sidebar-foreground/50">
            <div className="flex items-center gap-1.5 truncate">
              <img
                src="/assets/aistudio/avatar_9eef1d34.png"
                alt="NEXADASH"
                className="h-3.5 w-3.5 rounded-xs object-contain bg-white/90 p-0.5 shrink-0"
              />
              <span className="truncate">NEXADASH v2.4</span>
            </div>
            <span className="shrink-0 text-emerald-400 font-mono text-[9px] flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" /> Online
            </span>
          </div>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="min-w-0 flex-1 p-3 md:p-6 lg:p-8 overflow-x-hidden">{children}</main>
    </div>
  );
}


export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header mb-3 grid min-w-0 gap-2 sm:mb-6 sm:flex sm:flex-wrap sm:items-end sm:justify-between sm:gap-3">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold sm:text-2xl">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && (
        <div className="page-actions grid min-w-0 grid-cols-2 items-center gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}

export function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "destructive" | "primary";
}) {
  return (
    <div className="stat min-w-0 rounded-lg border bg-card p-2 sm:p-4">
      <p className="text-[10px] uppercase text-muted-foreground sm:text-xs">{label}</p>
      <p
        className={cn(
          "mt-1 break-words font-display text-base font-semibold sm:text-2xl",
          tone === "success" && "text-success",
          tone === "destructive" && "text-destructive",
          tone === "primary" && "text-primary",
        )}
      >
        {value}
      </p>
    </div>
  );
}
