import type { PainelResposta, TarefaAndamento } from "@/types/painel";
import { formatarHoras } from "@/utils/painel/horas";
import Tooltip from "@/components/tooltip";
import Cartao, { dataBR } from "./Cartao";

type Props = {
  dados: PainelResposta;
  onIrParaTarefa: (codTarefa: number) => void;
};

// Barra: verde até 85%, âmbar de 85% a 100%, vermelha acima (passou do estimado).
function corDaBarra(percentual: number | null): string {
  if (percentual === null) return "bg-slate-400 dark:bg-slate-500";
  if (percentual > 100) return "bg-red-600 dark:bg-red-400";
  if (percentual >= 85) return "bg-amber-600 dark:bg-amber-400";

  return "bg-green-600 dark:bg-green-400";
}

function textoPrazo(t: TarefaAndamento): string | null {
  if (t.prazo === null || t.diasParaPrazo === null) return null;

  const data = dataBR(t.prazo);
  const dias = Math.abs(t.diasParaPrazo);
  const plural = dias === 1 ? "dia" : "dias";

  if (t.diasParaPrazo < 0) return `Prazo previsto ${data} (vencido há ${dias} ${plural})`;
  if (t.diasParaPrazo === 0) return `Prazo previsto ${data} (vence hoje)`;

  return `Prazo previsto ${data} (faltam ${dias} ${plural})`;
}

export default function TarefasAndamento({ dados, onIrParaTarefa }: Props) {
  const tarefas = dados.tarefasAndamento;

  return (
    <Cartao
      titulo="Minhas tarefas: estimado × lançado"
      subtitulo="Horas lançadas por todos os consultores desde o início · clique para abrir a tarefa"
    >
      {tarefas.length === 0 ? (
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Nenhuma tarefa ativa.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tarefas.map((t) => {
            const prazo = textoPrazo(t);

            return (
              <li key={t.codTarefa}>
                <Tooltip content="Abrir a tarefa na aba Tarefas" className="relative flex w-full">
                <button
                  type="button"
                  onClick={() => onIrParaTarefa(t.codTarefa)}
                  className="w-full text-left rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 flex flex-col gap-1 cursor-pointer transition hover:bg-slate-100 dark:hover:bg-slate-700/60 outline-none focus-visible:ring-2 focus-visible:ring-[#0f3d63]"
                >
                  <span className="text-xs font-bold text-slate-800 dark:text-white">
                    {t.nome} <span className="font-medium text-slate-500 dark:text-slate-400">· {t.cliente}</span>
                  </span>

                  {t.horasEstimadas === null ? (
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {formatarHoras(t.lancadoMin)} lançadas · sem estimativa
                    </span>
                  ) : (
                    <>
                      <span
                        role="progressbar"
                        aria-label={`${t.nome}: ${t.percentual}% das horas estimadas`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.min(100, t.percentual ?? 0)}
                        className="block h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                      >
                        <span
                          className={`block h-full rounded-full ${corDaBarra(t.percentual)}`}
                          style={{ width: `${Math.min(100, t.percentual ?? 0)}%` }}
                        />
                      </span>
                      <span
                        className={`text-xs font-semibold ${
                          (t.percentual ?? 0) > 100 ? "text-red-700 dark:text-red-300" : "text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {formatarHoras(t.lancadoMin)} de {formatarHoras(t.horasEstimadas * 60)} estimadas ({t.percentual}%)
                        {(t.percentual ?? 0) > 100 && " · passou do estimado"}
                      </span>
                    </>
                  )}

                  {prazo && (
                    <span
                      className={`text-xs font-medium ${
                        (t.diasParaPrazo ?? 0) < 0 ? "text-slate-500 dark:text-slate-400" : "text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {prazo}
                    </span>
                  )}
                </button>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      )}
    </Cartao>
  );
}
