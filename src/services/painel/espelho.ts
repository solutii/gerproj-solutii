import { dataLocalISO } from "@/utils/regras-apontamento";
import { duracaoOsMinutos, hhmmParaMinutos } from "@/utils/painel/horas";
import { minutosParaHHMM } from "@/utils/painel/agenda";
import { diasUteisDoMes } from "@/utils/painel/dias-uteis";
import { limitesDoMes, nomeDoMes } from "@/utils/painel/periodo";
import type { DadosEspelho, LinhaEspelho } from "@/utils/painel/espelho";
import { abrirConexao, consultar, lerTexto, texto } from "./db";

export type EspelhoResposta = DadosEspelho & { mes: string };

// Espelho de apontamentos do consultor no mês (uma linha por OS, em ordem de data
// e hora). Só leitura; o consultor vem da sessão.
export async function montarEspelho(recurso: number, mes: string): Promise<EspelhoResposta> {
  const { inicio, fim } = limitesDoMes(mes);
  const db = await abrirConexao();

  try {
    const [rec] = await consultar(db, "SELECT NOME_RECURSO, HRDIA_RECURSO FROM RECURSO WHERE COD_RECURSO = ?", [recurso]);
    const jornadaDiariaMin = hhmmParaMinutos(rec?.HRDIA_RECURSO);
    const diasUteis = diasUteisDoMes(mes).length;

    const os = await consultar(
      db,
      `SELECT OS.COD_OS, OS.DTINI_OS, OS.HRINI_OS, OS.HRFIM_OS, OS.CHAMADO_OS, OS.OBS,
              TAREFA.NOME_TAREFA, CLIENTE.NOME_CLIENTE
         FROM OS
         LEFT JOIN TAREFA ON (TAREFA.COD_TAREFA = OS.CODTRF_OS)
         LEFT JOIN PROJETO ON (PROJETO.COD_PROJETO = TAREFA.CODPRO_TAREFA)
         LEFT JOIN CLIENTE ON (CLIENTE.COD_CLIENTE = PROJETO.CODCLI_PROJETO)
        WHERE OS.CODREC_OS = ? AND OS.DTINI_OS >= ? AND OS.DTINI_OS <= ?
        ORDER BY OS.DTINI_OS, OS.HRINI_OS`,
      [recurso, inicio, fim],
    );

    const linhas: LinhaEspelho[] = await Promise.all(
      os.map(async (r) => ({
        data: dataLocalISO(r.DTINI_OS),
        inicio: minutosParaHHMM(hhmmParaMinutos(r.HRINI_OS)),
        fim: minutosParaHHMM(hhmmParaMinutos(r.HRFIM_OS)),
        minutos: duracaoOsMinutos(r.HRINI_OS, r.HRFIM_OS),
        cliente: texto(r.NOME_CLIENTE) || "Sem cliente",
        tarefa: texto(r.NOME_TAREFA) || "Sem tarefa",
        chamado: texto(r.CHAMADO_OS),
        codOs: Number(r.COD_OS),
        descricao: await lerTexto(r.OBS),
      })),
    );

    return {
      mes,
      consultor: texto(rec?.NOME_RECURSO),
      nomeMes: nomeDoMes(mes),
      linhas,
      totalMin: linhas.reduce((s, l) => s + l.minutos, 0),
      ...(jornadaDiariaMin > 0 && { meta: { jornadaDiariaMin, diasUteis, metaMesMin: jornadaDiariaMin * diasUteis } }),
    };
  } finally {
    db.detach();
  }
}
