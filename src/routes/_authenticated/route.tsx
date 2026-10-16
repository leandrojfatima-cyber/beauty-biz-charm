import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { AccessActivationGate } from "@/components/AccessActivationGate";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, SlidersHorizontal } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  // 1. Verificar se o usuário é Master NEXADASH
  const { data: isMaster } = useQuery({
    queryKey: ["is-master"],
    queryFn: async () => {
      try {
        const { data } = await db.rpc("claim_master");
        return !!data;
      } catch {
        return false;
      }
    },
  });

  // 2. Buscar configurações e status de liberação do salão
  const { data: salon, refetch: refetchSalon } = useQuery({
    queryKey: ["salon-status-check"],
    queryFn: async () => {
      try {
        const { data } = await db
          .from("salon_settings")
          .select("id, name, status, plan_name, suspension_reason, activated_at")
          .maybeSingle();
        return data;
      } catch {
        return null;
      }
    },
  });

  // Estado de simulação em ambiente de desenvolvimento / teste
  // Permite que o administrador teste como o salão vê o sistema antes e depois da liberação manual
  const [simulationStatus, setSimulationStatus] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("nexadash_simulation_gate_status");
    if (saved) setSimulationStatus(saved);
  }, []);

  function handleSetSimulation(status: string | null) {
    if (status) {
      localStorage.setItem("nexadash_simulation_gate_status", status);
    } else {
      localStorage.removeItem("nexadash_simulation_gate_status");
    }
    setSimulationStatus(status);
  }

  // Determinar status efetivo:
  // Se for master acessando a rota /master, acesso liberado irrestrito
  // Se for simulação manual, obedece a simulação
  // Se for salão real, obedece o salon.status (default: 'aguardando_liberacao')
  const isMasterRoute = currentPath.startsWith("/master");
  const effectiveStatus = (simulationStatus || salon?.status || "ativa") as
    | "aguardando_liberacao"
    | "suspensa_manual"
    | "ativa";

  // Se estiver no /master, Master tem permissão
  const shouldBypassGate = isMasterRoute && isMaster;

  return (
    <AppShell>
      {/* Banner de Demonstração / Alternador de Estados da Etapa 5 para Homologação */}
      {isMaster && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#FF6500]/30 bg-[#FF6500]/5 px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#FF6500]" />
            <span className="font-semibold text-foreground">
              Simulador de Acesso da Barbearia (Etapa 5):
            </span>
            <Badge variant="outline" className="text-[10px] uppercase font-bold">
              {simulationStatus ? `Simulando: ${simulationStatus}` : "Modo Real (Padrão)"}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant={simulationStatus === "aguardando_liberacao" ? "default" : "outline"}
              className="h-6 text-[10px] px-2"
              onClick={() => handleSetSimulation("aguardando_liberacao")}
            >
              Aguardando Liberação
            </Button>
            <Button
              size="sm"
              variant={simulationStatus === "suspensa_manual" ? "destructive" : "outline"}
              className="h-6 text-[10px] px-2"
              onClick={() => handleSetSimulation("suspensa_manual")}
            >
              Suspensa Manual
            </Button>
            <Button
              size="sm"
              variant={simulationStatus === "ativa" || (!simulationStatus && effectiveStatus === "ativa") ? "secondary" : "outline"}
              className="h-6 text-[10px] px-2"
              onClick={() => handleSetSimulation("ativa")}
            >
              Ativa (Autorizada)
            </Button>
            {simulationStatus && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px] px-2 text-muted-foreground"
                onClick={() => handleSetSimulation(null)}
              >
                Resetar
              </Button>
            )}
          </div>
        </div>
      )}

      {shouldBypassGate ? (
        <Outlet />
      ) : (
        <AccessActivationGate
          status={effectiveStatus}
          companyName={salon?.name || "Barbearia em Ativação"}
          planName={salon?.plan_name || "NEXADASH PRO"}
          suspensionReason={salon?.suspension_reason || "Suspensão deliberada pelo comitê administrativo."}
          activatedAt={salon?.activated_at}
          onRefresh={() => refetchSalon()}
        >
          <Outlet />
        </AccessActivationGate>
      )}
    </AppShell>
  );
}
