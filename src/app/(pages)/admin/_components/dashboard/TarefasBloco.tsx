"use client";

import { AJUDAS } from "./ajudas";
import { TbEdit } from "react-icons/tb";
import Tooltip from "@/components/tooltip";
import type { TarefaAdmin } from "@/types/admin";
import type { TarefaNoDashboard } from "@/types/admin-dashboard";
import { formatarHoras } from "@/utils/painel/horas";
import { selo } from "../estilos";
import { BarraDePercentual, Bloco, SemDados, num, pct, useRecolhimento } from "./comuns";

type Props = {
  emRisco: TarefaNoDashboard[];
  comEstouroLiberado: TarefaNoDashboard[];
  totalEmRisco: number;
  totalComEstouroLiberado: number;
  nomeMes: string;
  onEditar: (tarefa: TarefaAdmin) => void;
};

function rotuloDaSituacao(t: TarefaNoDashboard): { texto: string; classe: string } {
  if (t.situacao === "estourada") return { texto: "Estourada", classe: selo.erro };
  if (t.situacao === "no-limite") return { texto: "No limite", classe: selo.alerta };

  return t.passouDoLimite ? { texto: "Liberada · passou do limite", classe: selo.erro } : { texto: "Estouro liberado", classe: selo.alerta };
}

function Lista({ itens, vazio, onEditar, id }: { itens: TarefaNoDashboard[]; vazio: string; onEditar: (t: TarefaAdmin) => void; id: string }) {
  if (itens.length === 0) return <SemDados>{vazio}</SemDados>;

  return (
    <ul id={id} className="flex flex-col divide-y divide-slate-100 dark:divide-slate-700">
      {itens.map((t) => {
        const { texto, classe } = rotuloDaSituacao(t);
        const limite = t.tarefa.limiteMensalHoras;

        return (
          <li key={t.tarefa.codigo} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2">
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold text-slate-800 dark:text-white" title={t.tarefa.nome}>
                {t.tarefa.nome}
              </span>
              <span className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                {t.tarefa.cliente} · {t.tarefa.responsavel}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={classe}>{texto}</span>
              <Tooltip content={`Editar ${t.tarefa.nome}`}>
                <button
                  type="button"
                  aria-label={`Editar a tarefa ${t.tarefa.nome}`}
                  onClick={() => onEditar(t.tarefa)}
                  className="cursor-pointer rounded-full p-1 text-blue-600 transition hover:scale-125 hover:bg-blue-50 hover:text-blue-400 depth-icon focus-visible:ring-2 focus-visible:ring-[#0f3d63]"
                >
                  <TbEdit size={24} />
                </button>
              </Tooltip>
            </div>
            <div className="col-span-2 flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              {limite === null || limite <= 0 ? (
                <span>{formatarHoras(t.consumoMesMin)} no mês · sem limite mensal</span>
              ) : (
                <>
                  <BarraDePercentual
                    valor={t.percentual}
                    rotulo={`${t.tarefa.nome}: consumo do limite mensal`}
                    cor={t.passouDoLimite ? "bg-red-600 dark:bg-red-400" : (t.percentual ?? 0) >= 80 ? "bg-amber-600 dark:bg-amber-400" : undefined}
                  />
                  <span className="shrink-0 tabular-nums">
                    {formatarHoras(t.consumoMesMin)} de {num(limite)}h ({pct(t.percentual)})
                  </span>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function TarefasBloco({ emRisco, comEstouroLiberado, totalEmRisco, totalComEstouroLiberado, nomeMes, onEditar }: Props) {
  const risco = useRecolhimento(emRisco);
  const liberadas = useRecolhimento(comEstouroLiberado);
  const resto = (mostradas: number, total: number) => (total > mostradas ? `Mostrando as ${num(mostradas)} mais urgentes de ${num(total)}.` : undefined);

  return (
    <>
      <Bloco ajuda={AJUDAS.tarefasPertoDoLimite} titulo="Tarefas perto do limite" subtitulo={`Consumo do limite mensal em ${nomeMes} (80% ou mais, sem estouro liberado)`} acao={risco.botao}>
        <Lista id={risco.idDaLista} itens={risco.visiveis} vazio="Nenhuma tarefa perto do limite mensal." onEditar={onEditar} />
        {resto(emRisco.length, totalEmRisco) && <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{resto(emRisco.length, totalEmRisco)}</p>}
      </Bloco>

      <Bloco ajuda={AJUDAS.tarefasComEstouroLiberado} titulo="Tarefas com estouro liberado" subtitulo="Aceitam apontar acima do limite: lembre de fechar a liberação quando acabar" acao={liberadas.botao}>
        <Lista id={liberadas.idDaLista} itens={liberadas.visiveis} vazio="Nenhuma tarefa com estouro liberado." onEditar={onEditar} />
        {resto(comEstouroLiberado.length, totalComEstouroLiberado) && (
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{resto(comEstouroLiberado.length, totalComEstouroLiberado)}</p>
        )}
      </Bloco>
    </>
  );
}
