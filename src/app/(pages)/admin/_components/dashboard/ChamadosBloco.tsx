import { AJUDAS } from "./ajudas";
import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import Tooltip from "@/components/tooltip";
import { STYLES as CORES_DO_STATUS } from "@/app/(pages)/home/_components/tables/StatusBadge";
import type { BlocoDeChamados, ChamadoParadoNoDashboard } from "@/types/admin-dashboard";
import { BarrasDeContagem, Bloco, ITENS_POR_PAGINA, Paginacao, SeletorDePagina, SemDados, classeDoSlide, num, useRecolhimento } from "./comuns";
import { CLASSES_DO_BADGE, ConteudoDoBadge } from "./BadgeDeSituacao";
import ListaDaSituacao from "./ListaDaSituacao";
import { BotaoDeOrdenar, ariaSort, ordenarLista, proximaOrdem, type Ordem } from "./ordenacao";

const ROTULO_DO_STATUS: Record<string, string> = {
  "NAO INICIADO": "Não iniciado",
  "EM ATENDIMENTO": "Em atendimento",
  ATRIBUIDO: "Atribuído",
  STANDBY: "StandBy",
  "AGUARDANDO VALIDACAO": "Aguardando validação",
  FINALIZADO: "Finalizado",
};

// Ordem fixa dos badges do card "Chamados abertos" (só aparecem as situações que têm chamados).
// Situação fora da lista (nova no sistema) vai depois, da que tem mais chamados para a que tem menos.
export const ORDEM_DAS_SITUACOES = ["NAO INICIADO", "EM ATENDIMENTO", "ATRIBUIDO", "STANDBY", "AGUARDANDO VALIDACAO", "FINALIZADO"];

export function ordenarSituacoes<T extends { status: string; quantidade: number }>(lista: T[]): T[] {
  const posicao = (status: string) => {
    const i = ORDEM_DAS_SITUACOES.indexOf(status);

    return i === -1 ? ORDEM_DAS_SITUACOES.length : i;
  };

  return [...lista].sort((a, b) => posicao(a.status) - posicao(b.status) || b.quantidade - a.quantidade || a.status.localeCompare(b.status, "pt-BR"));
}

export type ColunaDosParados = "chamado" | "assunto" | "cliente" | "consultor" | "situacao" | "dias";

const COLUNAS_PARADOS: { id: ColunaDosParados; texto: string; direita?: boolean }[] = [
  { id: "chamado", texto: "Chamado" },
  { id: "assunto", texto: "Assunto" },
  { id: "cliente", texto: "Cliente" },
  { id: "consultor", texto: "Consultor" },
  { id: "situacao", texto: "Situação" },
  { id: "dias", texto: "Dias parado", direita: true },
];

// Quando TODAS as situações da lista estão no card, "Aguardando validação" (e o que vier depois,
// como "Finalizado") desce para a linha de baixo: a primeira linha fica com as quatro primeiras.
export const SITUACAO_QUE_ABRE_A_SEGUNDA_LINHA = "AGUARDANDO VALIDACAO";

export function temTodasAsSituacoes(lista: { status: string }[]): boolean {
  return ORDEM_DAS_SITUACOES.every((situacao) => lista.some((s) => s.status === situacao));
}

// Fundo de cada situação: as MESMAS cores da tabela de chamados do consultor (texto branco).
// Situação desconhecida cai num cinza claro, com texto escuro.
const COR_NEUTRA = "bg-slate-100 text-slate-700 border-slate-200";
export const corDaSituacao = (status: string): string => (CORES_DO_STATUS as Record<string, string>)[status] ?? COR_NEUTRA;

const rotuloDaSituacao = (status: string) => ROTULO_DO_STATUS[status] ?? status;

const valorDoParado = (c: ChamadoParadoNoDashboard, coluna: ColunaDosParados): string | number => {
  switch (coluna) {
    case "chamado":
      return c.codChamado;
    case "assunto":
      return c.assunto;
    case "cliente":
      return c.cliente;
    case "consultor":
      return c.consultor;
    case "situacao":
      return rotuloDaSituacao(c.status);
    case "dias":
      return c.diasParado;
  }
};

// Ordem padrão (ao carregar e no terceiro clique): o mais parado primeiro.
export function ordenarParados(lista: ChamadoParadoNoDashboard[], ordem: Ordem<ColunaDosParados>): ChamadoParadoNoDashboard[] {
  const { coluna, crescente } = ordem ?? { coluna: "dias" as const, crescente: false };

  return ordenarLista(lista, (c) => valorDoParado(c, coluna), crescente, (a, b) => b.diasParado - a.diasParado || a.codChamado - b.codChamado);
}

