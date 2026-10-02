"use client";

import { useMemo } from "react";
import { barY, defineChart, dot } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { Chart } from "@tanstack/charts/react/canvas";
import { formatarHoras, formatarNumero } from "@/utils/painel/horas";
import { temaDoChart, useTemaGrafico } from "./tema";

type Mes = { mes: string; rotulo: string; minutos: number; metaMin: number };

type Props = {
  meses: Mes[];
  // mês exibido no painel (barra em destaque)
  mesSelecionado: string;
  ariaLabel: string;
  ariaDescription?: string;
};

// Horas apontadas por mês (barras) contra a meta de cada mês (pontos).
// A barra do mês selecionado fica em destaque.
export default function GraficoEvolucao({ meses, mesSelecionado, ariaLabel, ariaDescription }: Props) {
  const cores = useTemaGrafico();

  const definicao = useMemo(() => {
    const linhas = meses.map((m) => ({
      rotulo: m.rotulo,
      minutos: m.minutos,
      metaMin: m.metaMin,
      horas: Math.round((m.minutos / 60) * 100) / 100,
      meta: Math.round((m.metaMin / 60) * 100) / 100,
      // barra do mês selecionado em destaque
      cor: m.mes === mesSelecionado ? cores.azul : cores.ciano,
    }));

    return defineChart({
      marks: [
        barY(linhas, { x: "rotulo", y: "horas", key: "rotulo", fill: (linha) => linha.cor }),
        dot(linhas, { x: "rotulo", y: "meta", key: "rotulo", fill: cores.ambar, r: 5 }),
      ],
      scales: {
        x: { scale: () => scaleBand<string>().padding(0.3) },
        y: {
          scale: scaleLinear,
          nice: true,
          grid: true,
          axis: { ticks: { format: (v: number) => `${formatarNumero(v)}h` } },
        },
      },
      theme: temaDoChart(cores),
      tooltip: {
        use: tooltip,
        format: (ponto: any) =>
          `${ponto.datum.rotulo}: ${formatarHoras(ponto.datum.minutos)} (meta ${formatarHoras(ponto.datum.metaMin)})`,
      },
    });
  }, [meses, mesSelecionado, cores]);

  return (
    <Chart
      definition={definicao}
      height={260}
      ariaLabel={ariaLabel}
      ariaDescription={ariaDescription}
    />
  );
}
