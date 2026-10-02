import { ehFeriado, somarDias } from "./feriados";

// 0 = domingo ... 6 = sábado (calculado em UTC, sem depender do fuso da máquina).
export function diaDaSemana(dataISO: string): number {
  const [a, m, d] = dataISO.split("-").map(Number);

  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

// Segunda a sexta e não feriado nacional.
export function ehDiaUtil(dataISO: string): boolean {
  const dia = diaDaSemana(dataISO);

  return dia >= 1 && dia <= 5 && !ehFeriado(dataISO);
}

// Todos os dias ("AAAA-MM-DD") de um mês "AAAA-MM".
export function diasDoMes(mes: string): string[] {
  const [ano, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(ano, m, 0)).getUTCDate();

  return Array.from({ length: ultimo }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`);
}

export function diasUteisDoMes(mes: string): string[] {
  return diasDoMes(mes).filter(ehDiaUtil);
}

// Quantidade de dias corridos de a até b (b - a); negativo se b < a.
export function diasEntre(aISO: string, bISO: string): number {
  const [a1, m1, d1] = aISO.split("-").map(Number);
  const [a2, m2, d2] = bISO.split("-").map(Number);

  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}

export { somarDias };
