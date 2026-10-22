import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Smartphone,
  Share2,
  Copy,
  Check,
  QrCode,
  ExternalLink,
  MessageCircle,
  UserPlus,
  CalendarCheck,
  Sparkles,
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

export function ClientAppAcquisitionCard() {
  const [copied, setCopied] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);

  const getBookingUrl = () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/agendar`;
    }
    return "https://belezi.com/agendar";
  };

  const bookingUrl = getBookingUrl();

  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      toast.success("Link do App do Cliente copiado com sucesso!", {
        description: "Envie para clientes potenciais no WhatsApp ou divulgue no Instagram.",
      });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Não foi possível copiar o link automaticamente.");
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `Olá! Agora você pode agendar seu horário conosco com muito mais rapidez e comodidade através do nosso aplicativo exclusivo.\n\nEscolha seu barbeiro favorito, o serviço e o melhor horário em poucos segundos com confirmação imediata:\n👉 ${bookingUrl}\n\nEsperamos você!`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(
    bookingUrl
  )}`;

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:p-5 shadow-sm transition-all hover:border-primary/50">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
              <Smartphone className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-base font-bold text-foreground">
                  App de Agendamento do Cliente (PWA)
                </h3>
                <Badge variant="secondary" className="bg-primary/15 text-primary text-[10px] font-semibold border-primary/30">
                  Captação & Autoagendamento
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-2xl">
                Envie este aplicativo para seus clientes e potenciais clientes. Eles realizam o cadastro, escolhem barbeiro e horário em tempo real e podem instalar o ícone da sua barbearia direto na tela do celular.
              </p>
            </div>
          </div>

          {/* Ações Rápidas de Compartilhamento */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyLink}
              className="h-9 gap-1.5 text-xs font-semibold"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado!" : "Copiar Link"}
            </Button>

            <Button
              size="sm"
              onClick={handleShareWhatsApp}
              className="h-9 gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <MessageCircle className="h-4 w-4" />
              Enviar no WhatsApp
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setQrModalOpen(true)}
              className="h-9 gap-1.5 text-xs font-medium"
            >
              <QrCode className="h-4 w-4 text-muted-foreground" />
              QR Code
            </Button>

            <Button
              size="sm"
              asChild
              variant="ghost"
              className="h-9 gap-1.5 text-xs text-primary hover:text-primary hover:bg-primary/10"
            >
              <Link to="/agendar" target="_blank">
                <ExternalLink className="h-4 w-4" />
                Abrir App
              </Link>
            </Button>
          </div>
        </div>

        {/* Rodapé do Card com métricas e dicas de captação */}
        <div className="mt-3.5 pt-3 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1 text-foreground/80 font-medium">
              <UserPlus className="h-3.5 w-3.5 text-primary" />
              Captação de novos clientes via link
            </span>
            <span className="flex items-center gap-1 text-foreground/80 font-medium">
              <CalendarCheck className="h-3.5 w-3.5 text-emerald-500" />
              Agendamentos integrados à sua agenda
            </span>
            <span className="flex items-center gap-1 text-foreground/80 font-medium">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Sem comissão por agendamento
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground">
            <span className="truncate max-w-[220px] sm:max-w-xs">{bookingUrl}</span>
          </div>
        </div>
      </div>

      {/* Modal de QR Code para Balcão / Espelho da Barbearia */}
      <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2 text-lg">
              <QrCode className="h-5 w-5 text-primary" />
              QR Code para Agendamentos
            </DialogTitle>
            <DialogDescription className="text-xs">
              Imprima ou exiba este QR Code na recepção e nos espelhos. Os clientes escaneiam com a câmera do celular e acessam seu app instantaneamente.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 flex flex-col items-center justify-center">
            <div className="rounded-2xl border-4 border-primary/20 bg-white p-4 shadow-md">
              <img
                src={qrImageUrl}
                alt="QR Code de Agendamento Online"
                className="h-56 w-56 rounded-lg object-contain"
              />
            </div>
            <p className="mt-3 text-xs font-semibold text-foreground">
              Link de Agendamento:
            </p>
            <p className="text-[11px] font-mono text-muted-foreground break-all px-4">
              {bookingUrl}
            </p>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="w-full sm:w-auto text-xs"
              onClick={handleCopyLink}
            >
              {copied ? <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-500" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
              {copied ? "Link Copiado!" : "Copiar Link"}
            </Button>
            <Button
              className="w-full sm:w-auto text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleShareWhatsApp}
            >
              <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
              Divulgar no WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
