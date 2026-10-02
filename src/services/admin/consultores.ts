import { ErroDeRegra } from "../erro-regra";
import { consultarFora, type Consultar } from "../transacao";
import { dataLocalISO } from "@/utils/regras-apontamento";
import { hhmmParaMinutos } from "@/utils/painel/horas";
import { minutosParaHHMM } from "@/utils/painel/agenda";
import type { AlteracoesConsultor } from "@/utils/admin-validacao";
import type { ConsultorAdmin } from "@/types/admin";
import { alterarComAuditoria, type Plano } from "./alteracao";
import type { Ator } from "./auditoria";

// Consultores (tabela RECURSO) no painel de administração.
// Só mexe em três colunas: PERMAPO_RECURSO, DTLIMITE_RECURSO e HRDIA_RECURSO.

const COLUNAS = "R.COD_RECURSO, R.NOME_RECURSO, R.ATIVO_RECURSO, R.HRDIA_RECURSO, R.PERMAPO_RECURSO, R.DTLIMITE_RECURSO";

const texto = (v: unknown) => String(v ?? "").trim();

export function paraConsultorAdmin(linha: Record<string, any>): ConsultorAdmin {
  return {
    codigo: Number(linha.COD_RECURSO),
    nome: texto(linha.NOME_RECURSO),
    ativo: Number(linha.ATIVO_RECURSO) === 1,
    permiteApontarNoPassado: texto(linha.PERMAPO_RECURSO).toUpperCase() === "SIM",
    dataLimite: linha.DTLIMITE_RECURSO ? dataLocalISO(linha.DTLIMITE_RECURSO) : null,
    jornada: minutosParaHHMM(hhmmParaMinutos(linha.HRDIA_RECURSO)),
  };
}

// "AAAA-MM-DD" -> "DD.MM.AAAA 00:00" (formato que o Firebird aceita, igual ao das OS)
const dataParaBanco = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)} 00:00`;

export async function listarConsultores({ busca = "", somenteAtivos = true }: { busca?: string; somenteAtivos?: boolean } = {}): Promise<ConsultorAdmin[]> {
  const condicoes: string[] = [];
  const params: unknown[] = [];

  if (somenteAtivos) condicoes.push("R.ATIVO_RECURSO = 1");

  const termo = busca.trim().toUpperCase();
  if (termo) {
    condicoes.push("(UPPER(R.NOME_RECURSO) LIKE ? OR CAST(R.COD_RECURSO AS VARCHAR(12)) LIKE ?)");
    params.push(`%${termo}%`, `%${termo}%`);
  }

  const linhas = await consultarFora(
    `SELECT ${COLUNAS} FROM RECURSO R ${condicoes.length ? "WHERE " + condicoes.join(" AND ") : ""} ORDER BY R.NOME_RECURSO`,
    params,
  );

  return linhas.map(paraConsultorAdmin);
}

export async function buscarConsultor(codigo: number, consultar: Consultar = consultarFora): Promise<ConsultorAdmin | null> {
  const [linha] = await consultar(`SELECT ${COLUNAS} FROM RECURSO R WHERE R.COD_RECURSO = ?`, [codigo]);

  return linha ? paraConsultorAdmin(linha) : null;
}

// Altera o consultor e registra quem/quando/antes/depois (ver alteracao.ts).
// Devolve o consultor como ficou, ou null se o código não existe.
export async function atualizarConsultor(
  ator: Ator,
  codigo: number,
  alteracoes: AlteracoesConsultor,
): Promise<{ consultor: ConsultorAdmin; alterou: boolean } | null> {
  if (!(await buscarConsultor(codigo))) return null;

  const { alterou } = await alterarComAuditoria({
    ator,
    acao: "consultor.atualizar",
    alvo: { tipo: "consultor", codigo },
    tabela: "RECURSO",
    colunaChave: "COD_RECURSO",

    planejar: async (tx): Promise<Plano | null> => {
      const [linha] = await tx.consultar(`SELECT ${COLUNAS} FROM RECURSO R WHERE R.COD_RECURSO = ?`, [codigo]);
      if (!linha) throw new ErroDeRegra("Consultor não encontrado.");

      const atual = paraConsultorAdmin(linha);
      const plano: Plano = { nomeDoAlvo: atual.nome, sets: [], params: [], antes: {}, depois: {} };

      if (alteracoes.permiteApontarNoPassado !== undefined && (alteracoes.permiteApontarNoPassado === "SIM") !== atual.permiteApontarNoPassado) {
        plano.sets.push("PERMAPO_RECURSO = ?");
        plano.params.push(alteracoes.permiteApontarNoPassado);
        plano.antes.permiteApontarNoPassado = atual.permiteApontarNoPassado ? "SIM" : "NAO";
        plano.depois.permiteApontarNoPassado = alteracoes.permiteApontarNoPassado;
      }
      if (alteracoes.dataLimite !== undefined && alteracoes.dataLimite !== atual.dataLimite) {
        plano.sets.push("DTLIMITE_RECURSO = ?");
        plano.params.push(dataParaBanco(alteracoes.dataLimite));
        plano.antes.dataLimite = atual.dataLimite;
        plano.depois.dataLimite = alteracoes.dataLimite;
      }
      if (alteracoes.jornada !== undefined && alteracoes.jornada !== texto(linha.HRDIA_RECURSO)) {
        plano.sets.push("HRDIA_RECURSO = ?");
        plano.params.push(alteracoes.jornada);
        plano.antes.jornada = atual.jornada;
        plano.depois.jornada = `${alteracoes.jornada.slice(0, 2)}:${alteracoes.jornada.slice(2, 4)}`;
      }

      return plano;
    },

    // depois do commit: o banco ficou com o que foi pedido?
    confirmar: async (consultar) => {
      const agora = await buscarConsultor(codigo, consultar);
      if (!agora) return false;

      return (
        (alteracoes.permiteApontarNoPassado === undefined || (alteracoes.permiteApontarNoPassado === "SIM") === agora.permiteApontarNoPassado) &&
        (alteracoes.dataLimite === undefined || alteracoes.dataLimite === agora.dataLimite) &&
        (alteracoes.jornada === undefined || `${alteracoes.jornada.slice(0, 2)}:${alteracoes.jornada.slice(2, 4)}` === agora.jornada)
      );
    },
  });

  const consultor = await buscarConsultor(codigo);

  return consultor ? { consultor, alterou } : null;
}
