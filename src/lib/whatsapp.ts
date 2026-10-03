import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db";

export type Salon = { name: string; address: string; maps_link: string };
export type MsgKind = "confirmacao" | "lembrete" | "endereco";

export const useSalon = () =>
  useQuery({
    queryKey: ["salon-settings"],
    queryFn: async (): Promise<Salon> => {
      const { data, error } = await db.from("salon_settings").select("*").maybeSingle();
      if (error) throw error;
      return { name: data?.name ?? "", address: data?.address ?? "", maps_link: data?.maps_link ?? "" };
    },
  });

/** Normalises a Brazilian phone to digits with country code (55). Returns "" if unusable. */
export function waPhone(raw?: string | null) {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return d.length >= 12 ? d : "";
}

export function waLink(phone: string, text: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export type MsgCtx = {
  client?: string | undefined;
  service?: string | undefined;
  professional?: string | undefined;
  startsAt: string | Date;
  salon: Salon;
};

function addressBlock(s: Salon) {
  const lines = [s.address && `📍 ${s.address}`, s.maps_link && `🗺️ ${s.maps_link}`].filter(Boolean);
  return lines.length ? lines.join("\n") : "";
}

export function buildMessage(kind: MsgKind, c: MsgCtx) {
  const d = new Date(c.startsAt);
  const day = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const hi = `Olá${c.client ? `, ${c.client.split(" ")[0]}` : ""}! 😊`;
  const salon = c.salon.name || "nosso salão";
  const what = [c.service, c.professional && `com ${c.professional}`].filter(Boolean).join(" ");
  const addr = addressBlock(c.salon);

  if (kind === "confirmacao")
    return [
      hi,
      `Seu horário no ${salon} está agendado:`,
      `📅 ${day}, às ${time}`,
      what && `💇 ${what}`,
      addr,
      "Pode confirmar sua presença respondendo SIM? Se precisar remarcar, é só avisar. 💛",
    ].filter(Boolean).join("\n");

  if (kind === "lembrete")
    return [
      hi,
      `Passando para lembrar do seu horário no ${salon}:`,
      `⏰ ${day}, às ${time}`,
      what && `💇 ${what}`,
      addr,
      "Aguardamos você! Qualquer imprevisto, nos avise com antecedência. 💛",
    ].filter(Boolean).join("\n");

  return [
    hi,
    `Segue o endereço do ${salon}:`,
    addr || "(cadastre o endereço em Dados do salão)",
    `Seu horário: ${day}, às ${time}.`,
    "Até lá! 💛",
  ].join("\n");
}
