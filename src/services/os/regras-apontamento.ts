import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getConnection } from "../firebird";
import { ErroDeRegra } from "../erro-regra";
import { descricaoInvalida, MENSAGEM_DESCRICAO } from "@/utils/descricao-apontamento";
import { intervaloInvalido, MENSAGEM_INTERVALO_INVALIDO } from "@/utils/intervalo-horas";
import {
  agoraNoFuso,
  apontamentoNoFuturo,
  MENSAGEM_HORARIO_FUTURO,
} from "@/utils/horario-futuro";
import {
  dataLocalISO,
  dataMinimaPermitida,
  formatarHoraBanco,
  horariosSeSobrepoem,
} from "@/utils/regras-apontamento";
import type { Tx } from "../transacao";

export const MENSAGEM_FORA_DO_PERIODO = "Selecione uma data dentro do período vigente.";

// Consultor logado, lido do JWT da sessão (nunca do corpo da requisição).
export async function recursoDaRequisicao(req: NextRequest): Promise<number> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const recurso = (token?.email as unknown as { COD_RECURSO?: number } | null)
    ?.COD_RECURSO;

  if (!recurso) throw new ErroDeRegra("Não autenticado");

  return recurso;
}

function consultar(sql: string, params: unknown[]): Promise<any[]> {
  return new Promise((resolve, reject) => {
    getConnection((err: any, db: any) => {
      if (err) return reject(err);

      db.query(sql, params, (errQuery: any, res: any) => {
        db?.detach();
        if (errQuery) return reject(errQuery);
        return resolve(res ?? []);
      });
    });
  });
}

async function dataMinima(recurso: number): Promise<string> {
  const [r] = await consultar(
    "SELECT DTLIMITE_RECURSO, PERMAPO_RECURSO FROM RECURSO WHERE COD_RECURSO = ?",
    [recurso],
  );

  return dataMinimaPermitida(
    String(r?.PERMAPO_RECURSO ?? "").trim().toUpperCase() === "SIM",
    r?.DTLIMITE_RECURSO,
    agoraNoFuso().data,
  );
}

type Apontamento = {
  recurso: number;
  date: string;
  startTime: string;
  endTime: string;
  description: string;
  // Na edição, a própria OS não conta como conflito de horário.
  ignorarCodOs?: number | string;
};

// Regras de um apontamento novo ou editado (mesmas da tela, mas valendo também
// pra quem chamar a API direto): descrição mínima, intervalo, horário no
// futuro, período vigente e conflito com outros apontamentos do consultor.
export async function validarApontamento({
  recurso,
  date,
  startTime,
  endTime,
  description,
  ignorarCodOs,
}: Apontamento): Promise<void> {
  if (descricaoInvalida(description)) throw new ErroDeRegra(MENSAGEM_DESCRICAO);

  if (!date || !startTime || !endTime) {
    throw new ErroDeRegra("Selecione uma data e hora inicial/final");
  }

  if (intervaloInvalido(startTime, endTime)) {
    throw new ErroDeRegra(MENSAGEM_INTERVALO_INVALIDO);
  }

  if (apontamentoNoFuturo(date, startTime, endTime)) {
    throw new ErroDeRegra(MENSAGEM_HORARIO_FUTURO);
  }

  const dia = date.slice(0, 10);

  if (dia < (await dataMinima(recurso))) throw new ErroDeRegra(MENSAGEM_FORA_DO_PERIODO);

  const existentes = await consultar(SQL_OS_DO_DIA, [recurso, dia]);

  lancarSeHouverConflito(existentes, { startTime, endTime, ignorarCodOs });
}

const SQL_OS_DO_DIA = "SELECT COD_OS, HRINI_OS, HRFIM_OS FROM OS WHERE CODREC_OS = ? AND DTINI_OS = ?";

function lancarSeHouverConflito(
  existentes: any[],
  { startTime, endTime, ignorarCodOs }: { startTime: string; endTime: string; ignorarCodOs?: number | string },
): void {
  const conflito = existentes.find(
    (os) =>
      String(os.COD_OS) !== String(ignorarCodOs ?? "") &&
      horariosSeSobrepoem(os.HRINI_OS, os.HRFIM_OS, startTime, endTime),
  );

  if (conflito) {
    throw new ErroDeRegra(
      `Conflito de horário: você já tem o apontamento da OS #${conflito.COD_OS} das ${formatarHoraBanco(conflito.HRINI_OS)} às ${formatarHoraBanco(conflito.HRFIM_OS)} nesta data.`,
    );
  }
}

