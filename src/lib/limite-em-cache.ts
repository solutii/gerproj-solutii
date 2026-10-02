import { grupos } from "@/hooks/queries/chaves";
import type { PeriodoBruto } from "@/lib/api-home";
import { getQueryClient } from "@/lib/query-client";
import { calcularLimiteApontamento } from "@/utils/limite-apontamento";

// Para código que não é componente (ex.: validCurrentDate em homeActions):
// lê o período de apontamento já carregado pelo usePeriodoApontamento, sem
// fazer requisição. `undefined` se ainda não foi carregado.
export function limiteDeApontamentoEmCache(): Date | undefined {
  const [[, registro] = []] = getQueryClient().getQueriesData<PeriodoBruto>({ queryKey: grupos.periodo });

  return calcularLimiteApontamento(registro);
}
