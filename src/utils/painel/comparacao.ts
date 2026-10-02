import { diasUteisDoMes } from "./dias-uteis";
import type { MinutosPorDia } from "./agregacoes";

// Soma os minutos de um mês até o N-ésimo dia útil (inclusive; fins de semana
// antes desse dia entram). `ate` nulo ou maior que os dias úteis = mês inteiro.
// Serve para comparar o mês em andamento com o mês anterior no MESMO ponto
// (ex.: os 2 primeiros dias úteis de cada um), e não com o mês anterior inteiro.
export function minutosAteDiaUtil(
  mes: string,
  porDia: MinutosPorDia[],
  ate: number | null,
): number {
  const uteis = diasUteisDoMes(mes);

  if (ate === null || ate >= uteis.length) return porDia.reduce((s, d) => s + d.minutos, 0);
  if (ate <= 0) return 0;

  const corte = uteis[ate - 1];

  return porDia.filter((d) => d.data <= corte).reduce((s, d) => s + d.minutos, 0);
}

// Variação percentual de `anterior` para `atual` (null se não há base).
export function variacaoPercentual(atual: number, anterior: number): number | null {
  if (anterior <= 0) return null;

  return Math.round(((atual - anterior) / anterior) * 100);
}
