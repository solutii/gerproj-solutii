import type { ReactNode } from "react";
import type { PainelResposta } from "@/types/painel";
import { formatarHoras } from "@/utils/painel/horas";
import Cartao from "./Cartao";

// `deOutro`: o painel é visto por outra pessoa (administrador), então os títulos não falam em primeira pessoa.
// `acoes`: botões opcionais no cabeçalho de cada cartão (usados só no painel do administrador)
type Props = { dados: PainelResposta; deOutro?: boolean; acoes?: { sla?: ReactNode; faturamento?: ReactNode; avaliacoes?: ReactNode } };

const estrelas = (nota: number) => "★".repeat(Math.round(nota)) + "☆".repeat(5 - Math.round(nota));

export default function Resultado({ dados, deOutro = false, acoes }: Props) {
  const { sla, faturamento, avaliacoes } = dados.resultado;
  const totalMin = faturamento.faturavelMin + faturamento.naoFaturavelMin;
  const pctFaturavel = totalMin > 0 ? Math.round((faturamento.faturavelMin / totalMin) * 100) : 0;

  return (
    <>
      <Cartao acao={acoes?.sla} titulo={deOutro ? "SLA dos chamados" : "SLA dos meus chamados"} subtitulo="Chamados finalizados no mês">
        {sla.total === 0 ? (
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Nenhum chamado com SLA finalizado neste mês.
          </p>
        ) : (
          <>
            <p
              className={`text-4xl font-extrabold tabular-nums ${
                (sla.percentualNoPrazo ?? 0) >= 80
                  ? "text-green-700 dark:text-green-400"
                  : "text-amber-700 dark:text-amber-300"
              }`}
            >
              {sla.percentualNoPrazo}%
            </p>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {sla.noPrazo} de {sla.total} no prazo · {sla.foraDoPrazo} fora do prazo
            </p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Tempo médio do envio do chamado até a finalização: {formatarHoras(Math.round((sla.tempoMedioHoras ?? 0) * 60))}{" "}
              úteis (8h às 18h, segunda a sexta, sem feriados nacionais).
            </p>
          </>
        )}
      </Cartao>

      <Cartao acao={acoes?.faturamento} titulo={deOutro ? "Faturamento das horas" : "Faturamento das minhas horas"} subtitulo="OS lançadas no mês">
        {totalMin === 0 ? (
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Nenhuma OS neste mês.</p>
        ) : (
          <>
            <p className="text-4xl font-extrabold tabular-nums text-slate-800 dark:text-white">{pctFaturavel}%</p>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">das horas são faturáveis</p>
            <div
              role="img"
              aria-label={`${formatarHoras(faturamento.faturavelMin)} faturáveis e ${formatarHoras(faturamento.naoFaturavelMin)} não faturáveis`}
              className="flex h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
            >
              <div className="h-full bg-green-600 dark:bg-green-400" style={{ width: `${pctFaturavel}%` }} />
            </div>
            <ul className="text-xs font-medium text-slate-600 dark:text-slate-300 flex flex-col gap-0.5">
              <li>
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-600 dark:bg-green-400 mr-1.5" />
                Faturáveis: {formatarHoras(faturamento.faturavelMin)}
              </li>
              <li>
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-slate-300 dark:bg-slate-600 mr-1.5" />
                Não faturáveis: {formatarHoras(faturamento.naoFaturavelMin)}
              </li>
              <li>Já faturadas: {formatarHoras(faturamento.faturadoMin)}</li>
            </ul>
          </>
        )}
      </Cartao>

      <Cartao acao={acoes?.avaliacoes} titulo="Avaliações dos clientes" subtitulo={deOutro ? "Todos os chamados avaliados" : "Todos os seus chamados avaliados"}>
        {avaliacoes.quantidade === 0 ? (
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Ainda sem avaliações.</p>
        ) : (
          <>
            <p className="text-4xl font-extrabold tabular-nums text-slate-800 dark:text-white">
              {String(avaliacoes.media).replace(".", ",")}
              <span className="ml-2 text-xl text-amber-500" aria-hidden="true">
                {estrelas(avaliacoes.media ?? 0)}
              </span>
            </p>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              média de {avaliacoes.quantidade} {avaliacoes.quantidade === 1 ? "avaliação" : "avaliações"}
            </p>
            <ul className="flex flex-col gap-1.5">
              {avaliacoes.ultimas.map((a) => (
                <li
                  key={a.codChamado}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  <span className="font-bold text-slate-800 dark:text-white">#{a.codChamado}</span> · nota {a.nota}
                  {a.comentario && <span className="block text-slate-500 dark:text-slate-400">“{a.comentario}”</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </Cartao>
    </>
  );
}
