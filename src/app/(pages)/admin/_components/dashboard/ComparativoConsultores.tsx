"use client";

import { AJUDAS } from "./ajudas";
import { useMemo, useState } from "react";
import type { ConsultorNoDashboard } from "@/types/admin-dashboard";
import { formatarHoras } from "@/utils/painel/horas";
import { BarraDePercentual, Bloco, SemDados, Variacao, num, pct, useRecolhimento } from "./comuns";
import { BotaoDeOrdenar, ariaSort, proximaOrdem, type Ordem as OrdemGenerica } from "./ordenacao";

type Coluna = "nome" | "horas" | "percentual" | "variacao" | "regularidade" | "chamados" | "sla" | "atrasados";

const COLUNAS: { id: Coluna; texto: string; alinhar?: "left" }[] = [
  { id: "nome", texto: "Consultor", alinhar: "left" },
  { id: "horas", texto: "Horas / meta" },
  { id: "percentual", texto: "% da meta" },
  { id: "variacao", texto: "Mês anterior" },
  { id: "regularidade", texto: "Dias com jornada" },
  { id: "chamados", texto: "Chamados" },
  { id: "sla", texto: "SLA no prazo" },
  { id: "atrasados", texto: "Lançados atrasados" },
];

// Valor usado para ordenar cada coluna (sem dado vai para o fim, em qualquer sentido).
function valorDaColuna(c: ConsultorNoDashboard, coluna: Coluna): number | string | null {
  switch (coluna) {
    case "nome":
      return c.nome;
    case "horas":
      return c.horasMin;
    case "percentual":
      return c.percentualMeta;
    case "variacao":
      return c.variacao;
    case "regularidade":
      return c.diasUteisPassados > 0 ? c.diasBateuJornada / c.diasUteisPassados : null;
    case "chamados":
      return c.chamadosAtendidos;
    case "sla":
      return c.sla.percentualNoPrazo;
    case "atrasados":
      return c.lancamentosComData > 0 ? c.lancamentosAtrasados / c.lancamentosComData : null;
  }
}

export function ordenarConsultores(lista: ConsultorNoDashboard[], coluna: Coluna, crescente: boolean): ConsultorNoDashboard[] {
  return [...lista].sort((a, b) => {
    const va = valorDaColuna(a, coluna);
    const vb = valorDaColuna(b, coluna);

    if (va === null && vb === null) return a.nome.localeCompare(b.nome, "pt-BR");
    if (va === null) return 1;
    if (vb === null) return -1;

    const comparacao = typeof va === "string" ? va.localeCompare(vb as string, "pt-BR") : (va as number) - (vb as number);

    return (crescente ? comparacao : -comparacao) || a.nome.localeCompare(b.nome, "pt-BR");
  });
}

// Ordem escolhida no cabeçalho; nula = ordem padrão (a do carregamento).
export type Ordem = OrdemGenerica<Coluna>;

// Ordem em que a tabela abre e para onde o terceiro clique volta: maior % da meta primeiro.
export const ORDEM_PADRAO = { coluna: "percentual", crescente: false } as const;

type Props = {
  consultores: ConsultorNoDashboard[];
  ehMesAtual: boolean;
  onAbrirConsultor: (codigo: number, nome: string) => void;
};

export default function ComparativoConsultores({ consultores, ehMesAtual, onAbrirConsultor }: Props) {
  const [ordem, setOrdem] = useState<Ordem>(null);
  const ordenados = useMemo(() => {
    const { coluna, crescente } = ordem ?? ORDEM_PADRAO;

    return ordenarConsultores(consultores, coluna, crescente);
  }, [consultores, ordem]);
  const { visiveis: linhas, botao, idDaLista } = useRecolhimento(ordenados);

  return (
    <Bloco ajuda={AJUDAS.comparativo}
      titulo="Comparativo de consultores"
      subtitulo={`Horas contra a meta de cada um (jornada × dias úteis)${ehMesAtual ? "; o mês anterior é comparado até o mesmo ponto do mês" : ""}. Clique no nome para ver o painel completo.`}
      className="overflow-hidden"
      acao={botao}
    >
      {linhas.length === 0 ? (
        <SemDados>Nenhum consultor ativo.</SemDados>
      ) : (
        <div id={idDaLista} className="-mx-5 -mb-5 overflow-auto">
          <table className="w-full min-w-[1040px] border-collapse text-xs text-slate-800 dark:text-slate-100 sm:text-sm">
            <thead>
              <tr className="h-11 bg-[#0f3d63] text-center text-xs uppercase tracking-wide text-cyan-50">
                {COLUNAS.map((c) => (
                  <th key={c.id} scope="col" aria-sort={ariaSort(ordem, c.id)} className={c.alinhar === "left" ? "px-4 text-left" : "px-2"}>
                    <BotaoDeOrdenar texto={c.texto} coluna={c.id} ordem={ordem} onOrdenar={(coluna) => setOrdem((atual) => proximaOrdem(atual, coluna))} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((c) => {
                const bateu = c.metaMesMin > 0 && c.horasMin >= c.metaMesMin;

                return (
                  <tr key={c.codigo} className="border-b border-slate-200 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-2 font-semibold">
                      <button
                        type="button"
                        onClick={() => onAbrirConsultor(c.codigo, c.nome)}
                        className="cursor-pointer text-left text-[#0f3d63] underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#0f3d63] dark:text-cyan-300"
                      >
                        {c.nome}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-center tabular-nums">
                      <span className="font-bold">{formatarHoras(c.horasMin)}</span>
                      <span className="text-slate-500 dark:text-slate-400"> / {formatarHoras(c.metaMesMin)}</span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <BarraDePercentual valor={c.percentualMeta} rotulo={`${c.nome}: horas em relação à meta do mês`} cor={bateu ? "bg-green-600 dark:bg-green-400" : (c.percentualMetaAteHoje ?? 100) < 80 && ehMesAtual ? "bg-amber-600 dark:bg-amber-400" : undefined} />
                        <span className="w-11 shrink-0 text-right font-bold tabular-nums">{pct(c.percentualMeta)}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <Variacao valor={c.variacao} />
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums">
                      {c.diasBateuJornada}/{c.diasUteisPassados}
                      {c.diasSemApontamento.length > 0 && (
                        <span className="ml-1 text-xs font-semibold text-amber-700 dark:text-amber-300">({c.diasSemApontamento.length} sem OS)</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-center tabular-nums">
                      <span className="font-bold">{num(c.chamadosAtendidos)}</span> atend.
                      <span className="text-slate-500 dark:text-slate-400"> · {num(c.chamadosAbertos)} abertos</span>
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums">
                      {c.sla.percentualNoPrazo === null ? (
                        <span className="text-slate-400 dark:text-slate-500">—</span>
                      ) : (
                        <span className={`font-bold ${c.sla.percentualNoPrazo >= 80 ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-300"}`}>
                          {c.sla.percentualNoPrazo}%
                        </span>
                      )}
                      {c.sla.total > 0 && <span className="text-slate-500 dark:text-slate-400"> ({num(c.sla.noPrazo)}/{num(c.sla.total)})</span>}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums">
                      {c.lancamentosComData === 0 ? (
                        <span className="text-slate-400 dark:text-slate-500">—</span>
                      ) : (
                        <span className={c.lancamentosAtrasados > 0 ? "font-bold text-amber-700 dark:text-amber-300" : ""}>
                          {num(c.lancamentosAtrasados)}/{num(c.lancamentosComData)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Bloco>
  );
}
