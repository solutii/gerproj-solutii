"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { formatarNumero } from "@/utils/painel/horas";
import type { Ajuda } from "./ajudas";
import BotaoDeAjuda from "./BotaoDeAjuda";

// Peças pequenas que os blocos do dashboard compartilham.

export const pct = (v: number | null) => (v === null ? "—" : `${formatarNumero(v)}%`);

// Números e códigos com separador de milhar (como a Home mostra o número do chamado: 15.186).
export const num = formatarNumero;

// "25/09" a partir de "2026-09-25"
export const diaMes = (dataISO: string) => `${dataISO.slice(8, 10)}/${dataISO.slice(5, 7)}`;

export const dataBR = (dataISO: string) => `${diaMes(dataISO)}/${dataISO.slice(0, 4)}`;

// Seta e cor da variação contra o mês anterior (subir = melhor).
export function Variacao({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-xs font-medium text-slate-400 dark:text-slate-500">sem base</span>;
  if (valor === 0) return <span className="text-xs font-bold text-slate-500 dark:text-slate-400">= igual</span>;

  const subiu = valor > 0;

  return (
    <span className={`text-xs font-bold tabular-nums ${subiu ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-300"}`}>
      {subiu ? "▲" : "▼"} {formatarNumero(Math.abs(valor))}%
    </span>
  );
}

// Barra de progresso (o percentual pode passar de 100: a barra enche e fica verde).
export function BarraDePercentual({ valor, rotulo, cor }: { valor: number | null; rotulo: string; cor?: string }) {
  const largura = Math.min(100, Math.max(0, valor ?? 0));

  return (
    <div
      role="progressbar"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(100, valor ?? 0)}
      className="h-2.5 w-full min-w-[72px] overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
    >
      <div className={`h-full rounded-full ${cor ?? "bg-[#0f3d63] dark:bg-sky-400"}`} style={{ width: `${largura}%` }} />
    </div>
  );
}

// Moldura de cada bloco (mesmo visual dos cartões do Meu Painel).
export function Bloco({ titulo, subtitulo, className = "", children, acao, ajuda }: { titulo: string; subtitulo?: string; className?: string; children: ReactNode; acao?: ReactNode; ajuda?: Ajuda }) {
  return (
    <section className={`flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 ${className}`}>
      {/* o botão do card (ex.: "Ver todas") fica sempre no canto direito do cabeçalho, ao lado do título: o texto do título quebra de linha em vez de empurrar o botão para baixo */}
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{titulo}</h3>
          {subtitulo && <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{subtitulo}</p>}
        </div>
        {/* ações do card (Ver todas, páginas...) e, por último, o "?" com o resumo de como o card funciona */}
        {(acao || ajuda) && (
          <div className="flex shrink-0 items-center gap-3">
            {acao}
            {ajuda && <BotaoDeAjuda ajuda={ajuda} />}
          </div>
        )}
      </header>
      {children}
    </section>
  );
}

// Frase de "nada a mostrar" do card: centralizada na horizontal e, quando o card é mais alto que o
// conteúdo (ex.: o vizinho da linha tem muita coisa), também na vertical.
export function SemDados({ children }: { children: ReactNode }) {
  return <p className="flex flex-1 items-center justify-center py-4 text-center text-sm font-medium text-slate-500 dark:text-slate-400">{children}</p>;
}

