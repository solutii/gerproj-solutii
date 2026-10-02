import { ErroDeRegra } from "../erro-regra";
import { consultarFora, type Consultar } from "../transacao";
import type { AlteracoesTarefa } from "@/utils/admin-validacao";
import type { ListaDeTarefas, TarefaAdmin } from "@/types/admin";
import { alterarComAuditoria, type Plano } from "./alteracao";
import type { Ator } from "./auditoria";

// Tarefas (tabela TAREFA) no painel de administração.
// Só mexe em três colunas: PERIMP_TAREFA, LIMMES_TAREFA e HRREAL_TAREFA.

export const SELECT = `SELECT T.COD_TAREFA, T.NOME_TAREFA, T.STATUS_TAREFA, T.PERIMP_TAREFA, T.LIMMES_TAREFA, T.HRREAL_TAREFA,
                       C.NOME_CLIENTE, R.NOME_RECURSO
                  FROM TAREFA T
                  LEFT JOIN PROJETO P ON P.COD_PROJETO = T.CODPRO_TAREFA
                  LEFT JOIN CLIENTE C ON C.COD_CLIENTE = P.CODCLI_PROJETO
                  LEFT JOIN RECURSO R ON R.COD_RECURSO = T.CODREC_TAREFA`;

// Mesmo significado do comentário das OS (STATUS_CHAMADO_COD / apoint): 1 a 4
const NOMES_DE_STATUS: Record<number, string> = { 1: "Levantamento", 2: "Desenvolvimento", 3: "Teste", 4: "Concluída" };

// As tarefas que o consultor enxerga na aba Tarefas (ver services/tarefa/list.ts)
export const STATUS_ATIVOS = [1, 2, 3];

const texto = (v: unknown) => String(v ?? "").trim();
const numeroOuNulo = (v: unknown) => (v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));

export function paraTarefaAdmin(linha: Record<string, any>): TarefaAdmin {
  const status = Number(linha.STATUS_TAREFA);

  return {
    codigo: Number(linha.COD_TAREFA),
    nome: texto(linha.NOME_TAREFA),
    cliente: texto(linha.NOME_CLIENTE) || "Sem cliente",
    responsavel: texto(linha.NOME_RECURSO) || "Sem responsável",
    status,
    statusTexto: NOMES_DE_STATUS[status] ?? `Status ${status}`,
    permiteExceder: texto(linha.PERIMP_TAREFA).toUpperCase() === "SIM",
    limiteMensalHoras: numeroOuNulo(linha.LIMMES_TAREFA),
    horasContratadas: numeroOuNulo(linha.HRREAL_TAREFA),
  };
}

export const POR_PAGINA_PADRAO = 25;
export const POR_PAGINA_MAXIMO = 100;

export async function listarTarefas({
  busca = "",
  somenteAtivas = true,
  pagina = 1,
  porPagina = POR_PAGINA_PADRAO,
}: { busca?: string; somenteAtivas?: boolean; pagina?: number; porPagina?: number } = {}): Promise<ListaDeTarefas> {
  const tamanho = Math.min(Math.max(Math.trunc(porPagina) || POR_PAGINA_PADRAO, 1), POR_PAGINA_MAXIMO);
  const numeroDaPagina = Math.max(Math.trunc(pagina) || 1, 1);

  const condicoes: string[] = [];
  const params: unknown[] = [];

  // os números (status, tamanho, deslocamento) são inteiros gerados aqui, nunca texto do usuário
  if (somenteAtivas) condicoes.push(`T.STATUS_TAREFA IN (${STATUS_ATIVOS.join(", ")})`);

  const termo = busca.trim().toUpperCase();
  if (termo) {
    condicoes.push("(UPPER(T.NOME_TAREFA) LIKE ? OR UPPER(C.NOME_CLIENTE) LIKE ? OR CAST(T.COD_TAREFA AS VARCHAR(12)) LIKE ?)");
    params.push(`%${termo}%`, `%${termo}%`, `%${termo}%`);
  }

  const onde = condicoes.length ? "WHERE " + condicoes.join(" AND ") : "";

  const [contagem] = await consultarFora(
    `SELECT COUNT(*) AS N FROM TAREFA T LEFT JOIN PROJETO P ON P.COD_PROJETO = T.CODPRO_TAREFA LEFT JOIN CLIENTE C ON C.COD_CLIENTE = P.CODCLI_PROJETO ${onde}`,
    params,
  );

  const linhas = await consultarFora(
    `SELECT FIRST ${tamanho} SKIP ${(numeroDaPagina - 1) * tamanho} ${SELECT.replace(/^SELECT /, "")} ${onde} ORDER BY T.COD_TAREFA DESC`,
    params,
  );

  return { tarefas: linhas.map(paraTarefaAdmin), total: Number(contagem?.N ?? 0), pagina: numeroDaPagina, porPagina: tamanho };
}

