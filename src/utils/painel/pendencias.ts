import { diasEntre } from "./dias-uteis";

// Chamado sem apontamento há mais que isso (dias corridos) aparece como parado.
export const DIAS_PARADO_LIMITE = 7;

// Tarefa com este consumo do limite mensal (ou mais) aparece como "no limite".
export const PERCENTUAL_TAREFA_NO_LIMITE = 80;

// Dias corridos desde a última atividade (0 se for hoje ou no futuro).
export function diasSemAtividade(ultimaAtividadeISO: string, hoje: string): number {
  return Math.max(0, diasEntre(ultimaAtividadeISO, hoje));
}

export function chamadoParado(
  ultimaAtividadeISO: string,
  hoje: string,
  limiteDias: number = DIAS_PARADO_LIMITE,
): boolean {
  return diasSemAtividade(ultimaAtividadeISO, hoje) > limiteDias;
}

export type SituacaoTarefa =
  | { tipo: "bloqueada" }
  | { tipo: "no-limite"; percentual: number }
  | null;

// - bloqueada: sem horas (HRREAL = 0) e sem permissão de exceder -> apontar é recusado;
// - no-limite: limite mensal (LIMMES > 0) com consumo >= 80% e sem permissão de exceder;
// - null: nada a avisar.
// `permiteExceder` = PERIMP_TAREFA "SIM": o limite nunca bloqueia, então não há o que avisar.
export function situacaoDaTarefa(params: {
  limiteMensalHoras: number | null;
  horasContratadas: number | null;
  consumoMesMin: number;
  permiteExceder: boolean;
}): SituacaoTarefa {
  const { limiteMensalHoras, horasContratadas, consumoMesMin, permiteExceder } = params;

  if (permiteExceder) return null;

  if (Number(horasContratadas ?? NaN) === 0) return { tipo: "bloqueada" };

  if (limiteMensalHoras && limiteMensalHoras > 0) {
    const percentual = Math.round((consumoMesMin / (limiteMensalHoras * 60)) * 100);

    if (percentual >= PERCENTUAL_TAREFA_NO_LIMITE) return { tipo: "no-limite", percentual };
  }

  return null;
}
