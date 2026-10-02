"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TbX } from "react-icons/tb";
import type { ChamadoAbertoNoDashboard } from "@/types/admin-dashboard";
import { doisPrimeirosNomes, primeiroNomeDoCliente } from "@/utils/admin-dashboard";
import { CLASSES_DO_BADGE, ConteudoDoBadge } from "./BadgeDeSituacao";
import { num } from "./comuns";
import { BotaoDeOrdenar, ariaSort, ordenarLista, proximaOrdem, type Ordem } from "./ordenacao";

// Tabela dos chamados de UMA situação, aberta dentro do card "Chamados abertos" quando se
// clica no badge dela: número, cliente, assunto e consultor.

export type ColunaDoAberto = "chamado" | "cliente" | "assunto" | "consultor";

const COLUNAS: { id: ColunaDoAberto; texto: string }[] = [
  { id: "chamado", texto: "Chamado" },
  { id: "cliente", texto: "Cliente" },
  { id: "assunto", texto: "Assunto" },
  { id: "consultor", texto: "Consultor" },
];

const valorDaColuna = (c: ChamadoAbertoNoDashboard, coluna: ColunaDoAberto): string | number => {
  switch (coluna) {
    case "chamado":
      return c.codChamado;
    case "cliente":
      return c.cliente;
    case "assunto":
      return c.assunto;
    case "consultor":
      return c.consultor;
  }
};

// Ordem padrão (ao abrir e no terceiro clique): pelo número do chamado, do mais antigo ao mais novo.
export function ordenarAbertos(lista: ChamadoAbertoNoDashboard[], ordem: Ordem<ColunaDoAberto>): ChamadoAbertoNoDashboard[] {
  const { coluna, crescente } = ordem ?? { coluna: "chamado" as const, crescente: true };

  return ordenarLista(lista, (c) => valorDaColuna(c, coluna), crescente, (a, b) => a.codChamado - b.codChamado);
}

type Props = {
  id: string;
  status: string;
  rotulo: string;
  // classes de cor do badge da situação (a mesma cor do badge que abriu a lista)
  corDoBadge: string;
  lista: ChamadoAbertoNoDashboard[];
  onFechar: () => void;
};

export default function ListaDaSituacao({ id, status, rotulo, corDoBadge, lista, onFechar }: Props) {
  const botaoFechar = useRef<HTMLButtonElement>(null);

  // o badge que o usuário clicou sumiu da fileira (veio para este cabeçalho): o foco vai para o
  // "Fechar", senão ele se perderia junto com o elemento que desapareceu
  useEffect(() => {
    botaoFechar.current?.focus({ preventScroll: true });
  }, []);

  const [ordem, setOrdem] = useState<Ordem<ColunaDoAberto>>(null);
  const linhas = useMemo(() => ordenarAbertos(lista, ordem), [lista, ordem]);

  return (
    <div id={id} role="region" aria-label={`Chamados: ${rotulo}`} className="overflow-hidden rounded-xl border border-slate-200 motion-safe:animate-modal-fade dark:border-slate-700">
      <header className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-2 dark:bg-slate-900/40">
        {/* o badge da situação clicada: o mesmo da fileira, que sumiu de lá. Aqui ele só informa (não é botão) */}
        <div data-situacao-aberta={status} className={`${CLASSES_DO_BADGE} motion-safe:animate-modal-fade ${corDoBadge}`}>
          <ConteudoDoBadge quantidade={lista.length} rotulo={rotulo} />
        </div>
        <button
          type="button"
          ref={botaoFechar}
          aria-label="Fechar a lista"
          onClick={onFechar}
          className="cursor-pointer rounded-full p-1 text-slate-500 outline-none transition hover:bg-slate-200 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-[#0f3d63] dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          <TbX aria-hidden size={18} />
        </button>
      </header>

      {/* rolagem própria: com muitos chamados a lista não estica o card; o cabeçalho da tabela fica fixo */}
      <div className="max-h-96 overflow-auto">
        <table className="w-full min-w-[560px] border-collapse text-[11px] text-slate-800 dark:text-slate-100">
          <caption className="sr-only">Chamados em aberto: {rotulo}; por padrão, do mais antigo para o mais novo</caption>
          <thead className="sticky top-0 bg-white dark:bg-slate-800">
            <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {COLUNAS.map((c) => (
                <th key={c.id} scope="col" aria-sort={ariaSort(ordem, c.id)} className={c.id === "chamado" ? "py-1.5 pl-4 pr-3" : "pr-3"}>
                  <BotaoDeOrdenar
                    texto={c.texto}
                    coluna={c.id}
                    ordem={ordem}
                    onOrdenar={(coluna) => setOrdem((atual) => proximaOrdem(atual, coluna))}
                    className="cursor-pointer rounded px-0.5 font-bold uppercase tracking-wide outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#0f3d63]"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((c) => (
              <tr key={c.codChamado} className="border-b border-slate-100 dark:border-slate-700/60">
                <td className="py-1.5 pl-4 pr-3 font-semibold tabular-nums">{num(c.codChamado)}</td>
                {/* só o primeiro nome do cliente (cabe na tabela); o nome completo aparece ao passar o mouse */}
                <td className="max-w-[200px] truncate pr-3" title={c.cliente}>
                  {primeiroNomeDoCliente(c.cliente)}
                </td>
                <td className="max-w-[320px] truncate pr-3" title={c.assunto}>
                  {c.assunto}
                </td>
                {/* só os 2 primeiros nomes (cabe na tabela); o nome completo aparece ao passar o mouse */}
                <td className="whitespace-nowrap pr-3" title={c.consultor}>
                  {doisPrimeirosNomes(c.consultor)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
