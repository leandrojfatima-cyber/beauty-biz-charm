import { useState, useEffect, useMemo } from "react";
import {
  Megaphone,
  Share2,
  Copy,
  Check,
  Send,
  QrCode,
  Printer,
  Sparkles,
  Smartphone,
  ShieldCheck,
  DollarSign,
  TrendingUp,
  Scissors,
  CheckCircle2,
  ExternalLink,
  Save,
  MessageSquare,
  FileText,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface MasterPixConfig {
  key: string;
  keyType: "email" | "cpf" | "phone" | "random";
  receiverName: string;
  receiverBank: string;
  receiverCity: string;
  defaultPlanValue: number;
  setupValue: number;
}

export const DEFAULT_PIX_CONFIG: MasterPixConfig = {
  key: "nexadash.nsi@gmail.com",
  keyType: "email",
  receiverName: "Leandro José de Fátima",
  receiverBank: "C6 Bank",
  receiverCity: "São Paulo",
  defaultPlanValue: 59.9,
  setupValue: 150.0,
};

export function ProspectingHub({
  leads = [],
  onOpenProposal,
}: {
  leads?: Array<{ id: string; name: string; company_name: string; phone?: string }>;
  onOpenProposal?: (leadData: { name: string; company: string; phone: string }) => void;
}) {
  // Configuração do PIX com persistência
  const [pixConfig, setPixConfig] = useState<MasterPixConfig>(() => {
    try {
      const saved = localStorage.getItem("nexadash_master_pix_config");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Atualiza chaves legadas para a oficial fornecida pelo titular
        if (parsed.key === "leandro.j.fatima@gmail.com" || !parsed.receiverBank) {
          return {
            ...DEFAULT_PIX_CONFIG,
            ...parsed,
            key: "nexadash.nsi@gmail.com",
            receiverBank: "C6 Bank",
            receiverName: "Leandro José de Fátima",
          };
        }
        return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_PIX_CONFIG;
  });

  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // Dados do prospect para geração do roteiro
  const [targetName, setTargetName] = useState("Amigo Barbeiro");
  const [targetBarbershop, setTargetBarbershop] = useState("Sua Barbearia");
  const [targetPhone, setTargetPhone] = useState("");
  const [selectedPitch, setSelectedPitch] = useState<"consultive" | "direct" | "closing">("direct");

  // Salvar PIX
  const handleSavePix = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem("nexadash_master_pix_config", JSON.stringify(pixConfig));
      toast.success("Configurações do seu PIX salvas com sucesso!", {
        description: "Essa chave será aplicada automaticamente em cobranças, propostas e mensagens.",
      });
    } catch {
      toast.error("Erro ao salvar no armazenamento local.");
    }
  };

  // Link dinâmico de teste direto do sistema (entra no modo demonstração com 1 clique)
  const systemOrigin = typeof window !== "undefined" ? window.location.origin : "https://belezi.com.br";
  const demoDirectLink = `${systemOrigin}/auth?demo=1`;
  const pwaDemoLink = `${systemOrigin}/cliente`;

  // Payload BR Code / PIX Copia-e-Cola simplificado e padronizado
  const pixCopiaECola = useMemo(() => {
    const cleanKey = pixConfig.key.trim();
    const cleanName = pixConfig.receiverName.trim().toUpperCase().slice(0, 25);
    const cleanCity = pixConfig.receiverCity.trim().toUpperCase().slice(0, 15);
    const valStr = Number(pixConfig.defaultPlanValue).toFixed(2);

    // Gerador de string identificadora PIX com metadados para app bancário
    return `00020126580014BR.GOV.BCB.PIX01${String(cleanKey.length).padStart(2, "0")}${cleanKey}520400005303986540${String(valStr.length).padStart(2, "0")}${valStr}5802BR59${String(cleanName.length).padStart(2, "0")}${cleanName}60${String(cleanCity.length).padStart(2, "0")}${cleanCity}62070503***6304E2E0`;
  }, [pixConfig]);

  // Roteiros Comerciais de Abordagem WhatsApp
  const currentPitchText = useMemo(() => {
    const nome = targetName.trim() || "Amigo";
    const barbearia = targetBarbershop.trim() || "sua barbearia";

    if (selectedPitch === "consultive") {
      return `Fala ${nome}, tudo bem? Aqui é o Leandro da NEXADASH!

Acompanhei o trabalho da *${barbearia}* e vi que vocês têm um padrão impecável de corte e atendimento.

Uma dúvida rápida: você ainda perde tempo calculando comissão de barbeiros no caderno/planilha ou pagando taxa mensal e comissão por agendamento para plataformas como Booksy/Trinks?

Desenvolvemos o *BELEZI*, onde a barbearia tem:
✅ O seu próprio aplicativo de agendamento (seus clientes agendam direto pelo celular com a sua logo);
✅ Zero taxa ou comissão por agendamento;
✅ Comandas rápidas com cálculo automático de comissão por barbeiro;
✅ Fechamento de caixa diário e estoque blindado.

Preparei um link direto para você testar agora na prática, sem precisar cadastrar senha:
👉 *Acesse o teste aqui:* ${demoDirectLink}

Dá uma olhada de 2 minutos e me diga o que achou! Forte abraço!`;
    }

    if (selectedPitch === "direct") {
      return `Olá ${nome}! Leandro da NEXADASH por aqui.

Liberei um acesso de teste exclusivo do sistema *BELEZI* para a *${barbearia}*.

Você pode mexer agora mesmo nas comandas, agenda e financeiro sem cadastro prévio:
👉 *Link do teste:* ${demoDirectLink}

Principais vantagens que entregamos para você:
1. Seus clientes agendam pelo celular no seu App PWA próprio;
2. Sem comissões por corte;
3. Relatório de faturamento e divisão de comissões em 1 clique;
4. Onboarding guiado e suporte direto comigo.

Consegue dar uma olhada rápida hoje?`;
    }

    // Pitch: Closing (Fechamento & PIX)
    return `Olá ${nome}! Excelente que você aprovou o teste prático do BELEZI na *${barbearia}*.

Conforme nosso alinhamento, segue a proposta de ativação:
📋 *Plano:* NEXADASH PRO
💰 *Investimento:* R$ ${Number(pixConfig.defaultPlanValue).toFixed(2)}/mês
🚀 *Incluso:* Sistema completo + App do Cliente + Suporte Prioritário WhatsApp + Termo Formal de Adesão Jurídico.

🔑 *Dados Oficiais para Pagamento via PIX:*
*Chave PIX:* ${pixConfig.key} (E-mail)
*Banco:* ${pixConfig.receiverBank || "C6 Bank"}
*Titular Favorecido:* ${pixConfig.receiverName}

Assim que efetuar a transferência, me envie o comprovante por aqui para emitirmos seu contrato e liberarmos o acesso definitivo da sua barbearia no sistema!`;
  }, [selectedPitch, targetName, targetBarbershop, demoDirectLink, pixConfig]);

  const copyToClipboard = (text: string, type: "key" | "payload" | "link" | "script") => {
    try {
      navigator.clipboard.writeText(text);
      if (type === "key") {
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
        toast.success("Chave PIX copiada para a área de transferência!");
      } else if (type === "payload") {
        setCopiedPayload(true);
        setTimeout(() => setCopiedPayload(false), 2000);
        toast.success("PIX Copia-e-Cola copiado com sucesso!");
      } else if (type === "link") {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
        toast.success("Link de teste direto copiado!");
      } else {
        setCopiedScript(true);
        setTimeout(() => setCopiedScript(false), 2000);
        toast.success("Roteiro completo copiado para o WhatsApp!");
      }
    } catch {
      toast.error("Não foi possível copiar automaticamente.");
    }
  };

  const handleSendWhatsApp = () => {
    const cleanPhone = targetPhone.replace(/\D/g, "");
    const encoded = encodeURIComponent(currentPitchText);
    const url = cleanPhone
      ? `https://wa.me/55${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank");
  };

  const handlePrintBanner = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Informativo da Estratégia de Captação */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-zinc-950 via-zinc-900 to-[#0B192C] p-6 text-white border border-zinc-800 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <Badge className="bg-[#FF6500] text-white hover:bg-[#E55B00] text-[10px] font-bold uppercase tracking-wider">
                Estratégia Outbound & Inbound
              </Badge>
              <span className="text-xs text-zinc-400 font-mono">Pipeline de Conversão B2B</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-white font-display">
              Kit de Captação de Barbearias & Chave PIX Master
            </h2>
            <p className="text-xs md:text-sm text-zinc-300 leading-relaxed">
              Aborde donos de barbearia com o link de teste imediato (sem senha), gere o banner institucional e
              apresente sua chave PIX oficial para fechar o contrato com segurança jurídica.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={handlePrintBanner}
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-semibold"
            >
              <Printer className="mr-1.5 h-3.5 w-3.5 text-[#FF6500]" />
              Imprimir Banner Promocional
            </Button>
            <Button
              size="sm"
              onClick={() => copyToClipboard(demoDirectLink, "link")}
              className="bg-[#FF6500] hover:bg-[#E55B00] text-white text-xs font-bold shadow-md shadow-[#FF6500]/20"
            >
              {copiedLink ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
              Copiar Link de Teste do Barbeiro
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* COLUNA ESQUERDA: GESTÃO DO PIX E DADOS BANCÁRIOS (4 COLS) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card: Configuração da Chave PIX do Titular */}
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                  <DollarSign className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Sua Chave PIX de Recebimento</h3>
                  <p className="text-[11px] text-muted-foreground">C6 Bank · Leandro José de Fátima</p>
                </div>
              </div>
              <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 text-[10px]">
                C6 Bank
              </Badge>
            </div>

            <form onSubmit={handleSavePix} className="space-y-3.5 text-xs">
              <div>
                <Label className="text-[11px] font-semibold text-muted-foreground">Chave PIX Oficial</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={pixConfig.key}
                    onChange={(e) => setPixConfig({ ...pixConfig, key: e.target.value })}
                    placeholder="ex: nexadash.nsi@gmail.com"
                    className="font-mono text-xs h-9 font-medium"
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 px-2.5 shrink-0"
                    onClick={() => copyToClipboard(pixConfig.key, "key")}
                    title="Copiar Chave"
                  >
                    {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label className="text-[11px] font-semibold text-muted-foreground">Tipo de Chave</Label>
                  <Select
                    value={pixConfig.keyType}
                    onValueChange={(val: any) => setPixConfig({ ...pixConfig, keyType: val })}
                  >
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="cpf">CPF / CNPJ</SelectItem>
                      <SelectItem value="phone">Celular</SelectItem>
                      <SelectItem value="random">Chave Aleatória (EVP)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-muted-foreground">Cidade do Titular</Label>
                  <Input
                    value={pixConfig.receiverCity}
                    onChange={(e) => setPixConfig({ ...pixConfig, receiverCity: e.target.value })}
                    className="h-8 text-xs mt-1"
                    placeholder="São Paulo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label className="text-[11px] font-semibold text-muted-foreground">Nome do Favorecido</Label>
                  <Input
                    value={pixConfig.receiverName}
                    onChange={(e) => setPixConfig({ ...pixConfig, receiverName: e.target.value })}
                    className="h-8 text-xs mt-1 font-medium"
                    placeholder="Leandro José de Fátima"
                    required
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-muted-foreground">Banco / Instituição</Label>
                  <Input
                    value={pixConfig.receiverBank}
                    onChange={(e) => setPixConfig({ ...pixConfig, receiverBank: e.target.value })}
                    className="h-8 text-xs mt-1 font-medium"
                    placeholder="C6 Bank"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label className="text-[11px] font-semibold text-muted-foreground">Valor Padrão Plano (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={pixConfig.defaultPlanValue}
                    onChange={(e) => setPixConfig({ ...pixConfig, defaultPlanValue: Number(e.target.value) })}
                    className="h-8 text-xs mt-1 font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-muted-foreground">Taxa Instalação (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={pixConfig.setupValue}
                    onChange={(e) => setPixConfig({ ...pixConfig, setupValue: Number(e.target.value) })}
                    className="h-8 text-xs mt-1 font-mono"
                  />
                </div>
              </div>

              <Button type="submit" size="sm" className="w-full bg-[#0B192C] hover:bg-[#1E3E62] text-white text-xs h-8">
                <Save className="mr-1.5 h-3.5 w-3.5" /> Salvar Configurações do PIX
              </Button>
            </form>

            {/* Caixa com PIX Copia-e-Cola e QR Code Visual */}
            <div className="rounded-lg bg-muted/40 p-3 border space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <QrCode className="h-3.5 w-3.5 text-[#FF6500]" /> PIX Copia-e-Cola Gerado
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">R$ {Number(pixConfig.defaultPlanValue).toFixed(2)}</span>
              </div>

              <div className="relative">
                <div className="font-mono text-[10px] text-muted-foreground break-all bg-background p-2 rounded border max-h-16 overflow-y-auto">
                  {pixCopiaECola}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(pixCopiaECola, "payload")}
                  className="w-full text-xs h-8 font-medium border-emerald-600/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10"
                >
                  {copiedPayload ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                  Copiar Código PIX
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(pixConfig.key, "key")}
                  className="w-full text-xs h-8 font-medium"
                >
                  <Share2 className="mr-1.5 h-3.5 w-3.5" />
                  Copiar Apenas a Chave
                </Button>
              </div>
            </div>
          </div>

          {/* Card: Metodologia de Captação dos 4 Passos */}
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3 text-xs">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#FF6500]" />
              Como Captar Barbeiros na Prática (O Funil)
            </h3>
            <ol className="space-y-2.5 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="h-5 w-5 rounded-full bg-[#FF6500]/15 text-[#FF6500] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <strong className="text-foreground block">Abordagem Inicial (WhatsApp / Instagram):</strong>
                  Envie o pitch consultivo focando na dor da comissão e perda de controle.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-5 w-5 rounded-full bg-[#FF6500]/15 text-[#FF6500] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <strong className="text-foreground block">Degustação Imediata (Link de Teste):</strong>
                  O barbeiro clica em <code className="bg-muted px-1 rounded font-mono text-[10px]">?demo=1</code> e
                  acessa as ferramentas instantaneamente sem precisar criar conta.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-5 w-5 rounded-full bg-[#FF6500]/15 text-[#FF6500] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <strong className="text-foreground block">Emissão de Proposta & Contrato:</strong>
                  Gere a proposta na aba "Propostas" para garantir validade jurídica e aceite formal na instalação.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-5 w-5 rounded-full bg-[#FF6500]/15 text-[#FF6500] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  4
                </span>
                <div>
                  <strong className="text-foreground block">Pagamento PIX & Liberação Manual:</strong>
                  O cliente paga no seu PIX e você faz a liberação manual na Etapa 5 do Master.
                </div>
              </li>
            </ol>
          </div>
        </div>

        {/* COLUNA DIREITA: GERADOR DE MENSAGENS WHATSAPP & BANNER VISUAL (7 COLS) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card: Gerador de Abordagem WhatsApp */}
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Gerador de Abordagem WhatsApp</h3>
                  <p className="text-[11px] text-muted-foreground">Mensagens de alta conversão prontas para envio</p>
                </div>
              </div>

              {/* Seletor de Roteiro */}
              <div className="flex gap-1 bg-muted p-1 rounded-lg">
                <Button
                  size="sm"
                  type="button"
                  variant={selectedPitch === "consultive" ? "default" : "ghost"}
                  onClick={() => setSelectedPitch("consultive")}
                  className={`text-[10px] h-7 px-2 ${selectedPitch === "consultive" ? "bg-[#FF6500] text-white" : ""}`}
                >
                  1. Consultivo
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant={selectedPitch === "direct" ? "default" : "ghost"}
                  onClick={() => setSelectedPitch("direct")}
                  className={`text-[10px] h-7 px-2 ${selectedPitch === "direct" ? "bg-[#FF6500] text-white" : ""}`}
                >
                  2. Teste Rápido
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant={selectedPitch === "closing" ? "default" : "ghost"}
                  onClick={() => setSelectedPitch("closing")}
                  className={`text-[10px] h-7 px-2 ${selectedPitch === "closing" ? "bg-[#FF6500] text-white" : ""}`}
                >
                  3. Fechamento + PIX
                </Button>
              </div>
            </div>

            {/* Customização do Prospect */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <Label className="text-[11px] text-muted-foreground font-semibold">Nome do Dono / Barbeiro</Label>
                <Input
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  placeholder="ex: Carlos"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground font-semibold">Nome da Barbearia</Label>
                <Input
                  value={targetBarbershop}
                  onChange={(e) => setTargetBarbershop(e.target.value)}
                  placeholder="ex: Dom Barba"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground font-semibold">WhatsApp (com DDD)</Label>
                <Input
                  value={targetPhone}
                  onChange={(e) => setTargetPhone(e.target.value)}
                  placeholder="11999998888"
                  className="h-8 text-xs mt-1 font-mono"
                />
              </div>
            </div>

            {leads.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[11px] text-muted-foreground">Ou preencher com Lead do CRM:</span>
                <Select
                  onValueChange={(leadId) => {
                    const l = leads.find((x) => x.id === leadId);
                    if (l) {
                      setTargetName(l.name.split(" ")[0]);
                      setTargetBarbershop(l.company_name);
                      if (l.phone) setTargetPhone(l.phone);
                    }
                  }}
                >
                  <SelectTrigger className="h-7 text-[11px] w-[200px]">
                    <SelectValue placeholder="Selecione um lead..." />
                  </SelectTrigger>
                  <SelectContent>
                    {leads.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.company_name} ({l.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Área de Visualização e Cópia do Texto */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-muted-foreground">Texto Formatado para o WhatsApp</span>
                <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Link de teste embutido
                </span>
              </div>
              <Textarea
                value={currentPitchText}
                readOnly
                rows={9}
                className="font-sans text-xs bg-muted/20 border text-foreground resize-none leading-relaxed"
              />
            </div>

            {/* Ações Rápidas */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(currentPitchText, "script")}
                className="text-xs h-9 font-medium"
              >
                {copiedScript ? <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                Copiar Texto Completo
              </Button>

              <div className="flex items-center gap-2">
                {onOpenProposal && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-9 border-[#FF6500]/40 text-[#FF6500] hover:bg-[#FF6500]/10"
                    onClick={() =>
                      onOpenProposal({
                        name: targetName,
                        company: targetBarbershop,
                        phone: targetPhone,
                      })
                    }
                  >
                    <FileText className="mr-1.5 h-3.5 w-3.5" />
                    Gerar Contrato Formal
                  </Button>
                )}

                <Button
                  type="button"
                  size="sm"
                  onClick={handleSendWhatsApp}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 font-bold shadow-md shadow-emerald-600/20"
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Abrir no WhatsApp do Barbeiro
                </Button>
              </div>
            </div>
          </div>

          {/* Card / Banner Promocional Visual (Imprimível e Compartilhável) */}
          <div
            id="printable-promo-banner"
            className="rounded-2xl border-2 border-zinc-800 bg-zinc-950 p-6 text-white shadow-2xl space-y-5 print:border-black print:text-black print:bg-white"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <img
                  src="/assets/aistudio/avatar_9eef1d34.png"
                  alt="NEXADASH — Sistemas Inteligentes"
                  className="h-12 w-12 rounded-xl object-contain bg-white p-1 shadow-sm shrink-0"
                />
                <div>
                  <span className="font-display font-black text-xl tracking-wider text-white print:text-black">
                    NEXA<span className="text-[#FF6500]">DASH</span>
                  </span>
                  <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider print:text-zinc-600">
                    Sistemas Inteligentes · Belezi Módulo Barbearia
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge className="bg-[#FF6500] text-white text-[10px] font-bold uppercase">
                  DEMONSTRAÇÃO DISPONÍVEL
                </Badge>
                <p className="text-[10px] text-zinc-400 mt-1 print:text-zinc-600">Teste sem custo nem senha</p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-display text-xl sm:text-2xl font-black text-white leading-tight print:text-black">
                PARE DE PAGAR TAXA POR AGENDAMENTO. TENHA O APLICATIVO DA SUA PRÓPRIA BARBEARIA.
              </h4>
              <p className="text-xs text-zinc-300 leading-relaxed print:text-zinc-700">
                O Belezi é a plataforma definitiva desenvolvida pela NEXADASH para barbearias de alta performance:
                comandas digitais, rateio de comissões instantâneo por barbeiro e App PWA exclusivo com o nome do seu salão.
              </p>
            </div>

            {/* Grid de 4 Benefícios Reais */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-zinc-900/90 border border-zinc-800 p-3 space-y-1 print:bg-zinc-100 print:border-zinc-300">
                <div className="flex items-center gap-1.5 text-[#FF6500] font-bold">
                  <Smartphone className="h-4 w-4" /> App do Cliente Próprio
                </div>
                <p className="text-[11px] text-zinc-400 print:text-zinc-600">
                  Seus clientes agendam pelo celular sem baixar da loja e sem ver concorrentes.
                </p>
              </div>

              <div className="rounded-xl bg-zinc-900/90 border border-zinc-800 p-3 space-y-1 print:bg-zinc-100 print:border-zinc-300">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <Scissors className="h-4 w-4" /> Zero Comissão por Corte
                </div>
                <p className="text-[11px] text-zinc-400 print:text-zinc-600">
                  Chega de pagar R$ 1 ou R$ 2 por corte pro Booksy ou Trinks. Faturamento 100% seu.
                </p>
              </div>

              <div className="rounded-xl bg-zinc-900/90 border border-zinc-800 p-3 space-y-1 print:bg-zinc-100 print:border-zinc-300">
                <div className="flex items-center gap-1.5 text-blue-400 font-bold">
                  <TrendingUp className="h-4 w-4" /> Rateio de Comissões
                </div>
                <p className="text-[11px] text-zinc-400 print:text-zinc-600">
                  Cálculo automático de comissão por profissional sem erros ou planilhas confusas.
                </p>
              </div>

              <div className="rounded-xl bg-zinc-900/90 border border-zinc-800 p-3 space-y-1 print:bg-zinc-100 print:border-zinc-300">
                <div className="flex items-center gap-1.5 text-purple-400 font-bold">
                  <ShieldCheck className="h-4 w-4" /> Termo de Adesão Seguro
                </div>
                <p className="text-[11px] text-zinc-400 print:text-zinc-600">
                  Contrato jurídico formal com garantia de suporte técnico prioritário NEXADASH.
                </p>
              </div>
            </div>

            {/* Rodapé do Banner com Chamada de Ação e Link de Teste */}
            <div className="rounded-xl bg-gradient-to-r from-[#FF6500]/20 to-transparent border border-[#FF6500]/40 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#FF8C38] tracking-wider block">
                  Acesse agora pelo celular ou computador
                </span>
                <p className="font-mono text-xs font-bold text-white break-all print:text-black">
                  {demoDirectLink}
                </p>
                <p className="text-[10px] text-zinc-400 print:text-zinc-600">
                  Clique ou aponte a câmera para iniciar o teste da barbearia imediatamente.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Button
                  size="sm"
                  asChild
                  className="bg-[#FF6500] hover:bg-[#E55B00] text-white font-bold text-xs h-9 print:hidden"
                >
                  <a href={demoDirectLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Abrir Demonstração
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
