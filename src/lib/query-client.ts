import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";

// Tempo em que um dado é considerado "fresco": dentro dele, trocar de aba,
// reabrir uma tela ou remontar um componente NÃO faz nova requisição. Passado
// o tempo, o dado antigo continua na tela e é atualizado em segundo plano
// quando a tela é usada de novo (voltar para a janela, remontar).
export const STALE_PADRAO_MS = 60_000;

// Erros 4xx (sessão, permissão, parâmetro) não melhoram repetindo -- só falha de
// rede e erro 5xx merecem uma nova tentativa, e uma só.
export function tentarDeNovo(tentativas: number, erro: unknown): boolean {
  if (erro instanceof ApiError && erro.status >= 400 && erro.status < 500) return false;

  return tentativas < 1;
}

export function criarQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_PADRAO_MS,
        gcTime: 5 * 60_000,
        retry: tentarDeNovo,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      // gravação nunca é repetida sozinha (poderia duplicar um apontamento)
      mutations: { retry: false },
    },
  });
}

let clienteDoNavegador: QueryClient | undefined;

// Um único cliente por aba do navegador. No servidor (renderização) cada
// chamada recebe um novo, para nunca misturar dados de usuários diferentes.
export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") return criarQueryClient();

  clienteDoNavegador ??= criarQueryClient();

  return clienteDoNavegador;
}

// Logout / sessão expirada: nada do usuário anterior pode ficar no cache.
export function limparCacheDoUsuario(): void {
  clienteDoNavegador?.clear();
}
