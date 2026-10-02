import type { DashboardResposta } from "@/types/admin-dashboard";

// Cache curto (em memória) do dashboard: vários administradores abrindo a página ao
// mesmo tempo, ou trocando de aba, não repetem as consultas. Só uma consulta por mês
// fica em andamento de cada vez; falha nunca fica guardada. Qualquer alteração feita
// pelo painel descarta o cache (o administrador vê o efeito na hora).

export const VALIDADE_DO_CACHE_MS = 2 * 60 * 1000;
const MAX_MESES_GUARDADOS = 12;

type Entrada = { quando: number; valor: DashboardResposta };

export function criarCacheDoDashboard(
  montar: (mes: string) => Promise<DashboardResposta>,
  validadeMs: number = VALIDADE_DO_CACHE_MS,
  relogio: () => number = () => Date.now(),
) {
  const guardados = new Map<string, Entrada>();
  const emAndamento = new Map<string, Promise<DashboardResposta>>();
  // sobe a cada descarte: um cálculo que começou antes de uma alteração não pode ser guardado
  let geracao = 0;

  async function obter(mes: string, { atualizar = false }: { atualizar?: boolean } = {}): Promise<DashboardResposta> {
    const guardado = guardados.get(mes);
    if (!atualizar && guardado && relogio() - guardado.quando < validadeMs) return guardado.valor;

    // já tem alguém calculando este mês: espera o mesmo resultado
    const pendente = emAndamento.get(mes);
    if (pendente && !atualizar) return pendente;

    const minhaGeracao = geracao;
    const calculo: Promise<DashboardResposta> = montar(mes)
      .then((valor) => {
        if (minhaGeracao === geracao) {
          guardados.delete(mes);
          guardados.set(mes, { quando: relogio(), valor });
          // descarta os mais antigos (a ordem de inserção do Map é a de gravação)
          while (guardados.size > MAX_MESES_GUARDADOS) guardados.delete(guardados.keys().next().value as string);
        }

        return valor;
      })
      .finally(() => {
        if (emAndamento.get(mes) === calculo) emAndamento.delete(mes);
      });

    emAndamento.set(mes, calculo);

    return calculo;
  }

  function descartar() {
    geracao++;
    guardados.clear();
    emAndamento.clear();
  }

  return { obter, descartar };
}

// A consulta ao banco só é carregada quando alguém realmente pede o dashboard.
const cache = criarCacheDoDashboard(async (mes) => (await import("./dashboard")).montarDashboard(mes));

export const dashboardComCache = cache.obter;
export const descartarCacheDoDashboard = cache.descartar;
