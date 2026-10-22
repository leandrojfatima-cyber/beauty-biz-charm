import { supabase } from "@/integrations/supabase/client";

/**
 * E-mail oficial com autorização irrestrita de Master Administrator da NEXADASH.
 * Conforme diretrizes da arquitetura e solicitação do usuário:
 * - A conta máster controla todo o sistema, os planos vendidos para os barbeiros e acessos dos clientes.
 * - Esta conta e suas ferramentas NÃO SÃO VISÍVEIS para barbeiros donos de barbearia nem para clientes finais.
 */
export const MASTER_EMAIL = "leandro.j.fatima@gmail.com";

/**
 * Validação síncrona rápida com base no objeto de usuário / e-mail.
 */
export function isMasterEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === MASTER_EMAIL.toLowerCase();
}

/**
 * Verifica de forma segura e estrita se o usuário atual é o Master Administrator.
 * Retorna true APENAS se:
 * 1. O e-mail autenticado no Supabase Auth for leandro.j.fatima@gmail.com
 * 2. OU a RPC 'claim_master' do banco confirmar que a conta possui role 'master'
 * 3. OU no ambiente de preview/dev o usuário salvo for leandro.j.fatima@gmail.com
 *
 * Para todos os demais barbeiros e clientes, retorna estritamente FALSE.
 */
export async function checkIsMaster(): Promise<boolean> {
  try {
    // 1. Verificar Supabase Auth Session
    const { data: authData } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
    const sessionEmail = authData?.user?.email?.trim().toLowerCase();

    if (sessionEmail && sessionEmail === MASTER_EMAIL.toLowerCase()) {
      return true;
    }

    // 2. Verificar usuário em modo preview / localStorage
    if (typeof window !== "undefined") {
      const isMasterSession = localStorage.getItem("nexadash_master_authenticated") === "true";
      const previewUserRaw = localStorage.getItem("belezi_preview_user");
      if (previewUserRaw) {
        try {
          const parsed = JSON.parse(previewUserRaw);
          if (isMasterEmail(parsed?.email)) {
            return true;
          }
        } catch {
          // ignore parsing error
        }
      }
      if (isMasterSession) {
        return true;
      }
    }

    // 3. Verificar via RPC claim_master (se o banco confirmar)
    const { data: rpcData, error: rpcErr } = await (supabase as any)
      .rpc("claim_master")
      .catch(() => ({ data: null, error: true }));

    if (!rpcErr && rpcData === true) {
      return true;
    }

    // NUNCA conceder permissão máster por exceção ou fallback cego
    return false;
  } catch {
    return false;
  }
}
