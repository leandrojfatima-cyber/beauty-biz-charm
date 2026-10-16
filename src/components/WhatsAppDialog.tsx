import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { logAudit } from "@/lib/audit";
import { buildMessage, useSalon, waLink, waPhone, type MsgKind } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

const kinds: { key: MsgKind; label: string }[] = [
  { key: "confirmacao", label: "Confirmação" },
  { key: "lembrete", label: "Lembrete" },
  { key: "endereco", label: "Endereço" },
];

export type WaAppointment = {
  startsAt: string;
  client?: string | undefined;
  phone?: string | null | undefined;
  service?: string | undefined;
  professional?: string | undefined;
};

export function WhatsAppDialog({
  appt,
  onClose,
}: {
  appt: WaAppointment | null;
  onClose: () => void;
}) {
  const { data: salon } = useSalon();
  const [kind, setKind] = useState<MsgKind>("confirmacao");
  const [text, setText] = useState("");

  useEffect(() => {
    if (!appt || !salon) return;
    setText(buildMessage(kind, { ...appt, startsAt: appt.startsAt, salon }));
  }, [appt, kind, salon]);

  useEffect(() => {
    if (appt) setKind("confirmacao");
  }, [appt]);

  const phone = waPhone(appt?.phone);
  const noAddress = salon && !salon.address && !salon.maps_link;

  function send() {
    if (!appt) return;
    window.open(waLink(phone, text), "_blank", "noopener,noreferrer");
    logAudit(
      "Abriu mensagem de WhatsApp",
      `${kinds.find((k) => k.key === kind)?.label} · ${appt.client ?? "cliente"}`,
    );
    toast.success("WhatsApp aberto — confira e envie a mensagem por lá.");
  }

  return (
    <Dialog open={!!appt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mensagem para {appt?.client ?? "o cliente"}</DialogTitle>
          <DialogDescription>
            A mensagem é montada aqui; você confere e envia manualmente no WhatsApp.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          {kinds.map((k) => (
            <button
              key={k.key}
              onClick={() => setKind(k.key)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm",
                kind === k.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
        <Textarea rows={9} value={text} onChange={(e) => setText(e.target.value)} />
        {!phone && (
          <p className="text-sm text-destructive">
            Este cliente não tem telefone válido cadastrado. Você poderá escolher o contato direto
            no WhatsApp.
          </p>
        )}
        {noAddress && (
          <p className="text-sm text-muted-foreground">
            Dica: cadastre o endereço em{" "}
            <Link to="/salao" className="text-primary underline">
              Dados do salão
            </Link>{" "}
            para ele entrar nas mensagens.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={send} disabled={!text.trim()}>
            <MessageCircle className="mr-1 h-4 w-4" />
            Enviar pelo WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
