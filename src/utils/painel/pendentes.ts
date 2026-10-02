import { diasEntre, ehDiaUtil, somarDias } from "./dias-uteis";

// Janela de dias corridos olhada para trás (cobre a virada do mês sem cobrar o passado distante).
export const JANELA_PENDENTES_DIAS = 14;

// Dias úteis recentes (hoje não conta) sem nenhuma OS e que o consultor ainda
// pode apontar (a partir de `apontarAPartirDe`). Em ordem crescente.
export function diasPendentes(params: {
  hoje: string;
  diasComOs: string[];
  apontarAPartirDe: string;
  janelaDias?: number;
}): string[] {
  const { hoje, diasComOs, apontarAPartirDe, janelaDias = JANELA_PENDENTES_DIAS } = params;
  const comOs = new Set(diasComOs);
  const dias: string[] = [];

  for (let i = janelaDias; i >= 1; i--) {
    const dia = somarDias(hoje, -i);

    if (dia < apontarAPartirDe || diasEntre(dia, hoje) < 1) continue;
    if (ehDiaUtil(dia) && !comOs.has(dia)) dias.push(dia);
  }

  return dias;
}
