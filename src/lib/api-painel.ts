import { apiGet } from "@/lib/api";
import type { PainelResposta } from "@/types/painel";
import type { DadosEspelho } from "@/utils/painel/espelho";

// Rotas do Meu Painel (o consultor sempre vem da sessão, nunca da URL).

type Opcoes = { signal?: AbortSignal };

export function buscarPainel(mes: string, { signal }: Opcoes = {}) {
  return apiGet<PainelResposta>(`/api/painel?mes=${encodeURIComponent(mes)}`, {
    signal,
    mensagemPadrao: "Não foi possível carregar o painel.",
  });
}

export type PendentesResposta = { hoje: string; dias: string[] };

export function buscarPendentes({ signal }: Opcoes = {}) {
  return apiGet<PendentesResposta>("/api/painel/pendentes", { signal });
}

// Dados do espelho para exportar (CSV / impressão).
export function buscarEspelho(mes: string) {
  return apiGet<DadosEspelho>(`/api/painel/espelho?mes=${encodeURIComponent(mes)}`, {
    mensagemPadrao: "Não foi possível gerar o espelho.",
  });
}
