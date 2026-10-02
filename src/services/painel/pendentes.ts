import { agoraNoFuso } from "@/utils/horario-futuro";
import { dataLocalISO, dataMinimaPermitida } from "@/utils/regras-apontamento";
import { somarDias } from "@/utils/painel/dias-uteis";
import { diasPendentes, JANELA_PENDENTES_DIAS } from "@/utils/painel/pendentes";
import { abrirConexao, consultar, texto } from "./db";

export type PendentesResposta = {
  hoje: string;
  // dias úteis recentes sem apontamento que ainda podem ser apontados
  dias: string[];
};

// Dados leves para o aviso da Home (uma consulta de datas, sem montar o painel).
// Só leitura; o consultor vem da sessão.
export async function montarDiasPendentes(recurso: number, agora: Date = new Date()): Promise<PendentesResposta> {
  const hoje = agoraNoFuso(agora).data;
  const desde = somarDias(hoje, -JANELA_PENDENTES_DIAS);
  const db = await abrirConexao();

  try {
    const [rec] = await consultar(
      db,
      "SELECT DTLIMITE_RECURSO, PERMAPO_RECURSO FROM RECURSO WHERE COD_RECURSO = ?",
      [recurso],
    );
    const apontarAPartirDe = dataMinimaPermitida(texto(rec?.PERMAPO_RECURSO).toUpperCase() === "SIM", rec?.DTLIMITE_RECURSO, hoje);

    const datas = await consultar(
      db,
      "SELECT DISTINCT OS.DTINI_OS FROM OS WHERE OS.CODREC_OS = ? AND OS.DTINI_OS >= ? AND OS.DTINI_OS <= ?",
      [recurso, desde, hoje],
    );

    return {
      hoje,
      dias: diasPendentes({
        hoje,
        diasComOs: datas.map((r) => dataLocalISO(r.DTINI_OS)),
        apontarAPartirDe,
      }),
    };
  } finally {
    db.detach();
  }
}
