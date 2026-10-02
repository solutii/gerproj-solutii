import type { PainelResposta } from "@/types/painel";
import { formatarHoras } from "@/utils/painel/horas";
import Tooltip from "@/components/tooltip";
import Cartao, { dataBR } from "./Cartao";

type Props = {
  dados: PainelResposta;
  // data (e horário) para o próximo apontamento
  onApontarEm: (data: string, inicio?: string, fim?: string) => void;
};

const botaoLivre =
  "rounded-md border border-green-700 dark:border-green-400 bg-green-50 dark:bg-green-950/40 px-2.5 py-1 text-xs font-semibold tabular-nums text-green-800 dark:text-green-300 cursor-pointer transition hover:bg-green-100 dark:hover:bg-green-900/50 outline-none focus-visible:ring-2 focus-visible:ring-green-600";

export default function Hoje({ dados, onApontarEm }: Props) {
  const h = dados.hojeBloco;

  return (
    <Cartao titulo="Hoje" subtitulo={`${dataBR(h.data)} · agora são ${h.agora}`}>
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Já lançado hoje ({formatarHoras(h.minutosHoje)})
        </p>
        {h.osDeHoje.length === 0 ? (
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Nenhuma OS lançada hoje.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {h.osDeHoje.map((o) => (
              <li key={o.codOs} className="text-xs font-medium text-slate-700 dark:text-slate-200">
                <span className="font-bold tabular-nums text-slate-800 dark:text-white">
                  {o.inicio}–{o.fim}
                </span>{" "}
                · {formatarHoras(o.minutos)} · {o.cliente} · {o.tarefa}
              </li>
            ))}
          </ul>
        )}
      </div>

      {h.ehDiaUtil && (
        <p
          className={`text-sm font-semibold ${
            h.faltaJornadaMin > 0 ? "text-amber-700 dark:text-amber-300" : "text-green-700 dark:text-green-400"
          }`}
        >
          {h.faltaJornadaMin > 0
            ? `Faltam ${formatarHoras(h.faltaJornadaMin)} para completar a jornada de ${formatarHoras(dados.jornadaDiariaMin)}.`
            : "Jornada de hoje completa."}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Horários livres até agora
        </p>
        {h.livres.length === 0 ? (
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Sem horários livres até agora.</p>
        ) : (
          <>
            <ul className="flex flex-wrap gap-1.5">
              {h.livres.map((l) => (
                <li key={`${l.inicio}-${l.fim}`}>
                  <Tooltip content={`Abre o apontamento de hoje, das ${l.inicio} às ${l.fim}`}>
                  <button
                    type="button"
                    className={botaoLivre}
                    onClick={() => onApontarEm(h.data, l.inicio, l.fim)}
                    aria-label={`Apontar hoje das ${l.inicio} às ${l.fim}`}
                  >
                    {l.inicio}–{l.fim}
                  </button>
                  </Tooltip>
                </li>
              ))}
            </ul>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
              Clique num horário livre para deixar o apontamento já preenchido.
            </p>
          </>
        )}
      </div>

      <Tooltip content="Vai para a aba Tarefas com a data de hoje já definida">
      <button
        type="button"
        onClick={() => onApontarEm(h.data)}
        className="self-start rounded-md border border-blue-900 bg-gradient-to-br from-blue-600 to-blue-700 px-4 py-2 text-sm font-medium text-white depth-btn cursor-pointer transition hover:-translate-y-0.5 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        Apontar hoje
      </button>
      </Tooltip>
    </Cartao>
  );
}
