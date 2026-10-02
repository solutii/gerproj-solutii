"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  alterarStatusChamado,
  anexarArquivo,
  atualizarOs,
  baixarAnexos,
  colocarEmStandby,
  excluirOs,
  iniciarChamado,
  registrarApontamento,
  salvarAcesso,
  salvarAreas,
  vincularClassificacaoAoChamado,
  vincularTarefaAoChamado,
} from "@/lib/api-home";
import { buscarEspelho } from "@/lib/api-painel";
import { grupos } from "./chaves";

// Depois de gravar, só é marcado como "velho" o que a gravação pode ter
// mudado. O Query refaz a busca apenas do que está na tela agora; o resto é
// buscado quando for aberto -- nenhuma requisição à toa. (Sem `await`: a tela
// não espera a atualização para seguir.)
export const invalidar = {
  chamados: (qc: QueryClient) => void qc.invalidateQueries({ queryKey: grupos.chamados }),
  os: (qc: QueryClient) => void qc.invalidateQueries({ queryKey: grupos.os }),
  // Meu Painel inteiro: números do mês, "Hoje", pendências e aviso de dias
  painel: (qc: QueryClient) => void qc.invalidateQueries({ queryKey: grupos.painel }),
  areas: (qc: QueryClient) => void qc.invalidateQueries({ queryKey: grupos.areas }),
};

// Marca a mutation como "trabalho na lista de OS": enquanto roda, a tabela de
// OS mostra o carregando (ver useIsMutating em OsListTable).
export const META_CARREGANDO_OS = { carregandoOs: true } as const;

export function useIniciarChamado() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (codChamado: number) => iniciarChamado(codChamado),
    onSuccess: () => {
      invalidar.chamados(qc);
      invalidar.painel(qc);
    },
  });
}

export function useAlterarStatusChamado() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: alterarStatusChamado,
    onSuccess: () => {
      invalidar.chamados(qc);
      invalidar.painel(qc);
    },
  });
}

export function useVincularTarefa() {
  // sem invalidar: o fluxo segue iniciando o chamado, que já atualiza a lista
  return useMutation({ mutationFn: vincularTarefaAoChamado, meta: META_CARREGANDO_OS });
}

export function useVincularClassificacao() {
  return useMutation({ mutationFn: vincularClassificacaoAoChamado, meta: META_CARREGANDO_OS });
}

export function useRegistrarApontamento() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: registrarApontamento,
    onSuccess: () => {
      invalidar.os(qc);
      invalidar.painel(qc);
    },
  });
}

export function useColocarEmStandby() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: colocarEmStandby,
    onSuccess: () => {
      invalidar.chamados(qc);
      invalidar.os(qc);
      invalidar.painel(qc);
    },
  });
}

export function useSalvarAcesso() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: salvarAcesso,
    onSuccess: () => invalidar.chamados(qc),
  });
}

// `recarregarChamados`: na aba Chamados a lista de chamados também é refeita
// (a contagem de OS/horas do chamado muda).
type EdicaoDeOs = { recarregarChamados: boolean };

export function useExcluirOs() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ codOs }: EdicaoDeOs & { codOs: number }) => excluirOs(codOs),
    meta: META_CARREGANDO_OS,
    onSuccess: (_resposta, { recarregarChamados }) => {
      invalidar.os(qc);
      invalidar.painel(qc);
      if (recarregarChamados) invalidar.chamados(qc);
    },
  });
}

export function useAtualizarOs() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ corpo }: EdicaoDeOs & { corpo: Record<string, unknown> }) => atualizarOs(corpo),
    onSuccess: (_resposta, { recarregarChamados }) => {
      invalidar.os(qc);
      invalidar.painel(qc);
      if (recarregarChamados) invalidar.chamados(qc);
    },
  });
}

export function useSalvarAreas() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: salvarAreas,
    onSuccess: () => invalidar.areas(qc),
  });
}

export function useAnexarArquivo() {
  return useMutation({ mutationFn: anexarArquivo });
}

export function useBaixarAnexos() {
  return useMutation({ mutationFn: baixarAnexos });
}

export function useExportarEspelho() {
  return useMutation({ mutationFn: buscarEspelho });
}
