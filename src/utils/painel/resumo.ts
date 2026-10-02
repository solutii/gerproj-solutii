import { diasUteisDoMes } from "./dias-uteis";
import type { MinutosPorDia } from "./agregacoes";

export type ResumoMes = {
  horasApontadasMin: number;
  // meta = jornada diária do consultor × dias úteis
  metaMesMin: number;
  metaAteHojeMin: number;
  diasUteis: number;
  diasUteisAteHoje: number;
  // dias úteis já passados (hoje não conta) sem nenhuma OS
  diasSemApontamento: string[];
  percentualMeta: number | null;
  percentualMetaAteHoje: number | null;
  // diferença em relação à meta até hoje (positivo = adiantado)
  saldoAteHojeMin: number;
};

const pct = (parte: number, todo: number) => (todo > 0 ? Math.round((parte / todo) * 100) : null);

// `jornadaDiariaMin`: HRDIA_RECURSO em minutos. `hoje`: "AAAA-MM-DD" (Brasília).
// Para um mês passado, todos os dias úteis já "passaram".
export function calcularResumoMes(params: {
  mes: string;
  hoje: string;
  jornadaDiariaMin: number;
  porDia: MinutosPorDia[];
}): ResumoMes {
  const { mes, hoje, jornadaDiariaMin, porDia } = params;

  const minutosDoDia = new Map(porDia.map((d) => [d.data, d.minutos]));
  const diasUteis = diasUteisDoMes(mes);
  const ateHoje = diasUteis.filter((d) => d <= hoje);
  const passados = diasUteis.filter((d) => d < hoje);

  const horasApontadasMin = porDia.reduce((s, d) => s + d.minutos, 0);
  const metaMesMin = jornadaDiariaMin * diasUteis.length;
  const metaAteHojeMin = jornadaDiariaMin * ateHoje.length;

  return {
    horasApontadasMin,
    metaMesMin,
    metaAteHojeMin,
    diasUteis: diasUteis.length,
    diasUteisAteHoje: ateHoje.length,
    diasSemApontamento: passados.filter((d) => (minutosDoDia.get(d) ?? 0) === 0),
    percentualMeta: pct(horasApontadasMin, metaMesMin),
    percentualMetaAteHoje: pct(horasApontadasMin, metaAteHojeMin),
    saldoAteHojeMin: horasApontadasMin - metaAteHojeMin,
  };
}
