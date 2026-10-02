"use client";

import { useState } from "react";
import { TbEdit } from "react-icons/tb";
import Tooltip from "@/components/tooltip";
import { useTarefasAdmin } from "@/hooks/queries/admin";
import { useDebounce } from "@/hooks/useDebounce";
import { formatarNumero } from "@/utils/painel/horas";
import type { TarefaAdmin } from "@/types/admin";
import EditarTarefaModal from "./EditarTarefaModal";
import EstadoDaLista from "./EstadoDaLista";
import { botaoSecundario, cabecalhoDaTabela, campoBusca, cartao, celula, selo } from "./estilos";

const horas = (v: number | null) => (v === null ? "—" : `${formatarNumero(v)}h`);

export default function TarefasAba() {
  const [busca, setBusca] = useState("");
  const [somenteAtivas, setSomenteAtivas] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [editando, setEditando] = useState<TarefaAdmin | null>(null);

  const termo = useDebounce(busca.trim());
  const consulta = useTarefasAdmin(termo, somenteAtivas, pagina);
  const lista = consulta.data;
  const tarefas = lista?.tarefas ?? [];
  const totalDePaginas = lista ? Math.max(1, Math.ceil(lista.total / lista.porPagina)) : 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="search"
          aria-label="Buscar tarefa por nome, cliente ou código"
          placeholder="Buscar por tarefa, cliente ou código..."
          className={campoBusca}
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setPagina(1);
          }}
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            className="h-4 w-4 cursor-pointer"
            checked={somenteAtivas}
            onChange={(e) => {
              setSomenteAtivas(e.target.checked);
              setPagina(1);
            }}
          />
          Só tarefas em andamento (levantamento, desenvolvimento e teste)
        </label>
      </div>

      <section className={cartao}>
        <EstadoDaLista
          carregando={consulta.isPending}
          erro={consulta.isError && !lista ? consulta.error : null}
          vazio={tarefas.length === 0}
          textoVazio="Nenhuma tarefa encontrada."
          onTentarDeNovo={() => void consulta.refetch()}
        >
          <div className="overflow-auto">
            <table className="w-full min-w-[980px] border-collapse text-xs text-slate-800 dark:text-slate-100 sm:text-sm">
              <thead>
                <tr className={cabecalhoDaTabela}>
                  <th>Código</th>
                  <th className="px-3 text-left">Tarefa</th>
                  <th className="px-3 text-left">Cliente</th>
                  <th className="px-3 text-left">Responsável</th>
                  <th>Status</th>
                  <th>Estouro liberado</th>
                  <th>Limite mensal</th>
                  <th>Horas contratadas</th>
                  <th className="w-20">Ações</th>
                </tr>
              </thead>
              <tbody>
                {tarefas.map((t) => (
                  <tr key={t.codigo} className="border-b border-slate-200 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-700/50">
                    <td className={celula}>{formatarNumero(t.codigo)}</td>
                    <td className="p-2 px-3 font-semibold">{t.nome}</td>
                    <td className="p-2 px-3">{t.cliente}</td>
                    <td className="p-2 px-3">{t.responsavel}</td>
                    <td className={celula}>
                      <span className={t.status >= 1 && t.status <= 3 ? selo.alerta : selo.nao}>{t.statusTexto}</span>
                    </td>
                    <td className={celula}>
                      <span className={t.permiteExceder ? selo.sim : selo.nao}>{t.permiteExceder ? "Sim" : "Não"}</span>
                    </td>
                    <td className={`${celula} tabular-nums`}>{t.limiteMensalHoras === null ? "sem limite" : horas(t.limiteMensalHoras)}</td>
                    <td className={`${celula} tabular-nums`}>{horas(t.horasContratadas)}</td>
                    <td className={celula}>
                      <Tooltip content={`Editar ${t.nome}`}>
                        <button
                          type="button"
                          aria-label={`Editar a tarefa ${t.nome}`}
                          onClick={() => setEditando(t)}
                          className="cursor-pointer rounded-full p-1 text-blue-600 transition hover:scale-125 hover:bg-blue-50 hover:text-blue-400 depth-icon focus-visible:ring-2 focus-visible:ring-[#0f3d63]"
                        >
                          <TbEdit size={26} />
                        </button>
                      </Tooltip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </EstadoDaLista>

        {lista && lista.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-2.5 dark:border-slate-700">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400" aria-live="polite">
              {lista.total} tarefa(s) · página {lista.pagina} de {totalDePaginas}
            </p>
            <div className="flex gap-2">
              <button type="button" className={botaoSecundario} disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
                Anterior
              </button>
              <button type="button" className={botaoSecundario} disabled={pagina >= totalDePaginas} onClick={() => setPagina((p) => p + 1)}>
                Próxima
              </button>
            </div>
          </div>
        )}
      </section>

      {editando && <EditarTarefaModal key={editando.codigo} tarefa={editando} onFechar={() => setEditando(null)} />}
    </div>
  );
}