// Abertos × concluídos por semana: duas barras por semana, na mesma escala.
function GraficoSemanas({ semanas }: { semanas: BlocoDeChamados["semanas"] }) {
  const maior = Math.max(1, ...semanas.flatMap((s) => [s.abertos, s.concluidos]));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-cyan-600 dark:bg-cyan-400" /> Abertos
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-green-600 dark:bg-green-400" /> Concluídos
        </span>
      </div>

      <div
        role="img"
        aria-label={`Chamados abertos e concluídos nas últimas ${semanas.length} semanas`}
        className="flex h-40 items-end gap-2 border-b border-slate-200 pb-1 dark:border-slate-700"
      >
        {semanas.map((s) => (
          <div key={s.inicio} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1">
            <div className="flex flex-1 items-end justify-center gap-1">
              {[
                { valor: s.abertos, classe: "bg-cyan-600 dark:bg-cyan-400" },
                { valor: s.concluidos, classe: "bg-green-600 dark:bg-green-400" },
              ].map((b, i) => (
                <div key={i} className="flex h-full w-1/2 max-w-[22px] flex-col justify-end text-center">
                  <span className="text-[10px] font-bold tabular-nums text-slate-600 dark:text-slate-300">{num(b.valor)}</span>
                  <span className={`block w-full rounded-t ${b.classe}`} style={{ height: `${(b.valor / maior) * 100}%`, minHeight: b.valor > 0 ? 3 : 0 }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div aria-hidden className="flex gap-2">
        {semanas.map((s) => (
          <span key={s.inicio} className="min-w-0 flex-1 text-center text-[10px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
            {s.rotulo}
          </span>
        ))}
      </div>

      <details className="text-xs text-slate-500 dark:text-slate-400">
        <summary className="cursor-pointer select-none font-semibold">Ver em tabela</summary>
        <table className="mt-2 w-full max-w-sm">
          <caption className="sr-only">Chamados abertos e concluídos por semana</caption>
          <thead>
            <tr className="text-left">
              <th className="pr-4 font-semibold">Semana (início)</th>
              <th className="text-right font-semibold">Abertos</th>
              <th className="text-right font-semibold">Concluídos</th>
            </tr>
          </thead>
          <tbody>
            {semanas.map((s) => (
              <tr key={s.inicio} className="border-t border-slate-100 dark:border-slate-700">
                <td className="py-0.5 pr-4 tabular-nums">{s.rotulo}</td>
                <td className="py-0.5 text-right tabular-nums">{num(s.abertos)}</td>
                <td className="py-0.5 text-right tabular-nums">{num(s.concluidos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

export default function ChamadosBloco({ chamados }: { chamados: BlocoDeChamados }) {
  const { abertosPorStatus, abertos, parados, totalParados, porCliente, porArea, semanas } = chamados;
  // badge clicado: a tabela dos chamados dessa situação abre dentro do card
  const [selecionada, setSelecionada] = useState<string | null>(null);
  // situação cujo badge acabou de VOLTAR para a fileira (ao fechar a tabela): ele reaparece com um fade e recebe o foco
  const [voltou, setVoltou] = useState<string | null>(null);
  const idDaLista = useId();
  const fileira = useRef<HTMLUListElement>(null);
  const chamadosDaSelecionada = useMemo(() => (selecionada ? abertos.filter((c) => c.status === selecionada) : []), [abertos, selecionada]);
  // o badge só some da fileira (e vai para o cabeçalho da tabela) se há mesmo uma tabela para mostrar
  const tabelaAberta = selecionada !== null && chamadosDaSelecionada.length > 0;
  const fecharLista = () => {
    setVoltou(selecionada);
    setSelecionada(null);
  };

  // o badge voltou para a fileira: o foco volta para ele (quem usa teclado não se perde)
  useEffect(() => {
    if (voltou) fileira.current?.querySelector<HTMLElement>(`button[data-situacao='${voltou}']`)?.focus();
  }, [voltou]);
  const [ordem, setOrdem] = useState<Ordem<ColunaDosParados>>(null);
  const ordenados = useMemo(() => ordenarParados(parados, ordem), [parados, ordem]);
  const listaParados = useRecolhimento(ordenados, undefined, ITENS_POR_PAGINA);

  return (
    <>
      <Bloco ajuda={AJUDAS.chamadosAbertos} titulo="Chamados abertos" subtitulo="Por situação, hoje">
        {abertosPorStatus.length === 0 ? (
          <SemDados>Nenhum chamado em aberto.</SemDados>
        ) : (
          <>
            {/* badges centralizados só na HORIZONTAL do card: ficam no alto, logo abaixo do cabeçalho (a tabela da situação abre embaixo deles) */}
            <ul ref={fileira} className="flex flex-wrap items-center justify-center gap-2">
              {ordenarSituacoes(abertosPorStatus).map((s) => {
                const rotulo = ROTULO_DO_STATUS[s.status] ?? s.status;
                // o badge da situação aberta não fica na fileira: ele está no cabeçalho da tabela
                const noCabecalho = tabelaAberta && selecionada === s.status;

                return (
                  <Fragment key={s.status}>
                    {/* com todas as situações no card, Aguardando validação e as seguintes vão para a linha de baixo
                        (a quebra fica mesmo que o badge dessa situação esteja no cabeçalho da tabela) */}
                    {s.status === SITUACAO_QUE_ABRE_A_SEGUNDA_LINHA && temTodasAsSituacoes(abertosPorStatus) && (
                      <li aria-hidden role="presentation" data-quebra-de-linha className="h-0 basis-full" />
                    )}
                    {!noCabecalho && (
                      <li className={voltou === s.status ? "motion-safe:animate-modal-fade" : undefined}>
                        <Tooltip content="Clique para ver os chamados">
                          <button
                            type="button"
                            data-situacao={s.status}
                            aria-label={`${num(s.quantidade)} ${rotulo}: ver os chamados`}
                            onClick={() => {
                              setVoltou(null);
                              setSelecionada(s.status);
                            }}
                            className={`${CLASSES_DO_BADGE} cursor-pointer outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[#0f3d63] focus-visible:ring-offset-2 dark:focus-visible:ring-white dark:focus-visible:ring-offset-slate-800 ${corDaSituacao(s.status)}`}
                          >
                            <ConteudoDoBadge quantidade={s.quantidade} rotulo={rotulo} />
                          </button>
                        </Tooltip>
                      </li>
                    )}
                  </Fragment>
                );
              })}
            </ul>

            {tabelaAberta && selecionada && (
              <ListaDaSituacao
                key={selecionada}
                id={idDaLista}
                status={selecionada}
                rotulo={ROTULO_DO_STATUS[selecionada] ?? selecionada}
                corDoBadge={corDaSituacao(selecionada)}
                lista={chamadosDaSelecionada}
                onFechar={fecharLista}
              />
            )}
          </>
        )}
      </Bloco>

      <Bloco ajuda={AJUDAS.chamadosPorSemana} titulo="Chamados por semana" subtitulo="Abertos (data do chamado) contra concluídos (finalização), semana de segunda a domingo">
        <GraficoSemanas semanas={semanas} />
      </Bloco>

      <Bloco ajuda={AJUDAS.chamadosParados}
        titulo={`Chamados parados (${num(totalParados)})`}
        subtitulo="Sem apontamento nem movimento há mais de 7 dias"
        className="xl:col-span-2"
        acao={
          listaParados.botao && (
            <div className="flex items-center gap-6">
              {listaParados.paginacao && <SeletorDePagina paginacao={listaParados.paginacao} />}
              {listaParados.botao}
            </div>
          )
        }
      >
        {parados.length === 0 ? (
          <SemDados>Nenhum chamado parado.</SemDados>
        ) : (
          <div id={listaParados.idDaLista} className={listaParados.animando ? "overflow-x-hidden" : "overflow-auto"}>
            <table className="w-full min-w-[640px] border-collapse text-xs text-slate-800 dark:text-slate-100 sm:text-sm">
              <caption className="sr-only">Chamados parados; por padrão, do mais parado para o menos parado</caption>
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  {COLUNAS_PARADOS.map((c) => (
                    <th key={c.id} scope="col" aria-sort={ariaSort(ordem, c.id)} className={c.id === "chamado" ? "py-1.5 pr-3" : c.direita ? "text-right" : "pr-3"}>
                      <BotaoDeOrdenar
                        texto={c.texto}
                        coluna={c.id}
                        ordem={ordem}
                        onOrdenar={(coluna) => {
                          setOrdem((atual) => proximaOrdem(atual, coluna));
                          listaParados.reiniciarPagina(); // outra ordem volta à primeira página
                        }}
                        className="cursor-pointer rounded px-0.5 font-bold uppercase tracking-wide outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#0f3d63]"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              {/* key = página: cada troca remonta as linhas e dispara o slide */}
              <tbody key={listaParados.paginacao?.pagina ?? 0} className={classeDoSlide(listaParados.direcao)}>
                {listaParados.visiveis.map((c) => (
                  <tr key={c.codChamado} className="border-b border-slate-100 dark:border-slate-700/60">
                    <td className="py-1.5 pr-3 font-semibold tabular-nums">{num(c.codChamado)}</td>
                    <td className="max-w-[260px] truncate pr-3" title={c.assunto}>{c.assunto}</td>
                    <td className="max-w-[180px] truncate pr-3" title={c.cliente}>{c.cliente}</td>
                    <td className="pr-3">{c.consultor}</td>
                    <td className="pr-3">{rotuloDaSituacao(c.status)}</td>
                    <td className="text-right font-bold tabular-nums text-amber-700 dark:text-amber-300">{num(c.diasParado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {listaParados.paginacao && <Paginacao paginacao={listaParados.paginacao} />}
          </div>
        )}
      </Bloco>

      <Bloco ajuda={AJUDAS.chamadosPorCliente} titulo="Chamados por cliente" subtitulo="Abertos no mês: os 8 maiores; o resto vai em Outros">
        {porCliente.length === 0 ? <SemDados>Nenhum chamado aberto no mês.</SemDados> : <BarrasDeContagem itens={porCliente} rotulo="Chamados abertos no mês por cliente" />}
      </Bloco>

      <Bloco ajuda={AJUDAS.chamadosPorArea} titulo="Chamados por área de atuação" subtitulo="Abertos no mês: as 8 maiores; o resto vai em Outros">
        {porArea.length === 0 ? <SemDados>Nenhum chamado aberto no mês.</SemDados> : <BarrasDeContagem itens={porArea} rotulo="Chamados abertos no mês por área" />}
      </Bloco>
    </>
  );
}
