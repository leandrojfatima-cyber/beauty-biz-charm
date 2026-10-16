import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db } from "@/lib/db";
import { useSalon } from "@/lib/whatsapp";

export const Route = createFileRoute("/_authenticated/salao")({
  head: () => ({
    meta: [
      { title: "Dados do salão — Belezi" },
      { name: "description", content: "Gerencie dados do salão do seu salão no Belezi." },
      { property: "og:title", content: "Dados do salão — Belezi" },
      { property: "og:description", content: "Gerencie dados do salão do seu salão no Belezi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalaoPage,
});

function SalaoPage() {
  const qc = useQueryClient();
  const { data } = useSalon();
  const [f, setF] = useState({ name: "", address: "", maps_link: "" });
  useEffect(() => {
    if (data) setF(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: me } = await db.auth.getUser();
      const { error } = await db
        .from("salon_settings")
        .upsert(
          { ...f, owner_id: me.user.id, updated_at: new Date().toISOString() },
          { onConflict: "owner_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["salon-settings"] });
      toast.success("Dados salvos");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="max-w-xl">
      <PageHeader
        title="Dados do salão"
        subtitle="Usados nas mensagens de WhatsApp para os clientes"
      />
      <div className="grid gap-4 rounded-lg border bg-card p-5">
        <div>
          <Label className="mb-1.5 block">Nome do salão</Label>
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div>
          <Label className="mb-1.5 block">Endereço</Label>
          <Input
            value={f.address}
            placeholder="Rua, número, bairro, cidade"
            onChange={(e) => setF({ ...f, address: e.target.value })}
          />
        </div>
        <div>
          <Label className="mb-1.5 block">Link do mapa (opcional)</Label>
          <Input
            value={f.maps_link}
            placeholder="https://maps.google.com/..."
            onChange={(e) => setF({ ...f, maps_link: e.target.value })}
          />
        </div>
        <div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
