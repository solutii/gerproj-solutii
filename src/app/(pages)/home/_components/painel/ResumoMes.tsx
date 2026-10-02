import type { PainelResposta } from "@/types/painel";
import { formatarHoras } from "@/utils/painel/horas";
import Tooltip from "@/components/tooltip";
import Cartao, { dataBR, diaMes } from "./Cartao";

type Props = {
  dados: PainelResposta;
  // dia útil sem apontamento escolhido: prepara o apontamento daquela data
  onApontarEm: (data: string) => void;
};

const MAX_DIAS_MOSTRADOS = 12;

function textoProjecao(p: NonNullable<PainelResposta["projecao"]>): { texto: string; alerta: boolean } {
  if (p.situacao === "meta-batida") return { texto: "Meta do mês já batida.", alerta: false };
  if (p.situacao === "sem-dados" || p.mediaDiariaMin === null || p.projecaoMesMin === null) {
    return { texto: "Ainda sem apontamentos suficientes para projetar o mês.", alerta: false };
  }

  if (p.mediaDiariaMin === 0) {
    return {
      texto:
        p.necessarioPorDiaMin === null
          ? "Nenhuma hora apontada neste mês."
          : `Nenhuma hora apontada neste mês ainda. Para bater a meta, são cerca de ${formatarHoras(p.necessarioPorDiaMin)} por dia nos ${p.diasRestantes} dias úteis restantes.`,
      alerta: true,
    };
  }

  const base = `No ritmo atual (média de ${formatarHoras(p.mediaDiariaMin)} por dia útil), o mês fecha em ${formatarHoras(p.projecaoMesMin)}.`;

  if (p.situacao === "no-ritmo") return { texto: `${base} Dentro da meta.`, alerta: false };

  const falta =
    p.necessarioPorDiaMin === null
      ? `Faltam ${formatarHoras(p.faltaParaMetaMin)} e não há mais dias úteis no mês.`
      : `Para bater a meta, faltam ${formatarHoras(p.faltaParaMetaMin)}: cerca de ${formatarHoras(p.necessarioPorDiaMin)} por dia nos ${p.diasRestantes} dias úteis restantes.`;

  return { texto: `${base} Abaixo da meta. ${falta}`, alerta: true };
}

export default function ResumoMes({ dados, onApontarEm }: Props) {
  const { resumo, ehMesAtual, nomeMes, apontarAPartirDe } = dados;
  const pct = resumo.percentualMeta ?? 0;
  const bateu = resumo.metaMesMin > 0 && resumo.horasApontadasMin >= resumo.metaMesMin;
  const saldo = resumo.saldoAteHojeMin;
  const dias = resumo.diasSemApontamento;

  const corBarra = bateu
    ? "bg-green-600 dark:bg-green-400"
    : ehMesAtual && saldo >= 0
      ? "bg-[#0f3d63] dark:bg-sky-400"
      : "bg-amber-600 dark:bg-amber-400";

  return (
    <Cartao titulo="Meu mês" subtitulo={nomeMes} className="xl:col-span-2">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <p className="text-4xl font-extrabold tabular-nums text-slate-800 dark:text-white">
          {formatarHoras(resumo.horasApontadasMin)}
        </p>
        <p className="pb-1 text-sm font-medium text-slate-500 dark:text-slate-400">
          de {formatarHoras(resumo.metaMesMin)} de meta ({resumo.diasUteis} dias úteis ×{" "}
          {formatarHoras(dados.jornadaDiariaMin)})
        </p>
      </div>

      <div
        role="progressbar"
        aria-label="Horas apontadas em relação à meta do mês"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, pct)}
        className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)]"
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${corBarra}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>

      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {resumo.percentualMeta === null
          ? "Sem meta definida para este mês."
          : ehMesAtual
            ? saldo >= 0
              ? `${pct}% da meta do mês. Você está ${formatarHoras(saldo)} à frente da meta até hoje.`
              : `${pct}% da meta do mês. Faltam ${formatarHoras(-saldo)} para a meta até hoje (${formatarHoras(resumo.metaAteHojeMin)}).`
            : bateu
              ? `Meta do mês batida (${pct}%).`
              : `${pct}% da meta: ficaram ${formatarHoras(resumo.metaMesMin - resumo.horasApontadasMin)} abaixo.`}
      </p>

      {dados.projecao &&
        (() => {
          const { texto, alerta } = textoProjecao(dados.projecao);

          return (
            <p
              className={`text-sm font-semibold ${
                alerta ? "text-amber-700 dark:text-amber-300" : "text-slate-600 dark:text-slate-300"
              }`}
            >
              {texto}
            </p>
          );
        })()}

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Dias úteis sem apontamento ({dias.length})
        </p>
        {dias.length === 0 ? (
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            Nenhum dia útil sem apontamento.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {dias.slice(0, MAX_DIAS_MOSTRADOS).map((d) => {
              // Antes do limite o servidor recusaria o apontamento: o dia fica só informativo.
              const podeApontar = d >= apontarAPartirDe;

              return (
                <li key={d}>
                  <Tooltip
                    content={
                      podeApontar
                        ? `Apontar em ${dataBR(d)}: vai para a aba Tarefas com este dia definido`
                        : `Fora do prazo: só é possível apontar a partir de ${dataBR(apontarAPartirDe)}`
                    }
                  >
                  <button
                    type="button"
                    disabled={!podeApontar}
                    onClick={() => onApontarEm(d)}
                    aria-label={
                      podeApontar ? `Apontar em ${dataBR(d)}` : `${dataBR(d)}: fora do prazo para apontar`
                    }
                    className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-800 dark:text-amber-200 cursor-pointer transition hover:bg-amber-200 dark:hover:bg-amber-800/50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-amber-100 outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
                  >
                    {diaMes(d)}
                  </button>
                  </Tooltip>
                </li>
              );
            })}
            {dias.length > MAX_DIAS_MOSTRADOS && (
              <li className="px-1 py-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                +{dias.length - MAX_DIAS_MOSTRADOS}
              </li>
            )}
          </ul>
        )}
      </div>

      <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
        Você pode apontar a partir de {dataBR(apontarAPartirDe)}. Clique num dia para apontar nele.
      </p>
    </Cartao>
  );
}