export async function buscarTarefa(codigo: number, consultar: Consultar = consultarFora): Promise<TarefaAdmin | null> {
  const [linha] = await consultar(`${SELECT} WHERE T.COD_TAREFA = ?`, [codigo]);

  return linha ? paraTarefaAdmin(linha) : null;
}

const igual = (a: number | null, b: number | null) => (a === null || b === null ? a === b : Math.abs(a - b) < 0.005);

// Altera a tarefa e registra quem/quando/antes/depois. Devolve a tarefa como
// ficou, ou null se o código não existe.
export async function atualizarTarefa(
  ator: Ator,
  codigo: number,
  alteracoes: AlteracoesTarefa,
): Promise<{ tarefa: TarefaAdmin; alterou: boolean } | null> {
  if (!(await buscarTarefa(codigo))) return null;

  const { alterou } = await alterarComAuditoria({
    ator,
    acao: "tarefa.atualizar",
    alvo: { tipo: "tarefa", codigo },
    tabela: "TAREFA",
    colunaChave: "COD_TAREFA",

    planejar: async (tx): Promise<Plano | null> => {
      const atual = await buscarTarefa(codigo, tx.consultar);
      if (!atual) throw new ErroDeRegra("Tarefa não encontrada.");

      const plano: Plano = { nomeDoAlvo: atual.nome, sets: [], params: [], antes: {}, depois: {} };

      if (alteracoes.permiteExceder !== undefined && (alteracoes.permiteExceder === "SIM") !== atual.permiteExceder) {
        plano.sets.push("PERIMP_TAREFA = ?");
        plano.params.push(alteracoes.permiteExceder);
        plano.antes.permiteExceder = atual.permiteExceder ? "SIM" : "NAO";
        plano.depois.permiteExceder = alteracoes.permiteExceder;
      }
      if (alteracoes.limiteMensalHoras !== undefined && !igual(alteracoes.limiteMensalHoras, atual.limiteMensalHoras)) {
        plano.sets.push("LIMMES_TAREFA = ?");
        plano.params.push(alteracoes.limiteMensalHoras);
        plano.antes.limiteMensalHoras = atual.limiteMensalHoras;
        plano.depois.limiteMensalHoras = alteracoes.limiteMensalHoras;
      }
      if (alteracoes.horasContratadas !== undefined && !igual(alteracoes.horasContratadas, atual.horasContratadas)) {
        plano.sets.push("HRREAL_TAREFA = ?");
        plano.params.push(alteracoes.horasContratadas);
        plano.antes.horasContratadas = atual.horasContratadas;
        plano.depois.horasContratadas = alteracoes.horasContratadas;
      }

      return plano;
    },

    confirmar: async (consultar) => {
      const agora = await buscarTarefa(codigo, consultar);
      if (!agora) return false;

      return (
        (alteracoes.permiteExceder === undefined || (alteracoes.permiteExceder === "SIM") === agora.permiteExceder) &&
        (alteracoes.limiteMensalHoras === undefined || igual(alteracoes.limiteMensalHoras, agora.limiteMensalHoras)) &&
        (alteracoes.horasContratadas === undefined || igual(alteracoes.horasContratadas, agora.horasContratadas))
      );
    },
  });

  const tarefa = await buscarTarefa(codigo);

  return tarefa ? { tarefa, alterou } : null;
}
