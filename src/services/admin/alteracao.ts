import { gravarEmSerie, type Consultar, type Tx } from "../transacao";
import { registrarAuditoria, type Ator } from "./auditoria";

// O que muda numa alteração do painel: montado a partir do que está no banco
// AGORA (dentro da transação), para o "antes" do registro ser o valor real.
export type Plano = {
  nomeDoAlvo: string;
  sets: string[]; // ex.: ["PERMAPO_RECURSO = ?"]
  params: unknown[];
  antes: Record<string, unknown>;
  depois: Record<string, unknown>;
};

export type OpcoesDeAlteracao = {
  ator: Ator;
  acao: string; // ex.: "consultor.atualizar"
  alvo: { tipo: "consultor" | "tarefa"; codigo: number };
  // tabela/coluna vêm de constantes do código, nunca de entrada do usuário
  tabela: string;
  colunaChave: string;
  // Lê o registro atual e devolve o plano. Lança ErroDeRegra se ele não existe;
  // devolve null (ou sets vazio) se nada precisa mudar.
  planejar: (tx: Tx) => Promise<Plano | null>;
  // Depois do commit: o banco realmente ficou com os valores pedidos?
  confirmar: (consultar: Consultar) => Promise<boolean>;
};

function mensagemCurta(erro: unknown): string {
  return (erro instanceof Error ? erro.message : String(erro)).replace(/\s+/g, " ").slice(0, 200);
}

// Fecha, sem nunca atrapalhar a resposta, as linhas de auditoria de uma alteração.
async function fecharRegistro(ator: Ator, ref: string, resultado: "confirmada" | "falhou", erro?: string): Promise<void> {
  try {
    await registrarAuditoria({ tipo: "confirmacao", ator, ref, resultado, ...(erro ? { erro } : {}) });
  } catch (falha) {
    console.error("[auditoria] não foi possível registrar o desfecho:", mensagemCurta(falha));
  }
}

// O jeito único de o painel gravar:
//   1. na fila de gravações (uma por vez) e em transação;
//   2. monta o plano a partir do valor atual; se nada muda, não grava nem registra;
//   3. faz o UPDATE e escreve a linha de auditoria AINDA DENTRO da transação: se
//      o registro não puder ser escrito, a transação desfaz e nada muda;
//   4. depois do commit confere no banco e fecha o registro como "confirmada"
//      (ou "falhou", se algo deu errado).
export async function alterarComAuditoria(opcoes: OpcoesDeAlteracao): Promise<{ alterou: boolean }> {
  const { ator, acao, alvo, tabela, colunaChave } = opcoes;
  const pendentes: string[] = [];
  let alterou = false;

  try {
    await gravarEmSerie(
      async (tx) => {
        alterou = false;

        const plano = await opcoes.planejar(tx);
        if (!plano || plano.sets.length === 0) return;

        await tx.executar(`UPDATE ${tabela} SET ${plano.sets.join(", ")} WHERE ${colunaChave} = ?`, [...plano.params, alvo.codigo]);

        pendentes.push(
          await registrarAuditoria({
            tipo: "alteracao",
            ator,
            acao,
            alvo: { tipo: alvo.tipo, codigo: alvo.codigo, nome: plano.nomeDoAlvo },
            antes: plano.antes,
            depois: plano.depois,
          }),
        );
        alterou = true;
      },
      { confirmar: async (_resultado, consultar) => !alterou || (await opcoes.confirmar(consultar)) },
    );
  } catch (erro) {
    for (const hash of pendentes) await fecharRegistro(ator, hash, "falhou", mensagemCurta(erro));
    throw erro;
  }

  // a última tentativa foi a que valeu; as anteriores (se houve) foram refeitas
  for (let i = 0; i < pendentes.length; i++) {
    const ultima = i === pendentes.length - 1;
    await fecharRegistro(ator, pendentes[i], ultima ? "confirmada" : "falhou", ultima ? undefined : "tentativa refeita");
  }

  return { alterou };
}
