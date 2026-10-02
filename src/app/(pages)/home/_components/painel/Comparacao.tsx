import type { ReactNode } from "react";
import type { PainelResposta } from "@/types/painel";
import { formatarHoras } from "@/utils/painel/horas";
import Cartao from "./Cartao";

// `acao`: botão opcional no cabeçalho do cartão (usado só no painel do administrador)
type Props = { dados: PainelResposta; acao?: ReactNode };

// Seta e cor da variação (para cima = melhor, para baixo = pior).
function Variacao({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-xs font-medium text-slate-400 dark:text-slate-500">sem base</span>;
  if (valor === 0) return <span className="text-xs font-bold text-slate-500 dark:text-slate-400">= igual</span>;

  const subiu = valor > 0;

  return (
    <span
      className={`text-xs font-bold tabular-nums ${
        subiu ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-300"
      }`}
    >
      {subiu ? "▲" : "▼"} {Math.abs(valor)}%
    </span>
  );
}

function Linha({ rotulo, atual, anterior, variacao }: { rotulo: string; atual: string; anterior: string; variacao: number | null }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 border-t border-slate-100 dark:border-slate-700 pt-2 first:border-0 first:pt-0">
      <div className="flex flex-col">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{rotulo}</span>
        <span className="text-lg font-extrabold tabular-nums text-slate-800 dark:text-white">{atual}</span>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">antes: {anterior}</span>
      </div>
      <Variacao valor={variacao} />
    </div>
  );
}

export default function Comparacao({ dados, acao }: Props) {
  const c = dados.comparacao;
  const sla = c.sla;

  const slaVariacao =
    sla.atualPercentual !== null && sla.anteriorPercentual !== null ? sla.atualPercentual - sla.anteriorPercentual : null;

  return (
    <Cartao
      acao={acao}
      titulo={`Comparado a ${c.nomeMesAnterior}`}
      subtitulo={c.mesmoPeriodo ? "Mês em andamento: até o mesmo dia útil do mês anterior" : "Mês inteiro contra mês inteiro"}
    >
      <Linha
        rotulo="Horas"
        atual={formatarHoras(c.horas.atualMin)}
        anterior={formatarHoras(c.horas.anteriorMin)}
        variacao={c.horas.variacao}
      />
      <Linha rotulo="OS lançadas" atual={String(c.os.atual)} anterior={String(c.os.anterior)} variacao={c.os.variacao} />
      <Linha
        rotulo="SLA no prazo"
        atual={sla.atualPercentual === null ? "—" : `${sla.atualPercentual}%`}
        anterior={sla.anteriorPercentual === null ? "—" : `${sla.anteriorPercentual}%`}
        variacao={slaVariacao}
      />
      {slaVariacao !== null && (
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500">O SLA varia em pontos percentuais.</p>
      )}
    </Cartao>
  );
}
