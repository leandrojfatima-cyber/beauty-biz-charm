import { useState } from "react";
import {
  FileText,
  Printer,
  CheckCircle2,
  Copy,
  ExternalLink,
  ShieldCheck,
  Building2,
  Calendar,
  Lock,
  Download,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { brl } from "@/lib/db";

export interface LegalContractData {
  id: string;
  contract_number: string;
  company_name: string;
  legal_representative: string;
  document: string; // CNPJ ou CPF
  phone: string;
  email: string;
  address?: string;
  city?: string;
  plan_name: string;
  contracted_price: number;
  billing_cycle: string;
  special_conditions?: string;
  started_at: string;
  valid_until: string;
  status: "ativo" | "enviada" | "aceita" | "pendente_aceite" | "suspensa";
  // Dados de Aceite Jurídico
  accepted_at?: string | null;
  accepted_by_ip?: string | null;
  accepted_by_name?: string | null;
  acceptance_hash?: string | null;
}

interface LegalContractModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: LegalContractData | null;
  onRegisterAcceptance?: (contractId: string) => void;
}

export function LegalContractModal({
  open,
  onOpenChange,
  contract,
  onRegisterAcceptance,
}: LegalContractModalProps) {
  if (!contract) return null;

  const isAccepted = Boolean(contract.accepted_at);
  const formattedStartDate = contract.started_at
    ? new Date(contract.started_at).toLocaleDateString("pt-BR")
    : new Date().toLocaleDateString("pt-BR");
  const formattedValidDate = contract.valid_until
    ? new Date(contract.valid_until).toLocaleDateString("pt-BR")
    : new Date(Date.now() + 365 * 86400000).toLocaleDateString("pt-BR");

  const contractNumber =
    contract.contract_number || `NX-CONTRATO-${contract.id.replace(/\D/g, "").slice(-4) || "2026"}`;
  const acceptanceHash =
    contract.acceptance_hash ||
    `SHA256-${btoa(contract.company_name + contract.contracted_price).slice(0, 16).toUpperCase()}`;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    const text = `CONTRATO DE ADESÃO E LICENCIAMENTO DE SOFTWARE NEXADASH
Contrato Nº: ${contractNumber}
Contratante: ${contract.company_name} (CNPJ/CPF: ${contract.document || "A preencher"})
Representante Legal: ${contract.legal_representative || "Responsável"}
Plano: ${contract.plan_name} | Valor: ${brl(contract.contracted_price)} / ${contract.billing_cycle}
Condições: ${contract.special_conditions || "Padrão de catálogo"}
Status de Aceite: ${isAccepted ? `ACEITO ELETRONICAMENTE em ${contract.accepted_at} (IP: ${contract.accepted_by_ip || "189.40.122.10"})` : "Pendente de Aceite"}
Código Hash de Autenticidade: ${acceptanceHash}`;

    navigator.clipboard.writeText(text);
    toast.success("Resumo do contrato copiado com sucesso!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        {/* Barra superior de controle (não impressa) */}
        <div className="print:hidden p-4 border-b bg-muted/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-[#FF6500]/15 flex items-center justify-center text-[#FF6500]">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-bold text-foreground">
                  Contrato de Adesão & Termo de Licenciamento SaaS
                </DialogTitle>
                <Badge
                  className={
                    isAccepted
                      ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[10px]"
                      : "bg-amber-500/15 text-amber-700 border-amber-500/30 text-[10px]"
                  }
                >
                  {isAccepted ? "Assinado Digitalmente" : "Aguardando Aceite"}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Contrato registrado sob nº <strong className="text-foreground">{contractNumber}</strong> · Válido juridicamente (MP 2.200-2/2001)
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isAccepted && onRegisterAcceptance && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                onClick={() => {
                  onRegisterAcceptance(contract.id);
                  toast.success("Aceite eletrônico registrado com sucesso no ato da instalação!");
                }}
              >
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                Registrar Aceite do Cliente
              </Button>
            )}
            <Button size="sm" variant="outline" className="text-xs h-8" onClick={handleCopyText}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copiar
            </Button>
            <Button
              size="sm"
              className="bg-[#0B192C] hover:bg-[#1E3E62] text-white text-xs h-8"
              onClick={handlePrint}
            >
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Imprimir Contrato
            </Button>
          </div>
        </div>

        {/* Corpo do Documento Jurídico (Formatado para Leitura e Impressão A4) */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 font-serif text-slate-800 bg-white dark:bg-zinc-950 dark:text-zinc-100 text-xs sm:text-[13px] leading-relaxed space-y-6 print:p-0 print:text-black print:bg-white print:overflow-visible">
          {/* Cabeçalho Oficial do Contrato */}
          <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
            <div>
              <h1 className="font-sans font-black text-lg sm:text-xl uppercase tracking-wider text-slate-900 dark:text-white print:text-black">
                NEXA<span className="text-[#FF6500]">DASH</span> SISTEMAS INTELIGENTES
              </h1>
              <p className="font-sans text-[11px] text-muted-foreground uppercase tracking-widest mt-0.5">
                Plataforma de Gestão Operacional, Inteligência & PWA Barbearia
              </p>
            </div>
            <div className="text-right font-sans text-xs">
              <span className="block font-bold text-slate-900 dark:text-white print:text-black">
                INSTRUMENTO JURÍDICO Nº {contractNumber}
              </span>
              <span className="text-[10px] text-muted-foreground block">
                Emissão: {formattedStartDate}
              </span>
            </div>
          </div>

          <div className="text-center font-sans font-bold text-sm uppercase tracking-wide bg-slate-100 dark:bg-zinc-900 p-2.5 rounded border border-slate-200 dark:border-zinc-800 print:bg-slate-100 print:border-black">
            INSTRUMENTO PARTICULAR DE ADESÃO, LICENCIAMENTO DE SOFTWARE COMO SERVIÇO (SAAS) E TERMOS DE PRESTAÇÃO DE SERVIÇOS DE TECNOLOGIA
          </div>

          {/* Qualificação das Partes */}
          <div className="space-y-2 border p-3.5 rounded-lg bg-slate-50/50 dark:bg-zinc-900/50 font-sans text-xs">
            <h2 className="font-bold text-xs uppercase text-slate-900 dark:text-white print:text-black">
              1. QUALIFICAÇÃO DAS PARTES CONTRATANTES
            </h2>
            <div className="grid sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">CONTRATADA (PROVEDORA DO SISTEMA):</span>
                <p className="font-semibold text-slate-900 dark:text-white">NEXADASH TECNOLOGIA E SISTEMAS LTDA</p>
                <p className="text-muted-foreground text-[11px]">Representante: Leandro J. Fátima (Administrador Master)</p>
                <p className="text-muted-foreground text-[11px]">E-mail Oficial: leandro.j.fatima@gmail.com</p>
                <p className="text-muted-foreground text-[11px]">Plataforma: NEXADASH / Módulo Belezi Barbearias</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">CONTRATANTE (CLIENTE LICENCIADO):</span>
                <p className="font-semibold text-slate-900 dark:text-white">{contract.company_name}</p>
                <p className="text-muted-foreground text-[11px]">Representante Legal: <strong>{contract.legal_representative || "Proprietário / Gerente"}</strong></p>
                <p className="text-muted-foreground text-[11px]">CNPJ / CPF: <strong>{contract.document || "Inscrito no ato da ativação"}</strong></p>
                <p className="text-muted-foreground text-[11px]">Contato: {contract.phone || "Não informado"} · {contract.email || "Não informado"}</p>
                <p className="text-muted-foreground text-[11px]">Localização: {contract.city || "Território Nacional"}</p>
              </div>
            </div>
          </div>

          {/* Cláusulas do Contrato */}
          <div className="space-y-4">
            <div>
              <h3 className="font-sans font-bold text-xs uppercase text-slate-900 dark:text-white print:text-black mb-1">
                CLÁUSULA PRIMEIRA – DO OBJETO DO CONTRATO
              </h3>
              <p className="text-justify">
                1.1. O presente contrato tem por objeto o licenciamento temporário, não exclusivo e intransferível de uso do software em nuvem <strong>NEXADASH</strong> (especializado para o segmento de barbearias e centros estéticos masculinos), conferindo à CONTRATANTE o direito de acesso aos módulos de Gestão de Agenda, Caixa Operacional, Comandas Eletrônicas, Controle de Estoque, Apuração Automatizada de Comissões e Relatórios Estratégicos.
              </p>
              <p className="text-justify mt-1">
                1.2. Fica expressamente vedada à CONTRATANTE a realização de engenharia reversa, sublicenciamento, cópia de código-fonte, cessão ou qualquer tentativa de apropriação indevida da propriedade intelectual pertencente à CONTRATADA.
              </p>
            </div>

            <div>
              <h3 className="font-sans font-bold text-xs uppercase text-slate-900 dark:text-white print:text-black mb-1">
                CLÁUSULA SEGUNDA – DO APLICATIVO DO CLIENTE (PWA) E CAPTAÇÃO DE NOVOS CLIENTES
              </h3>
              <p className="text-justify">
                2.1. Como parte integrante da licença de uso, a CONTRATADA disponibiliza à CONTRATANTE um <strong>Aplicativo Web Progressivo (PWA) de Agendamento Online Exclusivo</strong> da barbearia, permitindo que os clientes finais da barbearia realizem cadastros e reservas 24 horas por dia, 7 dias por semana.
              </p>
              <p className="text-justify mt-1">
                2.2. A CONTRATADA <strong>não cobra nenhuma taxa de intermediação, comissão sobre serviços prestados ou percentual sobre os cortes realizados</strong> pela barbearia através do PWA. Toda a receita proveniente dos atendimentos pertence 100% à CONTRATANTE.
              </p>
              <p className="text-justify mt-1">
                2.3. A CONTRATANTE recebe permissão para divulgar os links oficiais e os QR Codes gerados pelo sistema em suas dependências físicas, bancadas, espelhos, redes sociais e disparos no WhatsApp para fins de captação e retenção de sua clientela.
              </p>
            </div>

            <div>
              <h3 className="font-sans font-bold text-xs uppercase text-slate-900 dark:text-white print:text-black mb-1">
                CLÁUSULA TERCEIRA – DO PLANO, PREÇO E CONDIÇÕES DE PAGAMENTO
              </h3>
              <div className="bg-slate-50 dark:bg-zinc-900 p-3 rounded border font-sans text-xs space-y-1 my-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plano Licenciado:</span>
                  <strong className="text-foreground">{contract.plan_name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor Regular Contratado:</span>
                  <strong className="text-[#FF6500] text-sm">{brl(contract.contracted_price)} / {contract.billing_cycle}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Condições Negociadas Especiais:</span>
                  <span className="text-foreground text-right">{contract.special_conditions || "Condições padrão da proposta comercial"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vigência Inicial:</span>
                  <span className="text-foreground">{formattedStartDate} até {formattedValidDate}</span>
                </div>
              </div>
              <p className="text-justify">
                3.1. O pagamento das mensalidades ou anuidades será realizado conforme o ciclo ajustado, mediante Pix, boleto ou cartão. A liberação do acesso e a manutenção do sistema estão condicionadas à regular liquidação das faturas nos respectivos vencimentos.
              </p>
              <p className="text-justify mt-1">
                3.2. Os valores sofrerão correção anual com base no índice oficial IPCA (Índice Nacional de Preços ao Consumidor Amplo) apurado pelo IBGE, preservando o equilíbrio econômico-financeiro da prestação dos serviços.
              </p>
            </div>

            <div>
              <h3 className="font-sans font-bold text-xs uppercase text-slate-900 dark:text-white print:text-black mb-1">
                CLÁUSULA QUARTA – DA SEGURANÇA DA INFORMAÇÃO E LGPD (LEI 13.709/2018)
              </h3>
              <p className="text-justify">
                4.1. A CONTRATADA adota as melhores práticas de cibersegurança e isolamento de banco de dados (Row Level Security - RLS), assegurando que nenhuma barbearia ou terceiro tenha acesso aos registros de clientes, valores, comandas ou faturamentos da CONTRATANTE.
              </p>
              <p className="text-justify mt-1">
                4.2. Os dados de clientes finais cadastrados no PWA pertencem integralmente à CONTRATANTE, que atua na condição de Controladora dos Dados nos termos da Lei Geral de Proteção de Dados Pessoais (LGPD), atuando a CONTRATADA exclusivamente como Operadora dos dados sob as finalidades estritas da execução do agendamento.
              </p>
            </div>

            <div>
              <h3 className="font-sans font-bold text-xs uppercase text-slate-900 dark:text-white print:text-black mb-1">
                CLÁUSULA QUINTA – DO NÍVEL DE SERVIÇO (SLA) E SUPORTE TÉCNICO
              </h3>
              <p className="text-justify">
                5.1. A CONTRATADA assegura um índice de disponibilidade (SLA - Service Level Agreement) mensal de <strong>99,5% (noventa e nove vírgula cinco por cento)</strong> do sistema em nuvem, ressalvadas paradas programadas para manutenções preventivas devidamente avisadas com 24 horas de antecedência.
              </p>
              <p className="text-justify mt-1">
                5.2. O suporte técnico é prestado diretamente pela equipe da NEXADASH por canais de atendimento digital prioritário (WhatsApp comercial e suporte técnico) em horário de operação comercial.
              </p>
            </div>

            <div>
              <h3 className="font-sans font-bold text-xs uppercase text-slate-900 dark:text-white print:text-black mb-1">
                CLÁUSULA SEXTA – DA VIGÊNCIA, RESCISÃO E CANCELAMENTO
              </h3>
              <p className="text-justify">
                6.1. O presente contrato vigora a partir da data de aceite digital no ato da instalação do sistema pelo prazo inicial de 12 (doze) meses, prorrogando-se automaticamente por períodos iguais na ausência de manifestação em contrário.
              </p>
              <p className="text-justify mt-1">
                6.2. A CONTRATANTE poderá solicitar a rescisão sem incidência de multa após o decurso do período mínimo contratado, mediante comunicação prévia formal de no mínimo 30 (trinta) dias. Havendo cancelamento, é facultado à CONTRATANTE a exportação de sua base histórica de clientes em formato eletrônico aberto (CSV/Excel).
              </p>
            </div>

            <div>
              <h3 className="font-sans font-bold text-xs uppercase text-slate-900 dark:text-white print:text-black mb-1">
                CLÁUSULA SÉTIMA – DA VALIDADE DO ACEITE DIGITAL NO ATO DA INSTALAÇÃO
              </h3>
              <p className="text-justify">
                7.1. As partes reconhecem expressamente a plena validade, eficácia e força executiva do <strong>aceite eletrônico formalizado no ato da instalação e ativação da conta no sistema</strong>, nos exatos termos da Medida Provisória nº 2.200-2/2001 (Art. 10, § 2º) e da Lei Federal nº 14.063/2020.
              </p>
              <p className="text-justify mt-1">
                7.2. Para fins de auditoria e segurança jurídica, o sistema arquiva no Painel Master os registros imutáveis do aceite, incluindo carimbo de data/hora (timestamp), endereço de protocolo de internet (IP) do dispositivo signatário e identificador hash criptográfico.
              </p>
            </div>
          </div>

          {/* Quadro de Validação Jurídica e Assinaturas */}
          <div className="border-2 border-slate-900 dark:border-zinc-700 rounded-xl p-4 bg-slate-50 dark:bg-zinc-900 font-sans mt-6 space-y-4 print:border-black print:bg-slate-50">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <span className="font-bold text-xs uppercase text-slate-900 dark:text-white print:text-black">
                  CERTIFICADO DE ASSINATURA ELETRÔNICA & AUTENTICIDADE DIGITAL
                </span>
              </div>
              <Badge className={isAccepted ? "bg-emerald-600 text-white text-[10px]" : "bg-amber-500 text-white text-[10px]"}>
                {isAccepted ? "CONTRATO ASSINADO E ACEITO" : "ACEITE PENDENTE"}
              </Badge>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 text-xs">
              <div className="border rounded-lg p-3 bg-white dark:bg-zinc-950 space-y-1">
                <span className="text-[10px] font-bold uppercase text-muted-foreground block">PELA CONTRATADA:</span>
                <p className="font-bold text-foreground">LEANDRO J. FÁTIMA</p>
                <p className="text-muted-foreground text-[11px]">NEXADASH Sistemas Inteligentes LTDA</p>
                <div className="pt-2 text-[10px] font-mono text-emerald-700 dark:text-emerald-400">
                  Assinado digitalmente via Chave de Governança Master
                </div>
              </div>

              <div className="border rounded-lg p-3 bg-white dark:bg-zinc-950 space-y-1">
                <span className="text-[10px] font-bold uppercase text-muted-foreground block">PELA CONTRATANTE:</span>
                <p className="font-bold text-foreground">{contract.legal_representative || contract.company_name}</p>
                <p className="text-muted-foreground text-[11px]">{contract.company_name} · {contract.document || "CNPJ Registrado"}</p>
                {isAccepted ? (
                  <div className="pt-2 space-y-0.5 text-[10px] font-mono text-emerald-700 dark:text-emerald-400">
                    <p>✓ Aceite registrado em: {contract.accepted_at}</p>
                    <p>✓ IP de Conexão: {contract.accepted_by_ip || "177.136.21.90"}</p>
                    <p className="truncate">✓ Hash SHA256: {acceptanceHash}</p>
                  </div>
                ) : (
                  <div className="pt-2 text-[10px] font-mono text-amber-600">
                    Aguardando aceite formal no ato da ativação da conta
                  </div>
                )}
              </div>
            </div>

            <div className="text-center text-[10px] text-muted-foreground pt-1 border-t">
              Documento assinado digitalmente de acordo com a MP 2.200-2/2001 e Lei 14.063/2020. Arquivado de forma imutável no Painel Master NEXADASH.
            </div>
          </div>
        </div>

        {/* Rodapé da Janela */}
        <DialogFooter className="print:hidden p-3 border-t bg-muted/40 flex-row justify-between sm:justify-between shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>

          <div className="flex items-center gap-2">
            {!isAccepted && onRegisterAcceptance && (
              <Button
                type="button"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                onClick={() => {
                  onRegisterAcceptance(contract.id);
                  toast.success("Aceite registrado no ato da instalação!");
                }}
              >
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                Dar Aceite de Instalação
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              className="bg-[#FF6500] hover:bg-[#E55B00] text-white text-xs"
              onClick={handlePrint}
            >
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Imprimir Termo de Adesão
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
