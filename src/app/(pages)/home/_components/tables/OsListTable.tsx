"use client";

import { useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { useIsMutating } from "@tanstack/react-query";
import Loading from "@/components/loading";
import { useOsLista } from "@/hooks/queries/leituras";
import { useHomeStore } from "@/stores/home-store";
import { useAlertStore } from "@/stores/alert-store";
import { useChamados, useTarefas } from "@/hooks/queries/leituras";
import { destinoParaRepetir } from "@/utils/repetir-apontamento";
import { handleEdit, repetirApontamento, validCurrentDate } from "../homeActions";
import { TbCopy, TbEdit, TbTrash, TbInbox } from "react-icons/tb";
import Tooltip from "@/components/tooltip";
import ColumnFilterInput, { DisabledFilterInput } from "@/components/column-filter-input";

type Props = {
  onDelete: (os: any) => void;
};

// A tabela original não tinha ordenação por coluna (sem onClick no cabeçalho)
// -- mantemos isso, só usando o modelo básico do TanStack (sem sorting), pra
// não adicionar um comportamento que não existia.
const columnHelper = createColumnHelper<any>();

const columns = [
  columnHelper.accessor("COD_OS", {
    header: "Número",
    enableSorting: false,
    filterFn: "includesString",
  }),
  columnHelper.accessor("NOME_CLIENTE", {
    header: "Cliente",
    enableSorting: false,
  }),
  columnHelper.accessor("OBS", { header: "Descrição", enableSorting: false }),
  columnHelper.accessor("DTINI_OS", {
    header: "Data Lançamento",
    enableSorting: false,
  }),
  columnHelper.accessor("HRINI_OS", {
    header: "Hora Início",
    enableSorting: false,
  }),
  columnHelper.accessor("HRFIM_OS", {
    header: "Hora Fim",
    enableSorting: false,
  }),
];

// Larguras fixas por coluna (table-layout: fixed) -- a coluna Tarefa (OBS) não
// tem largura definida aqui de propósito, pra sobrar menos espaço pra ela e
// truncar o texto com "...".
const COLUMN_WIDTHS: Record<string, string> = {
  COD_OS: "w-24",
  NOME_CLIENTE: "w-32",
  DTINI_OS: "w-28",
  HRINI_OS: "w-28",
  HRFIM_OS: "w-28",
};

function getTimeOs(horaIni: string, horaFim: string) {
  let totalHours = 0;

  let minutesIni = parseInt(horaIni.substring(2, 4));
  minutesIni = minutesIni == 0 ? 0 : 60 - minutesIni;
  let minutesFim = parseInt(horaFim.substring(2, 4));

  totalHours = minutesIni == 0 ? 0 : -1;

  let totalMinutes = minutesIni + minutesFim;

  if (totalMinutes >= 60) {
    totalHours += 1;
    totalMinutes -= 60;
  }

  let hoursIni = parseInt(horaIni.substring(0, 2));
  let hoursFim = parseInt(horaFim.substring(0, 2));

  totalHours += hoursFim - hoursIni;

  return `0${totalHours}`.slice(-2) + ":" + `0${totalMinutes}`.slice(-2);
}

export default function OsListTable({ onDelete }: Props) {
  const { selectedCall, selectedProj, selectedDate, selectedOs } = useHomeStore();
  // A lista deriva do que está selecionado (chamado, tarefa ou data) e vem do cache do Query.
  const { lista: listOs, carregando } = useOsLista();
  // Excluir OS e vincular tarefa/classificação também mostram o carregando da lista.
  const mutandoOs =
    useIsMutating({ predicate: (m) => m.meta?.carregandoOs === true }) > 0;
  const loadingOs = carregando || mutandoOs;
  // Chamados e tarefas já estão em cache (a Home os carrega): sem requisição nova.
  const { data: chamados = [] } = useChamados();
  const { data: tarefas = [] } = useTarefas();
  const showAlert = useAlertStore((state) => state.showAlert);

  // Repetir: abre o apontamento (StandBy ou tarefa) com a descrição desta OS.
  function repetir(os: any) {
    const destino = destinoParaRepetir(os, chamados, tarefas);

    if (destino.tipo === "indisponivel") {
      showAlert(destino.motivo, "warning");
      return;
    }

    repetirApontamento(destino);
  }
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data: listOs,
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  function totalTimesOs() {
    return listOs.reduce((accum: any, current: any) => {
      let time = getTimeOs(current.HRINI_OS, current.HRFIM_OS);

      if (accum === 0) {
        return time;
      }

      let [hours, minutes] = time.split(":");
      let [hoursAcum, minutesAccum] = accum.split(":");

      let hoursTotal = parseInt(hours) + parseInt(hoursAcum);
      let minutesTotal = parseInt(minutes) + parseInt(minutesAccum);

      if (minutesTotal >= 60) {
        minutesTotal -= 60;
        hoursTotal += 1;
      }

      return `0${hoursTotal}`.slice(-2) + ":" + `0${minutesTotal}`.slice(-2);
    }, 0);
  }

  if (loadingOs) {
    return <Loading />;
  }

  if (!listOs?.length) {
    if (!selectedCall && !selectedProj && !selectedDate) return null;

    return (
      <section className="w-full sm:text-sm text-xs overflow-auto">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm flex flex-col items-center justify-center gap-2 py-10 text-slate-400 dark:text-slate-500">
          <TbInbox size={36} className="depth-icon" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Nenhuma OS encontrada{" "}
            {selectedCall
              ? "para este chamado"
              : selectedProj
                ? "para esta tarefa"
                : "nesta data"}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full sm:text-sm text-xs overflow-auto">
      <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
        <table className="w-full min-w-full border-collapse table-fixed text-slate-800 dark:text-slate-100 [&_td]:border-r [&_td]:border-slate-200 dark:[&_td]:border-slate-700 [&_tr>*:last-child]:border-r-0">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="text-cyan-50 bg-[#0f3d63] h-10 text-xs uppercase tracking-wide text-center"
              >
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={COLUMN_WIDTHS[header.column.id] ?? ""}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </th>
                ))}
                <th className="w-28">Qtd. Hr&apos;s Gastas</th>
                <th className="w-36">Ações</th>
              </tr>
            ))}
            <tr className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              {table.getHeaderGroups()[0].headers.map((header) => (
                <th key={header.id} className="p-1.5">
                  <ColumnFilterInput column={header.column} />
                </th>
              ))}
              <th className="w-28 p-1.5">
                <DisabledFilterInput />
              </th>
              <th className="w-36 p-1.5">
                <DisabledFilterInput />
              </th>
            </tr>
          </thead>

          <tbody className="max-h-[300px] overflow-auto text-xs">
            {table.getRowModel().rows.map((row) => {
              const os = row.original;
              return (
                <tr
                  key={os?.COD_OS}
                  className={
                    "border-b border-slate-200 dark:border-slate-700 transition-colors duration-150" +
                    (os?.COD_OS === selectedOs?.COD_OS
                      ? " !bg-cyan-200 dark:!bg-cyan-800/70 font-semibold shadow-[inset_4px_0_0_0_#0f3d63] outline outline-2 outline-cyan-500 dark:outline-cyan-400 -outline-offset-2"
                      : " hover:bg-slate-200 dark:hover:bg-slate-600/60")
                  }
                >
                  <td className="p-2 text-center">
                    {os?.COD_OS.toLocaleString("pt-br")}
                  </td>
                  <td className="p-2 text-center">{os.NOME_CLIENTE}</td>
                  <td className="p-2 max-w-0">
                    <Tooltip content={os.OBS} className="relative flex min-w-0">
                      <span className="truncate">{os.OBS}</span>
                    </Tooltip>
                  </td>
                  <td className="p-2 text-center">
                    {new Date(os.DTINI_OS).toLocaleString("pt-br", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    })}
                  </td>
                  <td className="p-2 text-center">
                    {os.HRINI_OS.replace(/(\d{2})(\d{2})/g, "$1:$2")}
                  </td>
                  <td className="p-2 text-center">
                    {os.HRFIM_OS.replace(/(\d{2})(\d{2})/g, "$1:$2")}
                  </td>
                  <td className="p-2 text-center">
                    {getTimeOs(os.HRINI_OS, os.HRFIM_OS)}
                  </td>
                  <td>
                    <div className="flex flex-row gap-2 justify-evenly">
                      <Tooltip content="Repetir apontamento (mesma descrição, nova data e horário)">
                        <TbCopy
                          onClick={() => repetir(os)}
                          style={{ cursor: "pointer" }}
                          className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-full p-1 transition hover:scale-125 depth-icon"
                          size={28}
                        />
                      </Tooltip>
                    {validCurrentDate(os.DTINI_OS) && (
                      <>
                        <Tooltip content="Editar apontamento">
                          <TbEdit
                            onClick={() => handleEdit(os)}
                            style={{ cursor: "pointer" }}
                            className="text-blue-600 hover:text-blue-400 hover:bg-blue-50 rounded-full p-1 transition hover:scale-125 depth-icon"
                            size={28}
                          />
                        </Tooltip>
                        <Tooltip content="Excluir apontamento">
                          <TbTrash
                            onClick={() => onDelete(os)}
                            style={{ cursor: "pointer" }}
                            className="text-red-700 hover:text-red-500 hover:bg-red-50 rounded-full p-1 transition hover:scale-125 depth-icon"
                            size={28}
                          />
                        </Tooltip>
                      </>
                    )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[#0f3d63] text-xs">
              <td colSpan={6} className="p-2 !border-r-0"></td>
              <td className="p-2 text-center text-cyan-50 font-semibold !border-r-0">
                {totalTimesOs()}h
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
