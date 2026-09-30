const FUSO = "America/Sao_Paulo";

// Data (YYYY-MM-DD) e hora (HH:MM) de agora no fuso de Brasília -- usado igual
// na tela e no servidor, pra não depender do fuso da máquina nem do UTC (o
// toISOString vira o dia às 21h, horário de Brasília).
export function agoraNoFuso(agora: Date = new Date()): {
  data: string;
  hora: string;
} {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(agora);

  const get = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";

  return {
    data: `${get("year")}-${get("month")}-${get("day")}`,
    hora: `${get("hour")}:${get("minute")}`,
  };
}

// Apontamento "no futuro": data depois de hoje, ou hoje com hora inicial ou
// final depois do horário atual. Horas no formato "HH:MM".
export function apontamentoNoFuturo(
  date: string,
  startTime: string,
  endTime: string,
  agora: Date = new Date(),
): boolean {
  const { data, hora } = agoraNoFuso(agora);
  const dia = date.slice(0, 10);

  if (dia > data) return true;
  if (dia < data) return false;

  return startTime > hora || endTime > hora;
}

export const MENSAGEM_HORARIO_FUTURO =
  "Não é possível apontar horas que ainda não aconteceram. Escolha um horário até o momento atual.";
