import { supabase } from "@/integrations/supabase/client";

function device() {
  if (typeof navigator === "undefined") return "—";
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac/i.test(ua) ? "Mac" : /Linux/i.test(ua) ? "Linux" : "Outro";
  const br = /Edg/i.test(ua) ? "Edge" : /Chrome/i.test(ua) ? "Chrome" : /Firefox/i.test(ua) ? "Firefox" : /Safari/i.test(ua) ? "Safari" : "Navegador";
  return `${br} · ${os}`;
}

/** Records an action in the audit trail; never blocks the UI on failure. */
export async function logAudit(action: string, details?: string) {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await (supabase as any).from("audit_logs").insert({ email: data.user.email, action, device: device(), details: details ?? null });
  } catch { /* ignore */ }
}
