import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  PhoneCall,
  ExternalLink,
  LogOut,
  RefreshCw,
  Lock,
  Building2,
  FileCheck,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface AccessActivationGateProps {
  status: "aguardando_liberacao" | "suspensa_manual" | "ativa";
  companyName?: string;
  planName?: string;
  ownerEmail?: string;
  suspensionReason?: string;
  activatedAt?: string;
  onRefresh?: () => void;
  children: React.ReactNode;
}

export function AccessActivationGate({
  status,
  companyName = "Sua Barbearia",
  planName = "NEXADASH PRO",
  ownerEmail = "contato@barbearia.com",
  suspensionReason,
  activatedAt,
  onRefresh,
  children,
}: AccessActivationGateProps) {
  const [checking, setChecking] = useState(false);

  // Se o acesso foi autorizado manualmente pela NEXADASH, renderiza os filhos normalmente
  if (status === "ativa") {
    return <>{children}</>;
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  async function handleCheckStatus() {
    setChecking(true);
    if (onRefresh) {
      await onRefresh();
    }
    setTimeout(() => {
      setChecking(false);
    }, 600);
  }

  // TELA 1: ACESSO SUSPENSO POR DECISÃO ADMINISTRATIVA MANUAL
  if (status === "suspensa_manual") {
    return (
      <div className="flex min-h-[85vh] items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-2xl border border-rose-500/30 bg-card p-6 shadow-xl sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white p-0.5 shadow-md border border-[#1E3E62]/20">
              <img
                src="/assets/aistudio/avatar_9eef1d34.png"
                alt="NEXADASH — Sistemas Inteligentes"
                className="h-full w-full object-contain rounded-lg"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black tracking-wider text-[#0B192C] dark:text-white">
                  NEXA<span className="text-[#FF6500]">DASH</span>
                </span>
                <Badge variant="destructive" className="text-[10px] font-semibold uppercase tracking-wider">
                  Acesso Suspenso
                </Badge>
              </div>
              <h2 className="mt-0.5 font-display text-lg font-bold text-foreground">
                Deliberação Administrativa NEXADASH
              </h2>
            </div>
          </div>

          <div className="mt-6 space-y-4 text-sm text-muted-foreground">
            <p>
              O acesso operacional da empresa <strong className="text-foreground">{companyName}</strong> está suspenso
              por decisão formal de um administrador autorizado da NEXADASH.
            </p>

            {suspensionReason && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4 text-xs">
                <span className="font-semibold text-rose-700 dark:text-rose-400">Motivo formal registrado:</span>
                <p className="mt-1 text-foreground/90 italic">"{suspensionReason}"</p>
              </div>
            )}

            <div className="rounded-lg border bg-muted/30 p-3 text-xs">
              <p className="font-medium text-foreground">Aviso de Governança:</p>
              <p className="mt-1">
                Conforme a política NEXADASH, nenhum vencimento ou cobrança provoca suspensão automática.
                A suspensão é sempre uma deliberação humana individual registrada em auditoria.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckStatus}
              disabled={checking}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
              Verificar Regularização
            </Button>
            <div className="flex items-center gap-2">
              <Button
                asChild
                size="sm"
                className="bg-[#FF6500] hover:bg-[#E55B00] text-white gap-2"
              >
                <a
                  href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20gostaria%20de%20regularizar%20o%20acesso%20do%20meu%20estabelecimento%20no%20BELEZI%20NEXADASH."
                  target="_blank"
                  rel="noreferrer"
                >
                  <PhoneCall className="h-4 w-4" /> Falar com o Consultor
                </a>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
                <LogOut className="h-4 w-4" /> Sair
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // TELA 2: AGUARDANDO LIBERAÇÃO MANUAL PELA NEXADASH (CRITÉRIO OBRIGATÓRIO DA ETAPA 5)
  return (
    <div className="flex min-h-[85vh] items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-[#1E3E62]/40 bg-card p-6 shadow-2xl sm:p-8">
        {/* Cabeçalho Institucional NEXADASH */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white p-0.5 shadow-md border border-[#1E3E62]/20">
              <img
                src="/assets/aistudio/avatar_9eef1d34.png"
                alt="NEXADASH — Sistemas Inteligentes"
                className="h-full w-full object-contain rounded-lg"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black tracking-wider text-[#0B192C] dark:text-white">
                  NEXA<span className="text-[#FF6500]">DASH</span>
                </span>
                <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px]">
                  Liberação Manual Pendente
                </Badge>
              </div>
              <h2 className="mt-0.5 font-display text-lg font-bold text-foreground">
                Ciclo de Ativação em Andamento
              </h2>
            </div>
          </div>
          <Badge className="bg-[#0B192C] text-white text-[11px] font-semibold py-1 px-3 self-start sm:self-auto">
            Plano: {planName}
          </Badge>
        </div>

        {/* Mensagem de Governança Estrita */}
        <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs">
          <div className="flex items-start gap-2.5">
            <Clock className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <strong className="text-amber-800 dark:text-amber-400">
                Regra de Segurança e Homologação Institucional:
              </strong>
              <p className="mt-1 text-muted-foreground leading-relaxed">
                Nenhum usuário ou interessado consegue liberar sozinho o sistema operacional. Mesmo que
                uma contratação ou cobrança online (Pix ou Cartão) seja confirmada, a liberação de acesso da
                barbearia depende obrigatoriamente da <strong>autorização manual por um administrador credenciado da NEXADASH</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Resumo da Conta e Checklist dos 5 Passos de Liberação */}
        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 rounded-lg border bg-muted/20 p-3 text-xs">
            <div>
              <span className="text-muted-foreground">Empresa / Estabelecimento:</span>
              <p className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                <Building2 className="h-3.5 w-3.5 text-primary" /> {companyName}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">E-mail do Administrador da Barbearia:</span>
              <p className="font-semibold text-foreground mt-0.5">{ownerEmail}</p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Progresso do Ciclo de Ativação (Etapa 5 NEXADASH)
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-lg border bg-emerald-500/5 border-emerald-500/20 p-2.5">
                <span className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  1. Registro da Contratação Realizado
                </span>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                  Concluído
                </Badge>
              </div>

              <div className="flex items-center justify-between rounded-lg border bg-emerald-500/5 border-emerald-500/20 p-2.5">
                <span className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  2. Conferência das Condições Acordadas
                </span>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                  Validado
                </Badge>
              </div>

              <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-2.5">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <FileCheck className="h-4 w-4 text-primary" />
                  3. Situação do Pagamento Conforme Contrato
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  Em Conciliação Comercial
                </Badge>
              </div>

              <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-2.5">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  4. Preparação da Conta e Catálogo da Barbearia
                </span>
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Em Preparação
                </Badge>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-[#FF6500]/30 bg-[#FF6500]/5 p-2.5">
                <span className="flex items-center gap-2 font-semibold text-[#FF6500]">
                  <Clock className="h-4 w-4 text-[#FF6500] animate-pulse" />
                  5. Autorização Manual pelo Administrador NEXADASH
                </span>
                <Badge className="bg-[#FF6500] text-white text-[10px]">
                  Aguardando Assinatura
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé com Ações e Suporte */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCheckStatus}
            disabled={checking}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Verificando..." : "Verificar Liberação"}
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              asChild
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-medium"
            >
              <a
                href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20gostaria%20de%20acompanhar%20a%20libera%C3%A7%C3%A3o%20manual%20da%20minha%20barbearia%20no%20BELEZI%20pela%20NEXADASH."
                target="_blank"
                rel="noreferrer"
              >
                <PhoneCall className="h-4 w-4" /> Suporte & Ativação
              </a>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2 text-muted-foreground">
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
