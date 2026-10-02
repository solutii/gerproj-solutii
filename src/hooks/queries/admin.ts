"use client";

import { useEffect } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  atualizarConsultorAdmin,
  atualizarTarefaAdmin,
  buscarConsultoresAdmin,
  buscarDashboardAdmin,
  buscarPainelDoConsultorAdmin,
  buscarHistoricoAdmin,
  buscarTarefasAdmin,
} from "@/lib/api-admin";
import type { AlteracaoConsultor, AlteracaoTarefa } from "@/types/admin";

// Painel de administração: o administrador é um só "usuário" da tela, então as
// chaves não precisam do consultor. O cache é limpo no logout (query-client).
const GRUPO = ["admin"] as const;

export const chavesAdmin = {
  consultores: (busca: string, ativos: boolean) => [...GRUPO, "consultores", busca, ativos] as const,
  tarefas: (busca: string, ativas: boolean, pagina: number) => [...GRUPO, "tarefas", busca, ativas, pagina] as const,
  historico: (mes: string, busca: string) => [...GRUPO, "historico", mes, busca] as const,
  dashboard: (mes: string) => [...GRUPO, "dashboard", mes] as const,
  painelDoConsultor: (codigo: number, mes: string) => [...GRUPO, "painel-do-consultor", codigo, mes] as const,
};

export function useConsultoresAdmin(busca: string, somenteAtivos: boolean) {
  return useQuery({
    queryKey: chavesAdmin.consultores(busca, somenteAtivos),
    queryFn: () => buscarConsultoresAdmin(busca, somenteAtivos),
    placeholderData: keepPreviousData,
  });
}

export function useTarefasAdmin(busca: string, somenteAtivas: boolean, pagina: number) {
  return useQuery({
    queryKey: chavesAdmin.tarefas(busca, somenteAtivas, pagina),
    queryFn: () => buscarTarefasAdmin(busca, somenteAtivas, pagina),
    placeholderData: keepPreviousData,
  });
}

export function useHistoricoAdmin(mes: string, busca: string) {
  return useQuery({
    queryKey: chavesAdmin.historico(mes, busca),
    queryFn: () => buscarHistoricoAdmin(mes, busca),
    placeholderData: keepPreviousData,
  });
}

// De quanto em quanto tempo o dashboard se atualiza sozinho (com a aba visível).
export const INTERVALO_DO_DASHBOARD_MS = 5 * 60_000;

// Dashboard: se atualiza sozinho a cada 5 minutos, CONTADOS DA ÚLTIMA BUSCA (seja a automática,
// o clique no selo ou a volta à janela): cada busca reinicia a contagem, e é o mesmo instante
// que a barra do selo usa para mostrar quanto falta. Com a aba do navegador escondida a busca
// é pulada; ao voltar à janela, o TanStack atualiza se já passou de 5 minutos.
// `ativo` = falso quando outra aba do painel está na tela: aí não busca nada.
// O selo do cabeçalho chama `atualizar` para buscar na hora, ignorando o cache do servidor.
export function useDashboardAdmin(mes: string, ativo: boolean = true) {
  const qc = useQueryClient();
  const consulta = useQuery({
    queryKey: chavesAdmin.dashboard(mes),
    queryFn: () => buscarDashboardAdmin(mes),
    staleTime: INTERVALO_DO_DASHBOARD_MS,
    enabled: ativo,
    placeholderData: keepPreviousData,
  });

  // busca de novo ignorando o cache do servidor e põe o resultado na tela
  const atualizar = useMutation({
    mutationFn: () => buscarDashboardAdmin(mes, true),
    onSuccess: (dados) => qc.setQueryData(chavesAdmin.dashboard(mes), dados),
  });

  // instante (ms) da última busca concluída, com sucesso ou com erro; nulo enquanto carrega
  // (ou enquanto mostra o mês anterior à espera do novo)
  const ultimaBuscaEm = consulta.isPlaceholderData ? null : Math.max(consulta.dataUpdatedAt, consulta.errorUpdatedAt) || null;
  const { refetch } = consulta;

  useEffect(() => {
    if (!ativo || ultimaBuscaEm === null) return;

    const falta = Math.max(0, ultimaBuscaEm + INTERVALO_DO_DASHBOARD_MS - Date.now());
    const relogio = window.setTimeout(() => {
      if (document.visibilityState !== "hidden") void refetch();
    }, falta);

    return () => window.clearTimeout(relogio);
  }, [ativo, ultimaBuscaEm, refetch]);

  return { consulta, atualizar, ultimaBuscaEm };
}

export function usePainelDoConsultorAdmin(codigo: number | null, mes: string) {
  return useQuery({
    queryKey: chavesAdmin.painelDoConsultor(codigo ?? 0, mes),
    queryFn: () => buscarPainelDoConsultorAdmin(codigo as number, mes),
    enabled: codigo !== null,
    staleTime: 5 * 60_000,
  });
}

// Depois de salvar, as listas e o histórico ficam "velhos" e são buscados de novo
// (só os que estão na tela).
export function useAtualizarConsultorAdmin() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ codigo, alteracao }: { codigo: number; alteracao: AlteracaoConsultor }) => atualizarConsultorAdmin(codigo, alteracao),
    onSuccess: () => void qc.invalidateQueries({ queryKey: GRUPO }),
  });
}

export function useAtualizarTarefaAdmin() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ codigo, alteracao }: { codigo: number; alteracao: AlteracaoTarefa }) => atualizarTarefaAdmin(codigo, alteracao),
    onSuccess: () => void qc.invalidateQueries({ queryKey: GRUPO }),
  });
}
