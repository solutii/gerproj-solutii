import { diasUteisDoMes } from "./dias-uteis";
import type { MinutosPorDia } from "./agregacoes";

export type Projecao = {
  // dias úteis já considerados (os anteriores a hoje + hoje, se já tem OS)
  diasDecorridos: number;
  diasRestantes: number;
  mediaDiariaMin: number | null;
  projecaoMesMin: number | null;
  faltaParaMetaMin: number;
  // quanto precisa por dia útil restante para bater a meta (null sem dias restantes)
  necessarioPorDiaMin: number | null;
  situacao: "meta-batida" | "no-ritmo" | "abaixo" | "sem-dados";
};

// Projeção do mês corrente no ritmo atual.
// - O dia de hoje só conta como "decorrido" se já tem apontamento (senão ainda
//   dá tempo de lançar, e entra nos dias restantes).
// - `situacao`: meta-batida (já bateu), no-ritmo (a projeção chega na meta),
//   abaixo (a projeção fica abaixo) ou sem-dados (início do mês, sem base).
export function calcularProjecao(params: {
  mes: string;
  hoje: string;
  metaMesMin: number;
  horasApontadasMin: number;
  porDia: MinutosPorDia[];
}): Projecao {
  const { mes, hoje, metaMesMin, horasApontadasMin, porDia } = params;

  const uteis = diasUteisDoMes(mes);
  const minutosHoje = porDia.find((d) => d.data === hoje)?.minutos ?? 0;
  const decorridos =
    uteis.filter((d) => d < hoje).length + (uteis.includes(hoje) && minutosHoje > 0 ? 1 : 0);
  const restantes = uteis.length - decorridos;

  const mediaDiariaMin = decorridos > 0 ? Math.round(horasApontadasMin / decorridos) : null;
  const projecaoMesMin =
    mediaDiariaMin === null ? null : Math.round(horasApontadasMin + mediaDiariaMin * restantes);
  const faltaParaMetaMin = Math.max(0, metaMesMin - horasApontadasMin);

  let situacao: Projecao["situacao"];
  if (metaMesMin > 0 && horasApontadasMin >= metaMesMin) situacao = "meta-batida";
  else if (projecaoMesMin === null) situacao = "sem-dados";
  else situacao = projecaoMesMin >= metaMesMin ? "no-ritmo" : "abaixo";

  return {
    diasDecorridos: decorridos,
    diasRestantes: restantes,
    mediaDiariaMin,
    projecaoMesMin,
    faltaParaMetaMin,
    necessarioPorDiaMin: restantes > 0 ? Math.ceil(faltaParaMetaMin / restantes) : null,
    situacao,
  };
}
