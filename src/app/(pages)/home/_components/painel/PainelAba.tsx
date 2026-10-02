"use client";

import { useState } from "react";
import GraficoBarrasHorizontais from "@/components/graficos/GraficoBarrasHorizontais";
import GraficoDias from "@/components/graficos/GraficoDias";
import GraficoEvolucao from "@/components/graficos/GraficoEvolucao";
import { formatarHoras } from "@/utils/painel/horas";
import { mesAtual } from "@/utils/painel/periodo";
import Cartao, { TabelaDoGrafico, diaMes } from "./Cartao";
import Comparacao from "./Comparacao";
import ExportarEspelho from "./ExportarEspelho";
import Hoje from "./Hoje";
import MeusChamados from "./MeusChamados";
import Pendencias from "./Pendencias";
import ResumoMes from "./ResumoMes";
import Resultado from "./Resultado";
import SeletorMes from "./SeletorMes";
import TarefasAndamento from "./TarefasAndamento";
import { usePainel } from "./usePainel";

// Ações que o painel dispara na Home (a Home é quem conhece as tabelas e o modal).
export type AcoesPainel = {
  onApontarEm: (data: string, inicio?: string, fim?: string) => void;
  onIrParaChamado: (codChamado: number) => void;
  onIrParaTarefa: (codTarefa: number) => void;
  onVerOsDoDia: (data: string) => void;
  onErro: (mensagem: string) => void;
};

function Esqueleto() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5" aria-busy="true" aria-label="Carregando o painel">
      {[2, 1, 2, 1, 1, 1, 1].map((span, i) => (
        <div
          key={i}
          className={`h-56 rounded-2xl bg-slate-200/70 dark:bg-slate-800 animate-pulse ${span === 2 ? "xl:col-span-2" : ""}`}
        />
      ))}
    </div>
  );
}

function SemDados() {
  return <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Nenhuma OS neste mês.</p>;
}

export default function PainelAba({ onApontarEm, onIrParaChamado, onIrParaTarefa, onVerOsDoDia, onErro }: AcoesPainel) {
  const [mes, setMes] = useState(() => mesAtual());
  const { dados, carregando, erro, recarregar } = usePainel(mes);

  const cabecalho = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">Meu Painel</h2>
      <SeletorMes mes={mes} onChange={setMes} carregando={carregando && !!dados} />
    </div>
  );

  if (!dados) {
    return (
      <div className="flex flex-col gap-4">
        {cabecalho}
        {erro ? (
          <div role="alert" className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-5 flex flex-col gap-3 items-start">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">{erro}</p>
            <button
              type="button"
              onClick={recarregar}
              className="rounded-md border border-blue-900 bg-gradient-to-br from-blue-600 to-blue-700 px-4 py-2 text-sm font-medium text-white depth-btn cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <Esqueleto />
        )}
      </div>
    );
  }

  const { tempo } = dados;
  const totalMin = dados.resumo.horasApontadasMin;
  const linhas = (itens: { rotulo: string; minutos: number }[]) => itens.map((i) => ({ rotulo: i.rotulo, minutos: i.minutos }));

  return (
    <div className="flex flex-col gap-4">
      {cabecalho}

      {erro && (
        <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">
          {erro}{" "}
          <button type="button" onClick={recarregar} className="underline cursor-pointer">
            Tentar novamente
          </button>
        </p>
      )}

      <ExportarEspelho mes={dados.mes} nomeMes={dados.nomeMes} onErro={onErro} />

      <div className={`grid grid-cols-1 xl:grid-cols-3 gap-5 transition-opacity ${carregando ? "opacity-60" : ""}`}>
        <ResumoMes dados={dados} onApontarEm={onApontarEm} />
        <Hoje dados={dados} onApontarEm={onApontarEm} />

        <Cartao
          titulo="Horas por dia"
          subtitulo={`Verde: bateu a jornada de ${formatarHoras(dados.jornadaDiariaMin)} · Âmbar: abaixo · Linha: jornada`}
          className="xl:col-span-2"
        >
          {totalMin === 0 ? (
            <SemDados />
          ) : (
            <>
              <GraficoDias
                dias={tempo.porDia}
                jornadaMin={dados.jornadaDiariaMin}
                ariaLabel={`Horas apontadas por dia em ${dados.nomeMes}`}
                ariaDescription={`Total do mês: ${formatarHoras(totalMin)}.`}
              />
              <TabelaDoGrafico
                legenda="Horas apontadas por dia"
                linhas={tempo.porDia.filter((d) => d.minutos > 0).map((d) => ({ rotulo: diaMes(d.data), minutos: d.minutos }))}
              />
            </>
          )}
        </Cartao>

        <Comparacao dados={dados} />

        <Pendencias
          dados={dados}
          onIrParaChamado={onIrParaChamado}
          onIrParaTarefa={onIrParaTarefa}
          onVerOsDoDia={onVerOsDoDia}
        />
        <MeusChamados dados={dados} onIrParaChamado={onIrParaChamado} />
        <TarefasAndamento dados={dados} onIrParaTarefa={onIrParaTarefa} />

        <Cartao titulo="Horas por tipo de chamado" subtitulo="Classificação do chamado (OS de tarefa ficam em 'Tarefa')">
          {totalMin === 0 ? (
            <SemDados />
          ) : (
            <>
              <GraficoBarrasHorizontais
                itens={tempo.porClassificacao}
                ariaLabel={`Horas por tipo de chamado em ${dados.nomeMes}`}
              />
              <TabelaDoGrafico legenda="Horas por tipo de chamado" linhas={linhas(tempo.porClassificacao)} />
            </>
          )}
        </Cartao>

        <Cartao titulo="Evolução" subtitulo="Barras: horas do mês · Pontos: meta de cada mês">
          <GraficoEvolucao
            meses={tempo.evolucao}
            mesSelecionado={dados.mes}
            ariaLabel="Horas apontadas nos últimos 6 meses contra a meta"
          />
          <TabelaDoGrafico
            legenda="Horas por mês"
            linhas={tempo.evolucao.map((e) => ({ rotulo: `${e.rotulo} (meta ${formatarHoras(e.metaMin)})`, minutos: e.minutos }))}
          />
        </Cartao>

        <Cartao titulo="Horas por cliente" subtitulo="Os 8 maiores; o resto vai em 'Outros'">
          {totalMin === 0 ? (
            <SemDados />
          ) : (
            <>
              <GraficoBarrasHorizontais itens={tempo.porCliente} ariaLabel={`Horas por cliente em ${dados.nomeMes}`} />
              <TabelaDoGrafico legenda="Horas por cliente" linhas={linhas(tempo.porCliente)} />
            </>
          )}
        </Cartao>

        <Cartao titulo="Horas por tarefa" subtitulo="As 8 maiores; o resto vai em 'Outros'">
          {totalMin === 0 ? (
            <SemDados />
          ) : (
            <>
              <GraficoBarrasHorizontais itens={tempo.porTarefa} ariaLabel={`Horas por tarefa em ${dados.nomeMes}`} />
              <TabelaDoGrafico legenda="Horas por tarefa" linhas={linhas(tempo.porTarefa)} />
            </>
          )}
        </Cartao>

        <Resultado dados={dados} />
      </div>
    </div>
  );
}
