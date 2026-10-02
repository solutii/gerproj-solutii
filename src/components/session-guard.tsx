"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { useAlertStore } from "@/stores/alert-store";
import { limparCacheDoUsuario } from "@/lib/query-client";
import { limparTodosRascunhos } from "@/utils/rascunho";

function urlDaRequisicao(entrada: RequestInfo | URL): string {
  if (typeof entrada === "string") return entrada;
  if (entrada instanceof URL) return entrada.pathname;

  return entrada.url;
}

// A sessão dura 4 horas. Quando expira com a tela aberta, toda chamada à API
// passa a responder 401 e a tela ficava parada, sem explicar nada. Este
// componente observa o fetch: no primeiro 401 de uma rota /api (fora o
// /api/auth, do próprio login) avisa que a sessão expirou e leva ao login.
// Só enquanto está montado -- restaura o fetch original ao sair.
export default function SessionGuard() {
  useEffect(() => {
    const fetchOriginal = window.fetch;
    let avisado = false;

    async function sessaoExpirada() {
      await useAlertStore.getState().showConfirm(
        "Sua sessão expirou. Faça login novamente para continuar.",
        {
          title: "Sessão expirada",
          confirmText: "Ir para o login",
          cancelText: "Fechar",
        },
      );

      limparCacheDoUsuario();
      limparTodosRascunhos();
      signOut({ callbackUrl: "/login" });
    }

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const resposta = await fetchOriginal(...args);

      if (resposta.status === 401 && !avisado) {
        const url = urlDaRequisicao(args[0]);

        if (url.startsWith("/api/") && !url.startsWith("/api/auth")) {
          avisado = true;
          sessaoExpirada();
        }
      }

      return resposta;
    };

    return () => {
      window.fetch = fetchOriginal;
    };
  }, []);

  return null;
}
