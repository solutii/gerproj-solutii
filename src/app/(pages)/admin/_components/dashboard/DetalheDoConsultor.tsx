"use client";

import { useState } from "react";
import Loading from "@/components/loading";
import GraficoBarrasHorizontais from "@/components/graficos/GraficoBarrasHorizontais";
import GraficoDias from "@/components/graficos/GraficoDias";
import GraficoEvolucao from "@/components/graficos/GraficoEvolucao";
import Cartao, { TabelaDoGrafico, diaMes } from "@/app/(pages)/home/_components/painel/Cartao";
import Comparacao from "@/app/(pages)/home/_components/painel/Comparacao";
import Resultado from "@/app/(pages)/home/_components/painel/Resultado";
import SeletorMes from "@/app/(pages)/home/_components/painel/SeletorMes";
import { usePainelDoConsultorAdmin } from "@/hooks/queries/admin";
import { mensagemDoErro } from "@/lib/api";
import type { PainelResposta } from "@/types/painel";
import { formatarHoras } from "@/utils/painel/horas";
import { botaoSecundario } from "../estilos";
import { AJUDAS_DO_DETALHE as AJ } from "./ajudas";
import BotaoDeAjuda from "./BotaoDeAjuda";
import { BarraDePercentual, num, pct } from "./comuns";

type Props = { codigo: number; nome: string; mesInicial: string; onVoltar: () => void };

const ROTULO_DO_STATUS: Record<string, string> = {
  ATRIBUIDO: "Atribuído",
  "EM ATENDIMENTO": "Em atendimento",
  STANDBY: "StandBy",
  "AGUARDANDO VALIDACAO": "Aguardando validação",
};

const linhas = (itens: { rotulo: string; minutos: number }[]) => itens.map((i) => ({ rotulo: i.rotulo, minutos: i.minutos }));

