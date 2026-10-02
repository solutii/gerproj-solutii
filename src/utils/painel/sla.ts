import { dataLocalISO } from "@/utils/regras-apontamento";
import { ehDiaUtil, somarDias } from "./dias-uteis";
import { hhmmParaMinutos } from "./horas";

// Instante sem fuso: dia ("AAAA-MM-DD") + minutos desde 00:00. Evita as
// armadilhas de fuso/horário de verão ao medir tempo entre dois eventos.
export type Momento = { data: string; minutos: number };

// Expediente usado na regra de SLA (mesma do dashboard dos clientes): 8h às 18h.
export const EXPEDIENTE = { inicio: 8 * 60, fim: 18 * 60 };

// "23/09/2026 12:00" (ou só "23/09/2026") -> Momento. Inválido -> null.
export function parseDataHora(texto: string | null | undefined): Momento | null {
  const m = String(texto ?? "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!m) return null;

  return {
    data: `${m[3]}-${m[2]}-${m[1]}`,
    minutos: m[4] ? Number(m[4]) * 60 + Number(m[5]) : 0,
  };
}

// Evento do HISTCHAMADO: DATA (Date do driver ou texto) + HORA "HHMM".
export function momentoDoHistorico(data: Date | string, hhmm: string): Momento {
  return { data: dataLocalISO(data), minutos: hhmmParaMinutos(hhmm) };
}

// Horas úteis entre dois momentos: só segunda a sexta, sem feriados nacionais,
// e só dentro do expediente. Fim antes do início -> 0.
export function horasUteisEntre(
  inicio: Momento,
  fim: Momento,
  expediente: { inicio: number; fim: number } = EXPEDIENTE,
): number {
  if (fim.data < inicio.data || (fim.data === inicio.data && fim.minutos <= inicio.minutos)) {
    return 0;
  }

  let total = 0;

  for (let dia = inicio.data; dia <= fim.data; dia = somarDias(dia, 1)) {
    if (!ehDiaUtil(dia)) continue;

    const de = dia === inicio.data ? Math.max(inicio.minutos, expediente.inicio) : expediente.inicio;
    const ate = dia === fim.data ? Math.min(fim.minutos, expediente.fim) : expediente.fim;

    if (ate > de) total += ate - de;
  }

  return Math.round((total / 60) * 100) / 100;
}

export type ChamadoFinalizado = {
  codChamado: number;
  abertura: Momento;
  finalizacao: Momento;
  // SLA da tarefa, em horas úteis (0 ou nulo = sem SLA)
  slaHoras: number | null;
};

export type SlaAvaliado = { codChamado: number; horasUteis: number; slaHoras: number; cumpriu: boolean };

// Chamado sem SLA definido (nulo/0) não entra na conta.
export function avaliarSla(c: ChamadoFinalizado): SlaAvaliado | null {
  if (!c.slaHoras || c.slaHoras <= 0) return null;

  const horasUteis = horasUteisEntre(c.abertura, c.finalizacao);

  return { codChamado: c.codChamado, horasUteis, slaHoras: c.slaHoras, cumpriu: horasUteis <= c.slaHoras };
}

export type ResumoSla = {
  total: number;
  noPrazo: number;
  foraDoPrazo: number;
  percentualNoPrazo: number | null;
  tempoMedioHoras: number | null;
};

export function resumirSla(avaliados: SlaAvaliado[]): ResumoSla {
  const total = avaliados.length;
  const noPrazo = avaliados.filter((a) => a.cumpriu).length;

  return {
    total,
    noPrazo,
    foraDoPrazo: total - noPrazo,
    percentualNoPrazo: total ? Math.round((noPrazo / total) * 100) : null,
    tempoMedioHoras: total
      ? Math.round((avaliados.reduce((s, a) => s + a.horasUteis, 0) / total) * 100) / 100
      : null,
  };
}
