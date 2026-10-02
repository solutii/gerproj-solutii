import type { PainelResposta } from "@/types/painel";
import { formatarHoras } from "@/utils/painel/horas";
import Tooltip from "@/components/tooltip";
import Cartao, { diaMes } from "./Cartao";

type Props = {
  dados: PainelResposta;
  onIrParaChamado: (codChamado: number) => void;
  onIrParaTarefa: (codTarefa: number) => void;
  // OS contestada: abre a lista de OS lançadas naquele dia
  onVerOsDoDia: (data: string) => void;
};

function Grupo({ titulo, vazio, quantidade, children }: { titulo: string; vazio: string; quantidade: number; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {titulo} ({quantidade})
      </h4>
      {quantidade === 0 ? (
        <p className="text-sm font-medium text-green-700 dark:text-green-400">{vazio}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">{children}</ul>
      )}
    </div>
  );
}

const item =
  "w-full text-left rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200";

const itemClicavel =
  `${item} cursor-pointer transition hover:bg-slate-100 dark:hover:bg-slate-700/60 outline-none focus-visible:ring-2 focus-visible:ring-[#0f3d63]`;

export default function Pendencias({ dados, onIrParaChamado, onIrParaTarefa, onVerOsDoDia }: Props) {
  const { chamadosParados, tarefas, osContestadas } = dados.pendencias;

  return (
    <Cartao titulo="Pendências" subtitulo="Chamados e tarefas: situação de hoje · OS contestadas: do mês">
      <Grupo titulo="Chamados sem apontamento há mais de 7 dias" vazio="Nenhum chamado parado." quantidade={chamadosParados.length}>
        {chamadosParados.map((c) => (
          <li key={c.codChamado}>
            <Tooltip content={`Abrir o chamado #${c.codChamado} na aba Chamados`} className="relative flex w-full">
            <button type="button" className={itemClicavel} onClick={() => onIrParaChamado(c.codChamado)}>
              <span className="font-bold text-slate-800 dark:text-white">#{c.codChamado}</span> · {c.cliente}
              <span className="block truncate text-slate-500 dark:text-slate-400">{c.assunto}</span>
              <span className="font-semibold text-amber-700 dark:text-amber-300">
                {c.diasParado} dias sem apontar · {c.status}
              </span>
            </button>
            </Tooltip>
          </li>
        ))}
      </Grupo>

      <Grupo titulo="Tarefas no limite ou sem horas" vazio="Nenhuma tarefa em alerta." quantidade={tarefas.length}>
        {tarefas.map((t) => {
          const conteudo = (
            <>
              <span className="font-bold text-slate-800 dark:text-white">{t.nome}</span> · {t.cliente}
              <span
                className={`block font-semibold ${t.situacao === "bloqueada" ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"}`}
              >
                {t.situacao === "bloqueada"
                  ? "Sem horas disponíveis: o apontamento nesta tarefa é recusado"
                  : `${t.percentual}% do limite mensal (${formatarHoras(t.consumoMesMin)} de ${t.limiteMensalHoras}h)`}
              </span>
            </>
          );

          // Só dá para abrir pela tela as tarefas que aparecem na aba Tarefas.
          return (
            <li key={t.codTarefa}>
              {t.naAbaTarefas ? (
                <Tooltip content="Abrir a tarefa na aba Tarefas" className="relative flex w-full">
                  <button type="button" className={itemClicavel} onClick={() => onIrParaTarefa(t.codTarefa)}>
                    {conteudo}
                  </button>
                </Tooltip>
              ) : (
                <div className={item}>{conteudo}</div>
              )}
            </li>
          );
        })}
      </Grupo>

      <Grupo titulo="OS contestadas pelo cliente" vazio="Nenhuma OS contestada." quantidade={osContestadas.length}>
        {osContestadas.map((o) => (
          <li key={o.codOs}>
            <Tooltip content={`Listar as OS lançadas em ${diaMes(o.data)}`} className="relative flex w-full">
            <button type="button" className={itemClicavel} onClick={() => onVerOsDoDia(o.data)}>
              <span className="font-bold text-slate-800 dark:text-white">OS {o.codOs}</span> · {diaMes(o.data)} ·{" "}
              {formatarHoras(o.minutos)} · {o.cliente}
            </button>
            </Tooltip>
          </li>
        ))}
      </Grupo>
    </Cartao>
  );
}