// Mesma conferência, mas DENTRO da transação que vai gravar, logo antes do
// INSERT/UPDATE. A conferência de validarApontamento acontece antes de uma
// série de outras consultas; entre ela e a gravação dois cliques seguidos (ou
// duas abas) passariam os dois. Aqui a janela é de milissegundos e, como a
// leitura espera qualquer gravação ainda não confirmada, o segundo clique já
// enxerga o primeiro.
export async function conferirConflitoNaTransacao(
  tx: Tx,
  { recurso, date, startTime, endTime, ignorarCodOs }: Pick<Apontamento, "recurso" | "date" | "startTime" | "endTime" | "ignorarCodOs">,
): Promise<void> {
  const existentes = await tx.consultar(SQL_OS_DO_DIA, [recurso, date.slice(0, 10)]);

  lancarSeHouverConflito(existentes, { startTime, endTime, ignorarCodOs });
}

export type OsDoConsultor = {
  CODREC_OS: number;
  DTINI_OS: Date;
  CHAMADO_OS: string | null;
  CODTRF_OS: number | null;
  HRINI_OS: string;
  HRFIM_OS: string;
};

// Editar ou excluir: a OS precisa ser do consultor logado, estar dentro do
// período vigente e não ser de chamado já finalizado (a tela já esconde os
// botões fora do período, mas a API também valida). Devolve a OS lida.
export async function validarPosseOs(
  recurso: number,
  codOs: number | string,
): Promise<OsDoConsultor> {
  const [os] = await consultar(
    "SELECT CODREC_OS, DTINI_OS, CHAMADO_OS, CODTRF_OS, HRINI_OS, HRFIM_OS FROM OS WHERE COD_OS = ?",
    [codOs],
  );

  if (!os) throw new ErroDeRegra("OS não encontrada.");

  if (String(os.CODREC_OS) !== String(recurso)) {
    throw new ErroDeRegra("Você só pode alterar os seus próprios apontamentos.");
  }

  if (dataLocalISO(os.DTINI_OS) < (await dataMinima(recurso))) {
    throw new ErroDeRegra("Esta OS está fora do período vigente e não pode ser alterada.");
  }

  const codChamado = String(os.CHAMADO_OS ?? "").trim();

  if (codChamado) {
    const [chamado] = await consultar(
      "SELECT STATUS_CHAMADO FROM CHAMADO WHERE COD_CHAMADO = ?",
      [codChamado],
    );

    if (String(chamado?.STATUS_CHAMADO ?? "").trim().toUpperCase() === "FINALIZADO") {
      throw new ErroDeRegra(
        "Chamado finalizado: não é possível alterar ou excluir os apontamentos dele.",
      );
    }
  }

  return os;
}

// StandBy: o chamado precisa ser do consultor logado (confere no banco, não no
// objeto `chamado` que vem da tela).
export async function validarPosseChamado(
  recurso: number,
  codChamado: number | string,
): Promise<void> {
  const [chamado] = await consultar(
    "SELECT COD_RECURSO FROM CHAMADO WHERE COD_CHAMADO = ?",
    [codChamado],
  );

  if (!chamado) throw new ErroDeRegra("Chamado não encontrado.");

  if (String(chamado.COD_RECURSO) !== String(recurso)) {
    throw new ErroDeRegra("Este chamado não está atribuído a você.");
  }
}

// Acesso do cliente: o consultor só mexe em cliente que tenha chamado
// atribuído a ele.
export async function validarPosseCliente(
  recurso: number,
  codCliente: number | string,
): Promise<void> {
  if (codCliente === null || codCliente === undefined || codCliente === "") {
    throw new ErroDeRegra("Cliente não informado.");
  }

  const [chamado] = await consultar(
    "SELECT FIRST 1 COD_CHAMADO FROM CHAMADO WHERE COD_RECURSO = ? AND COD_CLIENTE = ?",
    [recurso, codCliente],
  );

  if (!chamado) throw new ErroDeRegra("Este cliente não possui chamados atribuídos a você.");
}
