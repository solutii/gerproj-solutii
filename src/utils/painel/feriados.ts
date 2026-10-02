// Feriados nacionais do Brasil (fixos e móveis). Feriados estaduais/municipais
// não entram: o banco não tem cadastro de feriados.

const pad = (n: number) => String(n).padStart(2, "0");

function iso(ano: number, mes: number, dia: number): string {
  return `${ano}-${pad(mes)}-${pad(dia)}`;
}

// Soma dias a uma data "AAAA-MM-DD" (aritmética em UTC, sem fuso).
export function somarDias(dataISO: string, dias: number): string {
  const [a, m, d] = dataISO.split("-").map(Number);
  const data = new Date(Date.UTC(a, m - 1, d + dias));

  return iso(data.getUTCFullYear(), data.getUTCMonth() + 1, data.getUTCDate());
}

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher).
export function pascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;

  return iso(ano, mes, dia);
}

const cache = new Map<number, Set<string>>();

// Todos os feriados nacionais do ano, como "AAAA-MM-DD".
export function feriadosNacionais(ano: number): Set<string> {
  const guardado = cache.get(ano);
  if (guardado) return guardado;

  const p = pascoa(ano);
  const lista = [
    iso(ano, 1, 1), // Confraternização Universal
    somarDias(p, -48), // Carnaval (segunda)
    somarDias(p, -47), // Carnaval (terça)
    somarDias(p, -2), // Sexta-feira Santa
    iso(ano, 4, 21), // Tiradentes
    iso(ano, 5, 1), // Dia do Trabalho
    somarDias(p, 60), // Corpus Christi
    iso(ano, 9, 7), // Independência
    iso(ano, 10, 12), // Nossa Senhora Aparecida
    iso(ano, 11, 2), // Finados
    iso(ano, 11, 15), // Proclamação da República
    iso(ano, 11, 20), // Consciência Negra
    iso(ano, 12, 25), // Natal
  ];

  const conjunto = new Set(lista);
  cache.set(ano, conjunto);

  return conjunto;
}

export function ehFeriado(dataISO: string): boolean {
  return feriadosNacionais(Number(dataISO.slice(0, 4))).has(dataISO);
}
