// Classes compartilhadas pelas abas e pelos modais do painel de administração
// (mesmo visual das tabelas e dos campos da Home).

export const cartao =
  "w-full bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden";

export const cabecalhoDaTabela = "text-cyan-50 bg-[#0f3d63] h-11 text-xs uppercase tracking-wide text-center";

export const celula = "p-2 text-center align-middle";

export const rotulo = "text-sm font-medium tracking-wider text-slate-800 dark:text-white select-none";

export const ajuda = "text-xs font-medium text-slate-500 dark:text-slate-300";

export const campo =
  "text-sm border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 font-medium text-slate-900 dark:text-white dark:[color-scheme:dark] placeholder:text-slate-500 placeholder:font-medium outline-none rounded-lg p-2.5 w-full shadow-[inset_0_1.5px_0_rgba(255,255,255,0.9),inset_0_-2px_3px_rgba(0,0,0,0.06),0_1px_1px_rgba(0,0,0,0.08),0_10px_24px_-8px_rgba(0,0,0,0.35)] dark:shadow-[0_8px_18px_-8px_rgba(0,0,0,0.8)] transition focus:border-[#0f3d63] focus:ring-2 focus:ring-[#0f3d63]/30";

export const campoBusca =
  "h-9 w-full sm:w-72 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm outline-none transition focus:border-[#0f3d63] focus:ring-2 focus:ring-[#0f3d63]/20";

export const botaoSecundario =
  "rounded-md border border-slate-400 dark:border-slate-600 bg-gradient-to-br from-white to-slate-100 dark:from-slate-700 dark:to-slate-800 depth-btn-soft px-4 py-1.5 text-sm font-medium text-slate-700 dark:text-white cursor-pointer transition hover:-translate-y-0.5 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-[#0f3d63] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0";

export const selo = {
  sim: "inline-block rounded-md bg-green-100 dark:bg-green-900/40 px-2 py-0.5 text-xs font-bold text-green-800 dark:text-green-300",
  nao: "inline-block rounded-md bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-xs font-bold text-slate-700 dark:text-slate-200",
  alerta: "inline-block rounded-md bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-200",
  erro: "inline-block rounded-md bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-bold text-red-800 dark:text-red-300",
};
