"use client";

import { useMemo } from "react";
import { barX, defineChart } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { Chart } from "@tanstack/charts/react/canvas";
import { formatarHoras, formatarNumero } from "@/utils/painel/horas";
import { temaDoChart, useTemaGrafico } from "./tema";

type Item = { chave: string; rotulo: string; minutos: number };

type Props = {
  itens: Item[];
  ariaLabel: string;
  ariaDescription?: string;
};

const ALTURA_POR_BARRA = 34;
const MARGEM_EIXO = 48;
const MAX_ROTULO = 26;

const encurtar = (texto: string) =>
  texto.length > MAX_ROTULO ? `${texto.slice(0, MAX_ROTULO - 1)}…` : texto;

// Barras horizontais de horas por categoria (cliente, tarefa, classificação).
// "Outros" (o resto agrupado) fica em tom neutro.
export default function GraficoBarrasHorizontais({ itens, ariaLabel, ariaDescription }: Props) {
  const cores = useTemaGrafico();

  const definicao = useMemo(() => {
    // Rótulo curto e ÚNICO: dois itens com o mesmo nome (ex.: tarefas homônimas)
    // ganham um número, senão as barras cairiam na mesma linha do eixo.
    const vistos = new Map<string, number>();
    const nomeUnico = (rotulo: string) => {
      const base = encurtar(rotulo);
      const n = (vistos.get(base) ?? 0) + 1;
      vistos.set(base, n);

      return n === 1 ? base : `${base} (${n})`;
    };

    const linhas = itens.map((i) => ({
      nome: nomeUnico(i.rotulo),
      rotuloCompleto: i.rotulo,
      minutos: i.minutos,
      horas: Math.round((i.minutos / 60) * 100) / 100,
      // "Outros" (o resto agrupado) em tom neutro
      cor: i.chave === "__outros__" ? cores.muted : cores.azul,
    }));

    return defineChart({
      marks: [
        barX(linhas, { x: "horas", y: "nome", key: "nome", fill: (linha) => linha.cor }),
      ],
      scales: {
        x: {
          scale: scaleLinear,
          nice: true,
          grid: true,
          axis: { ticks: { format: (v: number) => `${formatarNumero(v)}h` } },
        },
        y: { scale: () => scaleBand<string>().padding(0.3) },
      },
      theme: temaDoChart(cores),
      tooltip: {
        use: tooltip,
        format: (ponto: any) => `${ponto.datum.rotuloCompleto}: ${formatarHoras(ponto.datum.minutos)}`,
      },
    });
  }, [itens, cores]);

  if (!itens.length) return null;

  return (
    <Chart
      definition={definicao}
      height={itens.length * ALTURA_POR_BARRA + MARGEM_EIXO}
      ariaLabel={ariaLabel}
      ariaDescription={ariaDescription}
    />
  );
}