// Barras horizontais de CONTAGEM (chamados por cliente/área): HTML puro, lido por
// leitor de tela como lista.
export function BarrasDeContagem({ itens, rotulo }: { itens: { chave: string; rotulo: string; quantidade: number }[]; rotulo: string }) {
  const maior = Math.max(1, ...itens.map((i) => i.quantidade));

  return (
    <ul aria-label={rotulo} className="flex flex-col gap-1.5">
      {itens.map((i) => (
        <li key={i.chave} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 text-sm">
          <span className="truncate font-medium text-slate-700 dark:text-slate-200" title={i.rotulo}>
            {i.rotulo}
          </span>
          <span className="font-bold tabular-nums text-slate-800 dark:text-white">{formatarNumero(i.quantidade)}</span>
          <span aria-hidden className="col-span-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
            <span className="block h-full rounded-full bg-cyan-600 dark:bg-cyan-400" style={{ width: `${(i.quantidade / maior) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

// ─── Cards com muitas linhas: expandir / recolher ───────────────────────────

// Card com mais que isso de linhas mostra só as primeiras e ganha o botão.
export const LINHAS_VISIVEIS = 10;

const botaoExpandir =
  "cursor-pointer rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-[#0f3d63] dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600";

// Linhas por página quando o card está expandido e a lista é grande.
export const ITENS_POR_PAGINA = 25;

export type DirecaoDoSlide = "proxima" | "anterior" | null;

// Mostra só as `limite` primeiras linhas até o usuário expandir. `botao` vai no cabeçalho
// do card (nulo quando cabe tudo: com até `limite` linhas não há o que expandir).
// `idDaLista` liga o botão à região controlada (leitor de tela).
//
// Com `porPagina`, o card expandido mostra a lista em páginas desse tamanho (se a lista
// passa de uma página): `paginacao` traz os dados dos botões Anterior/Próxima e `direcao`
// diz para que lado a troca de página deve deslizar (nula até a primeira troca).
export function useRecolhimento<T>(itens: T[], limite: number = LINHAS_VISIVEIS, porPagina?: number) {
  const [expandido, setExpandido] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [direcao, setDirecao] = useState<DirecaoDoSlide>(null);
  const [animando, setAnimando] = useState(false);
  const idDaLista = useId();
  const recolhivel = itens.length > limite;

  const paginado = !!porPagina && expandido && itens.length > porPagina;
  const totalPaginas = paginado ? Math.ceil(itens.length / (porPagina as number)) : 1;
  // a lista pode encolher (outro mês, atualização): a página nunca passa da última
  const paginaAtual = Math.min(pagina, totalPaginas - 1);

  // durante o slide as linhas passam um pouco da borda: o card esconde isso (sem barra de rolagem piscando)
  useEffect(() => {
    if (!animando) return;

    const relogio = window.setTimeout(() => setAnimando(false), 350);

    return () => window.clearTimeout(relogio);
  }, [animando, paginaAtual]);

  function alternar() {
    setExpandido((e) => !e);
    setPagina(0);
    setDirecao(null);
    setAnimando(false);
  }

  function irParaPagina(destino: number) {
    const alvo = Math.min(Math.max(destino, 0), totalPaginas - 1);
    if (alvo === paginaAtual) return;

    setDirecao(alvo > paginaAtual ? "proxima" : "anterior");
    setAnimando(true);
    setPagina(alvo);
  }

  function reiniciarPagina() {
    setPagina(0);
    setDirecao(null);
    setAnimando(false);
  }

  const botao = recolhivel ? (
    <button type="button" className={botaoExpandir} aria-expanded={expandido} aria-controls={idDaLista} onClick={alternar}>
      {expandido ? "Recolher" : `Ver todas (${formatarNumero(itens.length)})`}
    </button>
  ) : null;

  let visiveis = itens;
  if (recolhivel && !expandido) visiveis = itens.slice(0, limite);
  else if (paginado) visiveis = itens.slice(paginaAtual * (porPagina as number), (paginaAtual + 1) * (porPagina as number));

  const paginacao = paginado
    ? {
        pagina: paginaAtual,
        totalPaginas,
        total: itens.length,
        inicio: paginaAtual * (porPagina as number) + 1,
        fim: Math.min(itens.length, (paginaAtual + 1) * (porPagina as number)),
        irPara: irParaPagina,
      }
    : null;

  return { visiveis, botao, idDaLista, recolhivel, expandido, paginacao, direcao, animando, reiniciarPagina };
}

// Classe do slide para a parte da lista que troca de página (nada antes da primeira troca,
// e nada para quem pediu menos animação no sistema).
export function classeDoSlide(direcao: DirecaoDoSlide): string {
  if (direcao === "proxima") return "motion-safe:animate-[slide-proxima_0.3s_ease-out]";
  if (direcao === "anterior") return "motion-safe:animate-[slide-anterior_0.3s_ease-out]";

  return "";
}

type DadosDaPaginacao = NonNullable<ReturnType<typeof useRecolhimento>["paginacao"]>;

const botaoPaginaIcone =
  "flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-slate-300 bg-white text-base font-bold leading-none text-slate-700 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-[#0f3d63] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600 dark:disabled:hover:bg-slate-700";

// Seletor compacto de página ("‹ 2 / 3 ›"), usado no cabeçalho do card (junto do Recolher) e
// no rodapé: o mesmo componente nos dois lugares, então o estilo é idêntico e eles andam juntos.
export function SeletorDePagina({ paginacao }: { paginacao: DadosDaPaginacao }) {
  const { pagina, totalPaginas, irPara } = paginacao;

  return (
    <div role="group" aria-label="Trocar de página" className="flex items-center gap-1">
      <button type="button" aria-label="Ir para a página anterior" className={botaoPaginaIcone} disabled={pagina <= 0} onClick={() => irPara(pagina - 1)}>
        ‹
      </button>
      <span className="min-w-[3.25rem] text-center text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
        {formatarNumero(pagina + 1)} / {formatarNumero(totalPaginas)}
      </span>
      <button type="button" aria-label="Ir para a próxima página" className={botaoPaginaIcone} disabled={pagina >= totalPaginas - 1} onClick={() => irPara(pagina + 1)}>
        ›
      </button>
    </div>
  );
}

// Rodapé do card: o seletor de página à direita. O "26–50 de 65 · página 2 de 3" não aparece na
// tela (o "2 / 3" já diz a página), mas fica como aviso invisível para leitor de tela.
export function Paginacao({ paginacao }: { paginacao: DadosDaPaginacao }) {
  const { pagina, totalPaginas, total, inicio, fim } = paginacao;

  return (
    <nav aria-label="Páginas da lista" className="mt-3 flex items-center justify-end border-t border-slate-100 pt-3 dark:border-slate-700">
      <p className="sr-only" aria-live="polite">
        Página {formatarNumero(pagina + 1)} de {formatarNumero(totalPaginas)}, itens {formatarNumero(inicio)} a {formatarNumero(fim)} de {formatarNumero(total)}
      </p>
      <SeletorDePagina paginacao={paginacao} />
    </nav>
  );
}