function MesDoConsultor({ dados }: { dados: PainelResposta }) {
  const { resumo, ehMesAtual, jornadaDiariaMin, nomeMes } = dados;
  const bateu = resumo.metaMesMin > 0 && resumo.horasApontadasMin >= resumo.metaMesMin;
  const saldo = resumo.saldoAteHojeMin;

  return (
    <Cartao acao={<BotaoDeAjuda ajuda={AJ.mesDoConsultor} />} titulo="Mês do consultor" subtitulo={nomeMes} className="xl:col-span-2">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <p className="text-4xl font-extrabold tabular-nums text-slate-800 dark:text-white">{formatarHoras(resumo.horasApontadasMin)}</p>
        <p className="pb-1 text-sm font-medium text-slate-500 dark:text-slate-400">
          de {formatarHoras(resumo.metaMesMin)} de meta ({num(resumo.diasUteis)} dias úteis × {formatarHoras(jornadaDiariaMin)}) · {pct(resumo.percentualMeta)}
        </p>
      </div>
      <BarraDePercentual valor={resumo.percentualMeta} rotulo="Horas apontadas em relação à meta do mês" cor={bateu ? "bg-green-600 dark:bg-green-400" : undefined} />
      {ehMesAtual && (
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {saldo >= 0 ? `${formatarHoras(saldo)} à frente da meta até hoje.` : `Faltam ${formatarHoras(-saldo)} para a meta até hoje (${formatarHoras(resumo.metaAteHojeMin)}).`}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Dias úteis sem apontamento ({resumo.diasSemApontamento.length})</p>
        {resumo.diasSemApontamento.length === 0 ? (
          <p className="text-sm font-medium text-green-700 dark:text-green-400">Nenhum dia útil sem apontamento.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {resumo.diasSemApontamento.map((d) => (
              <li key={d} className="rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                {diaMes(d)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Cartao>
  );
}

function ChamadosEtarefas({ dados }: { dados: PainelResposta }) {
  const { chamados, tarefasAndamento, pendencias } = dados;

  return (
    <>
      <Cartao acao={<BotaoDeAjuda ajuda={AJ.chamados} />} titulo="Chamados abertos do consultor" subtitulo="Os mais antigos primeiro">
        {chamados.porStatus.length === 0 ? (
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Nenhum chamado em aberto.</p>
        ) : (
          <>
            <ul className="flex flex-wrap gap-2">
              {chamados.porStatus.map((s) => (
                <li key={s.status} className="flex items-baseline gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 dark:border-slate-600 dark:bg-slate-700/50">
                  <span className="text-lg font-extrabold tabular-nums text-slate-800 dark:text-white">{num(s.quantidade)}</span>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{ROTULO_DO_STATUS[s.status] ?? s.status}</span>
                </li>
              ))}
            </ul>
            <ul className="flex flex-col divide-y divide-slate-100 text-sm text-slate-800 dark:divide-slate-700 dark:text-slate-100">
              {chamados.maisAntigos.map((c) => (
                <li key={c.codChamado} className="flex items-baseline justify-between gap-3 py-1.5">
                  <span className="min-w-0 truncate" title={c.assunto}>
                    <span className="font-semibold tabular-nums">{num(c.codChamado)}</span> · {c.assunto} <span className="text-slate-500 dark:text-slate-400">({c.cliente})</span>
                  </span>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300">{num(c.diasAberto)} dias</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {pendencias.chamadosParados.length > 0 && (
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">{pendencias.chamadosParados.length} parado(s) há mais de 7 dias.</p>
        )}
      </Cartao>

      <Cartao acao={<BotaoDeAjuda ajuda={AJ.tarefas} />} titulo="Tarefas em andamento" subtitulo="Horas lançadas contra as estimadas e o prazo">
        {tarefasAndamento.length === 0 ? (
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Nenhuma tarefa em andamento.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100 text-sm text-slate-800 dark:divide-slate-700 dark:text-slate-100">
            {tarefasAndamento.slice(0, 8).map((t) => (
              <li key={t.codTarefa} className="flex flex-col gap-1 py-1.5">
                <span className="truncate font-semibold" title={t.nome}>
                  {t.nome} <span className="font-medium text-slate-500 dark:text-slate-400">({t.cliente})</span>
                </span>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {formatarHoras(t.lancadoMin)} lançadas{t.horasEstimadas ? ` de ${num(t.horasEstimadas)}h (${pct(t.percentual)})` : ", sem estimativa"}
                  {t.diasParaPrazo !== null && (t.diasParaPrazo < 0 ? ` · prazo vencido há ${-t.diasParaPrazo} dias` : ` · prazo em ${t.diasParaPrazo} dias`)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </>
  );
}

// O Meu Painel de um consultor, só para consulta (nenhum botão grava nada).
export default function DetalheDoConsultor({ codigo, nome, mesInicial, onVoltar }: Props) {
  const [mes, setMes] = useState(mesInicial);
  const consulta = usePainelDoConsultorAdmin(codigo, mes);
  const dados = consulta.data?.painel;
  const total = dados?.resumo.horasApontadasMin ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={botaoSecundario} onClick={onVoltar}>
            ← Voltar ao dashboard
          </button>
          <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">{nome}</h2>
        </div>
        <SeletorMes mes={mes} onChange={setMes} carregando={consulta.isFetching && !!dados} />
      </div>

      {consulta.isError && !dados && (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/40">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">{mensagemDoErro(consulta.error, "Não foi possível carregar o painel do consultor.")}</p>
          <button type="button" className={botaoSecundario} onClick={() => void consulta.refetch()}>
            Tentar novamente
          </button>
        </div>
      )}

      {!dados && !consulta.isError && <Loading />}

      {dados && (
        <div className={`grid grid-cols-1 gap-5 transition-opacity xl:grid-cols-3 ${consulta.isFetching ? "opacity-60" : ""}`}>
          <MesDoConsultor dados={dados} />
          <Comparacao dados={dados} acao={<BotaoDeAjuda ajuda={AJ.comparacao} />} />

          <Cartao acao={<BotaoDeAjuda ajuda={AJ.horasPorDia} />} titulo="Horas por dia" subtitulo={`Verde: bateu a jornada de ${formatarHoras(dados.jornadaDiariaMin)} · Âmbar: abaixo · Linha: jornada`} className="xl:col-span-2">
            {total === 0 ? (
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Nenhuma OS neste mês.</p>
            ) : (
              <>
                <GraficoDias dias={dados.tempo.porDia} jornadaMin={dados.jornadaDiariaMin} ariaLabel={`Horas apontadas por dia em ${dados.nomeMes}`} ariaDescription={`Total do mês: ${formatarHoras(total)}.`} />
                <TabelaDoGrafico legenda="Horas apontadas por dia" linhas={dados.tempo.porDia.filter((d) => d.minutos > 0).map((d) => ({ rotulo: diaMes(d.data), minutos: d.minutos }))} />
              </>
            )}
          </Cartao>
          <Resultado
            dados={dados}
            deOutro
            acoes={{
              sla: <BotaoDeAjuda ajuda={AJ.sla} />,
              faturamento: <BotaoDeAjuda ajuda={AJ.faturamento} />,
              avaliacoes: <BotaoDeAjuda ajuda={AJ.avaliacoes} />,
            }}
          />

          <ChamadosEtarefas dados={dados} />

          <Cartao acao={<BotaoDeAjuda ajuda={AJ.evolucao} />} titulo="Evolução" subtitulo="Barras: horas do mês · Pontos: meta de cada mês">
            <GraficoEvolucao meses={dados.tempo.evolucao} mesSelecionado={dados.mes} ariaLabel="Horas apontadas nos últimos 6 meses contra a meta" />
            <TabelaDoGrafico legenda="Horas por mês" linhas={dados.tempo.evolucao.map((e) => ({ rotulo: `${e.rotulo} (meta ${formatarHoras(e.metaMin)})`, minutos: e.minutos }))} />
          </Cartao>

          {total > 0 && (
            <>
              <Cartao acao={<BotaoDeAjuda ajuda={AJ.horasPorCliente} />} titulo="Horas por cliente" subtitulo="Os 8 maiores; o resto vai em Outros">
                <GraficoBarrasHorizontais itens={dados.tempo.porCliente} ariaLabel={`Horas por cliente em ${dados.nomeMes}`} />
                <TabelaDoGrafico legenda="Horas por cliente" linhas={linhas(dados.tempo.porCliente)} />
              </Cartao>
              <Cartao acao={<BotaoDeAjuda ajuda={AJ.horasPorTarefa} />} titulo="Horas por tarefa" subtitulo="As 8 maiores; o resto vai em Outros">
                <GraficoBarrasHorizontais itens={dados.tempo.porTarefa} ariaLabel={`Horas por tarefa em ${dados.nomeMes}`} />
                <TabelaDoGrafico legenda="Horas por tarefa" linhas={linhas(dados.tempo.porTarefa)} />
              </Cartao>
            </>
          )}
        </div>
      )}
    </div>
  );
}
