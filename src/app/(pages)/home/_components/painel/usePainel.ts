"use client";

import { usePainelDados } from "@/hooks/queries/leituras";
import { mensagemDoErro } from "@/lib/api";

// Dados do painel para o mês pedido (cache do Query). Dentro de 1 minuto,
// trocar de aba ou de mês e voltar não busca de novo; passado isso, o painel é
// atualizado em segundo plano ao voltar para a janela ou reabrir a aba, e
// depois de qualquer apontamento (as gravações invalidam o grupo "painel").
// O mês anterior continua na tela enquanto o novo carrega.
export function usePainel(mes: string) {
  const consulta = usePainelDados(mes);

  return {
    dados: consulta.data ?? null,
    // só "carregando" de verdade (primeira busca ou troca de mês): a atualização
    // silenciosa em segundo plano não deve escurecer a tela
    carregando: consulta.isPending || consulta.isPlaceholderData,
    erro: consulta.isError ? mensagemDoErro(consulta.error, "Não foi possível carregar o painel.") : null,
    recarregar: () => void consulta.refetch(),
  };
}
