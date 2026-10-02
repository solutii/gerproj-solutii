"use client";

import { AJUDAS } from "./ajudas";
import type { BlocoDeQualidade } from "@/types/admin-dashboard";
import { Bloco, SemDados, dataBR, diaMes, num, useRecolhimento } from "./comuns";

type Props = {
  qualidade: BlocoDeQualidade;
  // abre o painel completo do consultor
  onAbrirConsultor: (codigo: number, nome: string) => void;
};

const nomeBotao =
  "cursor-pointer text-left font-semibold text-[#0f3d63] underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#0f3d63] dark:text-cyan-300";

export default function QualidadeBloco({ qualidade, onAbrirConsultor }: Props) {
  const { diasSemApontamento, permissoesAntigas, lancamentosAtrasados } = qualidade;
  const semApontar = useRecolhimento(diasSemApontamento);
  const antigas = useRecolhimento(permissoesAntigas);
  const atrasados = useRecolhimento(lancamentosAtrasados);

  return (
    <>
      <Bloco ajuda={AJUDAS.diasSemApontamento} className="xl:col-span-2" titulo="Dias úteis sem apontamento" subtitulo="Dias úteis já passados do mês sem nenhuma OS, todos os dias de cada consultor" acao={semApontar.botao}>
        {diasSemApontamento.length === 0 ? (
          <SemDados>Nenhum dia útil sem apontamento.</SemDados>
        ) : (
          // as colunas de nome e de quantidade têm a largura do maior valor (sem vão entre o
          // nome e as datas); as datas ocupam o resto da linha
          <ul id={semApontar.idDaLista} className="grid grid-cols-[max-content_max-content_minmax(0,1fr)] gap-x-3">
            {semApontar.visiveis.map((c) => (
              <li key={c.codigo} className="col-span-3 grid grid-cols-subgrid items-center border-b border-slate-100 py-0.5 text-sm dark:border-slate-700">
                <button type="button" className={`${nomeBotao} whitespace-nowrap`} title={c.nome} onClick={() => onAbrirConsultor(c.codigo, c.nome)}>
                  {c.nome}
                </button>
                <span className="text-right font-bold tabular-nums text-amber-700 dark:text-amber-300">
                  {num(c.quantidade)} {c.quantidade === 1 ? "dia" : "dias"}
                </span>
                {/* uma linha só: com todos os dias do mês cabe; em tela estreita, rola para o lado */}
                <ul className="flex flex-nowrap gap-1 overflow-x-auto py-0.5">
                  {c.dias.map((d) => (
                    <li key={d} className="shrink-0 rounded-md border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                      {diaMes(d)}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Bloco>

      <Bloco ajuda={AJUDAS.permissaoAntiga} titulo="Permissão de apontar no passado a rever" subtitulo="Liberada com data-limite anterior ao início do mês passado (ou sem data): confira se ainda é necessária" acao={antigas.botao}>
        {permissoesAntigas.length === 0 ? (
          <SemDados>Nenhuma permissão antiga.</SemDados>
        ) : (
          <ul id={antigas.idDaLista} className="flex flex-col divide-y divide-slate-100 dark:divide-slate-700">
            {antigas.visiveis.map((c) => (
              <li key={c.codigo} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <button type="button" className={nomeBotao} onClick={() => onAbrirConsultor(c.codigo, c.nome)}>
                  {c.nome}
                </button>
                <span className="text-xs font-medium tabular-nums text-slate-600 dark:text-slate-300">
                  {c.dataLimite ? `desde ${dataBR(c.dataLimite)} (${num(c.diasDesdeLimite ?? 0)} dias)` : "sem data-limite"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500">Para mudar, use a aba Consultores.</p>
      </Bloco>

      <Bloco ajuda={AJUDAS.lancamentosAtrasados}
        titulo="Lançamentos atrasados"
        subtitulo="OS lançadas mais de 1 dia útil depois do dia trabalhado (sexta lançada na segunda não conta)"
        acao={atrasados.botao}
      >
        {lancamentosAtrasados.length === 0 ? (
          <SemDados>Nenhum lançamento atrasado neste mês.</SemDados>
        ) : (
          <ul id={atrasados.idDaLista} className="flex flex-col divide-y divide-slate-100 dark:divide-slate-700">
            {atrasados.visiveis.map((c) => (
              <li key={c.codigo} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <button type="button" className={nomeBotao} onClick={() => onAbrirConsultor(c.codigo, c.nome)}>
                  {c.nome}
                </button>
                <span className="text-xs font-medium tabular-nums text-slate-600 dark:text-slate-300">
                  <span className="font-bold text-amber-700 dark:text-amber-300">{num(c.atrasados)}</span> de {num(c.total)} OS ({num(c.percentual)}%)
                </span>
              </li>
            ))}
          </ul>
        )}
      </Bloco>
    </>
  );
}
