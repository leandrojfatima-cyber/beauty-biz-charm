import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { logAudit } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Belezi" },
      { name: "description", content: "Acesse o sistema de gestão do seu salão." },
      { property: "og:title", content: "Entrar — Belezi" },
      { property: "og:description", content: "Acesse o sistema de gestão do seu salão." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await logAudit("Entrou no sistema", "E-mail e senha");
        navigate({ to: "/painel" });
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/painel" } });
        if (error) throw error;
        if (data.session) navigate({ to: "/painel" });
        else toast.success("Conta criada! Confirme pelo link enviado ao seu e-mail.");
      }
    } catch (err: any) {
      toast.error(err.message === "Invalid login credentials" ? "E-mail ou senha incorretos" : err.message);
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) { toast.error("Não foi possível entrar com Google"); return; }
    if (r.redirected) return;
    await logAudit("Entrou no sistema", "Google");
    navigate({ to: "/painel" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8">
        <h1 className="text-2xl font-semibold">Belezi<span className="text-primary">.</span></h1>
        <p className="mb-6 text-sm text-muted-foreground">{mode === "in" ? "Entre na sua conta" : "Crie a conta do salão"}</p>
        <form onSubmit={submit} className="space-y-4">
          <div><Label className="mb-1.5 block">E-mail</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label className="mb-1.5 block">Senha</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <Button className="w-full" disabled={loading}>{mode === "in" ? "Entrar" : "Criar conta"}</Button>
        </form>
        <Button variant="outline" className="mt-3 w-full" onClick={google}>Continuar com Google</Button>
        <button className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
        </button>
        <p className="mt-6 text-center text-xs text-muted-foreground">Belezi © 2026 · NEXADASH</p>
      </div>
    </div>
  );
}
