import { agoraNoFuso } from "@/utils/horario-futuro";

export const MES_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const NOMES_MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

// Mês de hoje no fuso de Brasília, "AAAA-MM".
export function mesAtual(agora: Date = new Date()): string {
  return agoraNoFuso(agora).data.slice(0, 7);
}

// "AAAA-MM" válido, de 2000 em diante e não depois do mês atual.
export function mesValido(mes: unknown, mesCorrente: string): mes is string {
  return (
    typeof mes === "string" &&
    MES_REGEX.test(mes) &&
    mes >= "2000-01" &&
    mes <= mesCorrente
  );
}

export function mesAnterior(mes: string): string {
  const [a, m] = mes.split("-").map(Number);

  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
}

export function mesProximo(mes: string): string {
  const [a, m] = mes.split("-").map(Number);

  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
}

// Primeiro e último dia do mês ("AAAA-MM-DD").
export function limitesDoMes(mes: string): { inicio: string; fim: string } {
  const [a, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();

  return { inicio: `${mes}-01`, fim: `${mes}-${String(ultimo).padStart(2, "0")}` };
}

// Os n últimos meses até `mes` (inclusive), do mais antigo para o mais novo.
export function ultimosMeses(mes: string, n: number): string[] {
  const lista = [mes];

  while (lista.length < n) lista.unshift(mesAnterior(lista[0]));

  return lista;
}

// "2026-09" -> "setembro de 2026"
export function nomeDoMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);

  return `${NOMES_MESES[m - 1]} de ${a}`;
}

// "2026-09" -> "set/26" (rótulo curto dos gráficos)
export function rotuloCurtoDoMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);

  return `${NOMES_MESES[m - 1].slice(0, 3)}/${String(a).slice(2)}`;
}
