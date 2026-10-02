import type { ReactNode } from "react";
import { formatarHoras } from "@/utils/painel/horas";

type Props = {
  titulo: string;
  subtitulo?: string;
  className?: string;
  // ação opcional no canto direito do cabeçalho (ex.: o botão "?" de ajuda do painel do administrador)
  acao?: ReactNode;
  children: ReactNode;
};

// Moldura comum dos blocos do painel (mesmo visual das tabelas da Home).
export default function Cartao({ titulo, subtitulo, className = "", acao, children }: Props) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-5 flex flex-col gap-3 ${className}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {titulo}
          </h3>
          {subtitulo && (
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{subtitulo}</p>
          )}
        </div>
        {acao && <div className="shrink-0">{acao}</div>}
      </header>
      {children}
    </section>
  );
}

// "2026-09-25" -> "25/09"
export const diaMes = (dataISO: string) => `${dataISO.slice(8, 10)}/${dataISO.slice(5, 7)}`;

// "2026-09-01" -> "01/09/2026"
export const dataBR = (dataISO: string) => `${diaMes(dataISO)}/${dataISO.slice(0, 4)}`;

// Alternativa em texto de um gráfico (canvas não é lido por leitor de tela):
// os mesmos números, em tabela, num bloco recolhido.
export function TabelaDoGrafico({
  legenda,
  linhas,
}: {
  legenda: string;
  linhas: { rotulo: string; minutos: number }[];
}) {
  return (
    <details className="text-xs text-slate-500 dark:text-slate-400">
      <summary className="cursor-pointer font-semibold select-none">Ver em tabela</summary>
      <table className="mt-2 w-full max-w-sm">
        <caption className="sr-only">{legenda}</caption>
        <thead>
          <tr className="text-left">
            <th className="font-semibold pr-4">Item</th>
            <th className="font-semibold text-right">Horas</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={`${i}-${l.rotulo}`} className="border-t border-slate-100 dark:border-slate-700">
              <td className="pr-4 py-0.5">{l.rotulo}</td>
              <td className="py-0.5 text-right tabular-nums">{formatarHoras(l.minutos)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
