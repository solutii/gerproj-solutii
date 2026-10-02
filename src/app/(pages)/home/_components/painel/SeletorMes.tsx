"use client";

import { mesAnterior, mesAtual, mesProximo, nomeDoMes } from "@/utils/painel/periodo";

type Props = {
  mes: string;
  onChange: (mes: string) => void;
  carregando: boolean;
};

const botao =
  "h-9 w-9 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-white font-medium cursor-pointer transition hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-[#0f3d63]";

export default function SeletorMes({ mes, onChange, carregando }: Props) {
  const corrente = mesAtual();
  const noMesAtual = mes >= corrente;

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Escolher o mês do painel">
      <button type="button" className={botao} onClick={() => onChange(mesAnterior(mes))} aria-label="Mês anterior">
        ‹
      </button>
      <p
        className="min-w-[10.5rem] text-center text-sm font-semibold text-slate-800 dark:text-white first-letter:uppercase"
        aria-live="polite"
      >
        {nomeDoMes(mes)}
      </p>
      <button
        type="button"
        className={botao}
        onClick={() => onChange(mesProximo(mes))}
        disabled={noMesAtual}
        aria-label="Próximo mês"
      >
        ›
      </button>
      {mes !== corrente && (
        <button
          type="button"
          onClick={() => onChange(corrente)}
          className="h-9 px-3 rounded-lg text-xs font-semibold text-[#0f3d63] dark:text-cyan-300 cursor-pointer hover:underline outline-none focus-visible:ring-2 focus-visible:ring-[#0f3d63]"
        >
          Voltar ao mês atual
        </button>
      )}
      {carregando && (
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500" role="status">
          Atualizando...
        </span>
      )}
    </div>
  );
}
