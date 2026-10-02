import { AJUDAS } from "./ajudas";
import type { ReactNode } from "react";
import type { VisaoGeral as Visao } from "@/types/admin-dashboard";
import { formatarHoras } from "@/utils/painel/horas";
import { BarraDePercentual, Bloco, Variacao, num, pct } from "./comuns";

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: ReactNode }) {
  return (
    <div className="flex min-w-[9.5rem] flex-1 flex-col gap-0.5 border-slate-200 px-1 dark:border-slate-700 [&:not(:first-child)]:sm:border-l [&:not(:first-child)]:sm:pl-5">
      <dt className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{rotulo}</dt>
      <dd className="text-2xl font-extrabold tabular-nums text-slate-800 dark:text-white">{valor}</dd>
      {detalhe && <dd className="text-xs font-medium text-slate-500 dark:text-slate-400">{detalhe}</dd>}
    </div>
  );
}

export default function VisaoGeral({ visao: v, nomeMes, ehMesAtual }: { visao: Visao; nomeMes: string; ehMesAtual: boolean }) {
  const bateu = v.metaMesMin > 0 && v.horasMin >= v.metaMesMin;

  return (
    <Bloco ajuda={AJUDAS.visaoGeral} titulo="Visão geral" subtitulo={`${nomeMes} · ${num(v.consultoresAtivos)} consultores ativos`}>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
          <p className="text-4xl font-extrabold tabular-nums text-slate-800 dark:text-white">{formatarHoras(v.horasMin)}</p>
          <p className="pb-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            de {formatarHoras(v.metaMesMin)} de meta ({pct(v.percentualMeta)}) · mês anterior {ehMesAtual ? "no mesmo ponto" : "inteiro"}:{" "}
            {formatarHoras(v.horasMesAnteriorMin)} <Variacao valor={v.variacao} />
          </p>
        </div>
        <BarraDePercentual
          valor={v.percentualMeta}
          rotulo="Horas apontadas por todos os consultores em relação à meta do mês"
          cor={bateu ? "bg-green-600 dark:bg-green-400" : undefined}
        />
      </div>

      <dl className="flex flex-wrap gap-x-0 gap-y-4 border-t border-slate-100 pt-4 dark:border-slate-700">
        <Numero
          rotulo="Chamados abertos"
          valor={num(v.chamadosAbertos)}
          detalhe={v.chamadosParados > 0 ? `${num(v.chamadosParados)} parados há mais de 7 dias` : "nenhum parado"}
        />
        <Numero rotulo="Finalizados no mês" valor={num(v.chamadosFinalizadosNoMes)} />
        <Numero
          rotulo="Sem apontamento"
          valor={`${num(v.consultoresComPendencia)} de ${num(v.consultoresAtivos)}`}
          detalhe="consultores com dia útil sem OS"
        />
        <Numero
          rotulo="Tarefas em risco"
          valor={num(v.tarefasEmRisco)}
          detalhe={`${num(v.tarefasComEstouroLiberado)} com estouro liberado`}
        />
      </dl>
    </Bloco>
  );
}
