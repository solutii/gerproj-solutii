import { dataLocalISO } from "@/utils/regras-apontamento";
import { avaliarSla, momentoDoHistorico, parseDataHora, type SlaAvaliado } from "@/utils/painel/sla";
import { texto } from "./db";

// Linha de HISTCHAMADO ("FINALIZADO") junto com a abertura do chamado e o SLA da tarefa.
export type EventoDeFinalizacao = {
  COD_CHAMADO: unknown;
  DATA_HISTCHAMADO: Date | string;
  HORA_HISTCHAMADO: unknown;
  DTENVIO_CHAMADO: unknown;
  SLA_TAREFA: unknown;
};

// Um chamado pode ter mais de um evento FINALIZADO (reaberto e finalizado de novo):
// vale o mais recente. Compartilhado entre o Meu Painel e o dashboard do administrador,
// para os dois mostrarem exatamente o mesmo SLA.
export function ultimasFinalizacoes<T extends EventoDeFinalizacao>(eventos: T[]): Map<number, T> {
  const porChamado = new Map<number, T>();

  for (const e of eventos) {
    const atual = porChamado.get(Number(e.COD_CHAMADO));
    const chaveNova = `${dataLocalISO(e.DATA_HISTCHAMADO)}${texto(e.HORA_HISTCHAMADO)}`;
    const chaveAtual = atual ? `${dataLocalISO(atual.DATA_HISTCHAMADO)}${texto(atual.HORA_HISTCHAMADO)}` : "";

    if (!atual || chaveNova > chaveAtual) porChamado.set(Number(e.COD_CHAMADO), e);
  }

  return porChamado;
}

// SLA do chamado finalizado; null se a abertura é ilegível ou a tarefa não tem SLA.
export function avaliarFinalizacao(codChamado: number, e: EventoDeFinalizacao): SlaAvaliado | null {
  const abertura = parseDataHora(texto(e.DTENVIO_CHAMADO));
  if (!abertura) return null;

  return avaliarSla({
    codChamado,
    abertura,
    finalizacao: momentoDoHistorico(e.DATA_HISTCHAMADO, texto(e.HORA_HISTCHAMADO)),
    slaHoras: e.SLA_TAREFA === null || e.SLA_TAREFA === undefined ? null : Number(e.SLA_TAREFA),
  });
}
