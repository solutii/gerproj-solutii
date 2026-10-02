"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useHomeStore } from "@/stores/home-store";
import {
  buscarAreas,
  buscarChamados,
  buscarOs,
  buscarPeriodo,
  buscarTarefas,
  type AlvoOs,
} from "@/lib/api-home";
import { buscarPainel, buscarPendentes } from "@/lib/api-painel";
import { calcularLimiteApontamento } from "@/utils/limite-apontamento";
import { conflitoDoIntervalo, intervalosOcupados } from "@/utils/horarios-ocupados";
import { chaves } from "./chaves";

const MINUTO = 60_000;

// De quanto em quanto tempo a lista de chamados é conferida (aba visível).
export const INTERVALO_CHAMADOS_MS = 3 * MINUTO;

// As buscas NÃO usam AbortSignal de propósito: se o usuário sai da tela antes da
// resposta chegar (ou o React remonta o componente em desenvolvimento), a
// requisição já saiu e o servidor já está trabalhando -- cancelar só faria o
// Query repetir a mesma busca quando a tela voltasse. Deixando terminar, a
// resposta cai no cache e a tela, ao voltar, a encontra pronta.

// Consultor logado (vem da sessão do next-auth). Sem ele nenhuma busca roda.
export function useRecurso(): number | string | undefined {
  const { data: session } = useSession();

  return session?.user?.recurso;
}

export function useChamados() {
  const recurso = useRecurso();

  return useQuery({
    queryKey: chaves.chamados(recurso),
    queryFn: () => buscarChamados(recurso!),
    enabled: recurso !== undefined,
    // Chegada de chamado novo sem recarregar a página: confere de tempos em
    // tempos, SÓ com a aba do navegador visível (em segundo plano o Query pausa).
    refetchInterval: INTERVALO_CHAMADOS_MS,
  });
}

export function useTarefas() {
  const recurso = useRecurso();

  return useQuery({
    queryKey: chaves.tarefas(recurso),
    queryFn: () => buscarTarefas(recurso!),
    enabled: recurso !== undefined,
  });
}

// Qual lista de OS está na tela, a partir do que está selecionado: chamado,
// tarefa ou (sem seleção) a data do filtro. Nada selecionado = nenhuma lista.
export function alvoDasOs(selecao: {
  selectedCall: { COD_CHAMADO: number } | null;
  selectedProj: { COD_TAREFA: number | string } | null;
  selectedDate: string;
}): AlvoOs | null {
  if (selecao.selectedCall) return { tipo: "chamado", codigo: selecao.selectedCall.COD_CHAMADO };
  if (selecao.selectedProj) return { tipo: "tarefa", codigo: selecao.selectedProj.COD_TAREFA };
  if (selecao.selectedDate) return { tipo: "data", data: selecao.selectedDate };

  return null;
}

// Lista de OS exibida na Home. Voltar a uma seleção já vista mostra a lista na
// hora (cache); ela só é buscada de novo quando fica velha ou é invalidada por
// uma gravação.
export function useOsLista() {
  const recurso = useRecurso();
  const selectedCall = useHomeStore((s) => s.selectedCall);
  const selectedProj = useHomeStore((s) => s.selectedProj);
  const selectedDate = useHomeStore((s) => s.selectedDate);
  const alvo = alvoDasOs({ selectedCall, selectedProj, selectedDate });

  const consulta = useQuery({
    queryKey: chaves.os(recurso, alvo),
    queryFn: () => buscarOs(alvo!, recurso!),
    enabled: recurso !== undefined && alvo !== null,
    // OS muda mais que o cadastro (outros consultores/sistemas também lançam)
    staleTime: 30_000,
  });

  return {
    lista: alvo === null ? [] : (consulta.data ?? []),
    // spinner só na primeira busca daquela lista (não a cada atualização em segundo plano)
    carregando: alvo !== null && consulta.isLoading,
    erro: alvo !== null && consulta.isError && !consulta.data ? consulta.error : null,
    recarregar: consulta.refetch,
  };
}

// Horários já ocupados por OS do consultor na data escolhida nos modais de
// apontamento (Apontamento, StandBy, Editar OS). Usa a mesma lista de OS da
// data que o filtro da Home já busca (mesma chave do cache): se ela já foi
// vista, não há requisição nova. `ativo`: só busca com o modal aberto.
export function useHorariosOcupados(ativo: boolean) {
  const recurso = useRecurso();
  const date = useHomeStore((s) => s.date);
  const hours = useHomeStore((s) => s.hours);
  const codOsEmEdicao = useHomeStore((s) => s.selectedOs?.COD_OS);
  const alvo: AlvoOs = { tipo: "data", data: date };

  const consulta = useQuery({
    queryKey: chaves.os(recurso, alvo),
    queryFn: () => buscarOs(alvo, recurso!),
    enabled: ativo && recurso !== undefined && date.length === 10,
    staleTime: 30_000,
  });

  // Na edição, a própria OS não conta como ocupada.
  const ocupados = intervalosOcupados(consulta.data ?? [], codOsEmEdicao);

  return {
    ocupados,
    conflito: conflitoDoIntervalo(hours.initial, hours.final, ocupados),
  };
}

// Primeiro dia em que o consultor pode apontar (regra em utils/limite-apontamento).
export function usePeriodoApontamento() {
  const recurso = useRecurso();

  const consulta = useQuery({
    queryKey: chaves.periodo(recurso),
    queryFn: () => buscarPeriodo(recurso!),
    enabled: recurso !== undefined,
    // cadastro quase estático: não precisa buscar ao voltar para a janela
    staleTime: 10 * MINUTO,
    refetchOnWindowFocus: false,
  });

  return { limitDate: calcularLimiteApontamento(consulta.data), carregando: consulta.isLoading };
}

export function useAreas(ativo: boolean) {
  const recurso = useRecurso();

  return useQuery({
    queryKey: chaves.areas(recurso),
    queryFn: () => buscarAreas(recurso!),
    enabled: ativo && recurso !== undefined,
    // o formulário edita uma cópia local: atualizar sozinho apagaria o que o
    // usuário acabou de marcar. Só muda após salvar (invalidação).
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function usePainelDados(mes: string) {
  const recurso = useRecurso();

  return useQuery({
    queryKey: chaves.painel(recurso, mes),
    queryFn: () => buscarPainel(mes),
    enabled: recurso !== undefined,
    // ao trocar de mês, o mês anterior continua na tela até o novo chegar
    placeholderData: keepPreviousData,
  });
}

export function usePendentes() {
  const recurso = useRecurso();

  return useQuery({
    queryKey: chaves.pendentes(recurso),
    queryFn: () => buscarPendentes(),
    enabled: recurso !== undefined,
  });
}
