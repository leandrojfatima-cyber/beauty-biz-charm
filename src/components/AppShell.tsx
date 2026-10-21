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
  { to: "/agendar", label: "App do Cliente (PWA)", icon: Smartphone },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: isMaster } = useQuery({
    queryKey: ["is-master"],
    queryFn: async () => {
      try {
        const { data } = await (supabase as any).rpc("claim_master");
        return data !== false;
      } catch {
        return true;
      }
    },
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
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center border-b bg-sidebar px-3 py-2 text-sidebar-foreground md:hidden">
        <div className="flex items-center gap-2">
          <img
            src="/assets/aistudio/avatar_9eef1d34.png"
            alt="NEXADASH — Sistemas Inteligentes"
            className="h-7 w-7 rounded-md object-contain bg-white p-0.5 shrink-0 shadow-xs"
          />
          <span className="font-display text-sm font-bold text-sidebar-accent-foreground">
            NEXA<span className="text-[#FF6500]">DASH</span>
            <span className="text-xs font-normal text-sidebar-foreground/60 ml-1.5">· Belezi</span>
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
          aria-expanded={open}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </header>
      <aside
        className={cn(
          "w-full shrink-0 flex-col bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:flex md:h-screen md:w-60",
          open ? "flex" : "hidden",
        )}
      >
        <div className="hidden px-5 py-5 md:block border-b border-sidebar-border/40">
          <div className="flex items-center gap-2.5">
            <img
              src="/assets/aistudio/avatar_9eef1d34.png"
              alt="NEXADASH — Sistemas Inteligentes"
              className="h-10 w-10 rounded-xl object-contain bg-white p-0.5 shadow-sm border border-white/20 shrink-0"
            />
            <div className="min-w-0">
              <span className="font-display text-base font-extrabold tracking-wide text-sidebar-accent-foreground block truncate">
                NEXA<span className="text-[#FF6500]">DASH</span>
              </span>
              <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/70 font-semibold truncate">
                Sistemas Inteligentes
              </p>
            </div>
          </div>
          <div className="mt-3 rounded-md bg-sidebar-accent/50 px-2.5 py-1 text-[11px] text-sidebar-foreground/80 flex items-center justify-between">
            <span className="font-medium">Módulo Barbearia</span>
            <span className="text-[10px] text-primary font-bold">BELEZI</span>
          </div>
        </div>
        <nav className="grid flex-1 grid-cols-2 gap-0.5 px-2 py-1 md:block md:space-y-0.5 md:px-3 md:py-2">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{
                className:
                  "bg-sidebar-accent text-sidebar-accent-foreground [&>svg]:text-sidebar-primary",
              }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          {isMaster && (
            <Link
              to="/master"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-[#FF8C38] font-medium"
              activeProps={{
                className:
                  "bg-sidebar-accent text-[#FF8C38] [&>svg]:text-[#FF6500]",
              }}
            >
              <ShieldCheck className="h-4 w-4 text-[#FF6500]" />
              Painel NEXADASH
            </Link>
          )}
        </nav>
        <Button
          variant="ghost"
          onClick={signOut}
          className="m-2 justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:m-3"
        >
          <LogOut className="h-4 w-4" /> Sair
        </Button>
        <div className="px-5 pb-4 pt-2 border-t border-sidebar-border/30">
          <div className="flex items-center gap-2 text-[10px] text-sidebar-foreground/60">
            <img
              src="/assets/aistudio/avatar_9eef1d34.png"
              alt="NEXADASH"
              className="h-4 w-4 rounded-xs object-contain bg-white/90 p-0.5 shrink-0"
            />
            <span className="truncate">NEXADASH — Sistemas Inteligentes © 2026</span>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-2.5 md:p-8">{children}</main>
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
