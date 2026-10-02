"use client";

import { useMemo } from "react";
import { barY, defineChart, ruleY } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { Chart } from "@tanstack/charts/react/canvas";
import { formatarHoras, formatarNumero } from "@/utils/painel/horas";
import { temaDoChart, useTemaGrafico } from "./tema";

type Dia = { data: string; minutos: number };

type Props = {
  dias: Dia[];
  // jornada diária em minutos: linha de referência e cor das barras
  jornadaMin: number;
  ariaLabel: string;
  ariaDescription?: string;
};

// Horas apontadas por dia do mês. Verde = bateu a jornada do dia; âmbar = abaixo
// (inclui fins de semana e dias sem OS, com barra zerada). Linha tracejada = jornada.
export default function GraficoDias({ dias, jornadaMin, ariaLabel, ariaDescription }: Props) {
  const cores = useTemaGrafico();

  const definicao = useMemo(() => {
    const linhas = dias.map((d) => ({
      dia: d.data.slice(8, 10),
      data: d.data,
      horas: Math.round((d.minutos / 60) * 100) / 100,
      minutos: d.minutos,
      // verde = bateu a jornada do dia; âmbar = abaixo (inclui dias sem OS)
      cor: jornadaMin > 0 && d.minutos >= jornadaMin ? cores.verde : cores.ambar,
    }));

    return defineChart({
      marks: [
        barY(linhas, { x: "dia", y: "horas", key: "data", fill: (linha) => linha.cor }),
        ...(jornadaMin > 0
          ? [ruleY([{ meta: jornadaMin / 60 }], { y: "meta", stroke: cores.muted, strokeDasharray: "4 4" })]
          : []),
      ],
      scales: {
        x: { scale: () => scaleBand<string>().padding(0.25) },
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
          `${ponto.datum.data.slice(8, 10)}/${ponto.datum.data.slice(5, 7)}: ${formatarHoras(ponto.datum.minutos)}`,
      },
    });
  }, [dias, jornadaMin, cores]);

  return (
    <Chart
      definition={definicao}
      height={260}
      ariaLabel={ariaLabel}
      ariaDescription={ariaDescription}
    />
  );
}
