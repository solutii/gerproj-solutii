import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Cache novo por teste: sem repetição em erro e sem guardar dados depois de desmontar.
export function clienteParaTeste(opcoes: ConstructorParameters<typeof QueryClient>[0] = {}) {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    ...opcoes,
  });
}

// Deixa as buscas do Query terminarem e a tela atualizar.
export async function aguardar(voltas = 5) {
  for (let i = 0; i < voltas; i++) await act(async () => new Promise((r) => setTimeout(r, 5)));
}

// Monta um componente que executa o hook e guarda o último resultado.
export function montarHook<T>(hook: () => T, cliente: QueryClient) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const raiz = createRoot(container);
  const ref: { atual: T | undefined } = { atual: undefined };

  function Teste(): ReactNode {
    ref.atual = hook();

    return null;
  }

  act(() => raiz.render(<QueryClientProvider client={cliente}><Teste /></QueryClientProvider>));

  return {
    resultado: () => ref.atual as T,
    desmontar() {
      act(() => raiz.unmount());
      container.remove();
    },
  };
}

export const respostaJson = (corpo: unknown, status = 200) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) } as Response);
