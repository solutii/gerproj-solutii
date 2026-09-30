"use client";

import { useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import { TaskType } from "@/types/tarefa";
import { useHomeStore } from "@/stores/home-store";
import { changeSelectedCallTrf, selectProjRow } from "../homeActions";
import Tooltip from "@/components/tooltip";
import ColumnFilterInput, { DisabledFilterInput } from "@/components/column-filter-input";
import {
  TbArrowsSort,
  TbSortAscending,
  TbSortDescending,
  TbClockPlus,
} from "react-icons/tb";

const columnHelper = createColumnHelper<TaskType>();

const columns = [
  columnHelper.accessor("COD_TAREFA", { header: "Número", filterFn: "includesString" }),
  columnHelper.accessor("NOME_TAREFA", { header: "Nome" }),
  columnHelper.accessor("NOME_CLIENTE" as any, {
    header: "Cliente",
    enableSorting: false,
  }),
  columnHelper.accessor("HRREAL_TAREFA" as any, {
    header: "Qtd. Hr's Estimada",
    enableSorting: false,
  }),
  columnHelper.accessor("DTSOL_TAREFA", { header: "Data Solicitação" }),
];

// Larguras fixas por coluna (table-layout: fixed) -- a coluna Assunto não tem
// largura definida de propósito, pra sobrar mais espaço pra ela.
const COLUMN_WIDTHS: Record<string, string> = {
  COD_TAREFA: "w-40",
  NOME_CLIENTE: "w-80",
  HRREAL_TAREFA: "w-48",
  DTSOL_TAREFA: "w-48",
};

export default function ProjetosTable() {
  const { projes, selectedProj, setModalApontamento } = useHomeStore();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data: projes,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableSortingRemoval: true,
  });

  return (
    <table className="w-full min-w-full border-collapse table-fixed text-slate-800 dark:text-slate-100 [&_td]:border-r [&_td]:border-slate-200 dark:[&_td]:border-slate-700 [&_tr>*:last-child]:border-r-0">
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr
            key={headerGroup.id}
            className="text-cyan-50 bg-[#0f3d63] h-11 text-xs uppercase tracking-wide text-center"
          >
            {headerGroup.headers.map((header) => (
              <th
                key={header.id}
                onClick={header.column.getToggleSortingHandler()}
                className={
                  (header.column.getCanSort()
                    ? "cursor-pointer select-none hover:text-cyan-200 "
                    : "") + (COLUMN_WIDTHS[header.column.id] ?? "")
                }
              >
                <span className="inline-flex items-center gap-2">
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                  {header.column.getCanSort() &&
                    (header.column.getIsSorted() === "asc" ? (
                      <TbSortAscending size={18} className="depth-icon" />
                    ) : header.column.getIsSorted() === "desc" ? (
                      <TbSortDescending size={18} className="depth-icon" />
                    ) : (
                      <TbArrowsSort size={18} className="depth-icon" />
                    ))}
                </span>
              </th>
            ))}
            <th className="w-40">Ações</th>
          </tr>
        ))}
        <tr className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          {table.getHeaderGroups()[0].headers.map((header) => (
            <th key={header.id} className="p-1.5">
              <ColumnFilterInput column={header.column} />
            </th>
          ))}
          <th className="w-40 p-1.5">
            <DisabledFilterInput />
          </th>
        </tr>
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => {
          const c = row.original as any;
          return (
            <tr
              key={row.id}
              className={
                "border-b border-slate-200 dark:border-slate-700 transition-all duration-150 cursor-pointer hover:bg-cyan-200/70 dark:hover:bg-cyan-800/50 hover:shadow-[inset_4px_0_0_0_#0f3d63]" +
                (c?.COD_TAREFA === selectedProj?.COD_TAREFA
                  ? " !bg-cyan-200 dark:!bg-cyan-800/70 font-semibold shadow-[inset_4px_0_0_0_#0f3d63] outline outline-2 outline-cyan-500 dark:outline-cyan-400 -outline-offset-2"
                  : "")
              }
              onClick={() => changeSelectedCallTrf(c)}
            >
              <td className="text-center p-2">
                {c?.COD_TAREFA?.toLocaleString("pt-br")}
              </td>
              <td className="text-start p-2">{c?.NOME_TAREFA}</td>
              <td className="text-start p-2">{c?.NOME_CLIENTE}</td>
              <td className="text-center p-2">{c?.HRREAL_TAREFA}h</td>
              <td className="text-center p-2">
                {new Date(c?.DTSOL_TAREFA).toLocaleString("pt-br").slice(0, 10)}
              </td>
              <td className="text-center p-2">
                <div className="flex flex-row gap-4 sm:gap-2 flex-wrap sm:flex-nowrap justify-center items-center">
                  <Tooltip content="Apontar horas">
                    <TbClockPlus
                      onClick={(e) => {
                        e.stopPropagation();
                        selectProjRow(c);
                        setModalApontamento(true);
                      }}
                      style={{ cursor: "pointer" }}
                      className="text-fuchsia-700 hover:text-fuchsia-500 hover:bg-fuchsia-50 rounded-full p-1 transition hover:scale-125 depth-icon"
                      size={28}
                    />
                  </Tooltip>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
