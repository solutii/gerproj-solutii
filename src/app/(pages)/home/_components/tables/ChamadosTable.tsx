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
import { ChamadosType, STATUS_CHAMADO } from "@/types/chamados";
import { useHomeStore } from "@/stores/home-store";
import { useAlertStore } from "@/stores/alert-store";
import {
  changeSelectedCall,
  openAccess,
  openDescriptions,
  selectCallRow,
} from "../homeActions";
import StatusBadge from "./StatusBadge";
import Tooltip from "@/components/tooltip";
import ColumnFilterInput, { DisabledFilterInput } from "@/components/column-filter-input";
import {
  TbArrowsSort,
  TbSortAscending,
  TbSortDescending,
  TbCircleCheck,
  TbPlayerPlay,
  TbPlayerPause,
  TbHourglass,
  TbFileSearch,
  TbKey,
  TbUpload,
  TbDownload,
} from "react-icons/tb";

type Props = {
  onStart: (chamado: ChamadosType) => void;
  onChangeStatus: (chamado: ChamadosType, status: string) => void;
};

const columnHelper = createColumnHelper<ChamadosType>();

// Só as colunas que já eram clicáveis pra ordenar na tabela original.
const columns = [
  columnHelper.accessor("COD_CHAMADO", { header: "Número", filterFn: "includesString" }),
  columnHelper.accessor("ASSUNTO_CHAMADO", { header: "Assunto" }),
  columnHelper.display({ id: "DETALHE", header: "Detalhe" }),
  columnHelper.accessor("EMAIL_CHAMADO", {
    header: "E-mail Chamado",
    enableSorting: false,
  }),
  columnHelper.accessor("DTENVIO_CHAMADO", { header: "Data Atribuição" }),
  columnHelper.accessor("STATUS_CHAMADO", { header: "Status" }),
];

// Larguras fixas por coluna (table-layout: fixed) -- a coluna Assunto não tem
// largura definida de propósito, pra sobrar mais espaço pra ela.
const COLUMN_WIDTHS: Record<string, string> = {
  COD_CHAMADO: "w-32",
  DETALHE: "w-24",
  EMAIL_CHAMADO: "w-72",
  DTENVIO_CHAMADO: "w-48",
  STATUS_CHAMADO: "w-56",
};

export default function ChamadosTable({ onStart, onChangeStatus }: Props) {
  const {
    calls,
    selectedCall,
    setSelectedCall,
    setModalStandby,
    setIsUploading,
  } = useHomeStore();
  const showAlert = useAlertStore((state) => state.showAlert);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data: calls,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableSortingRemoval: true,
  });

  function handleUpload(chamado: ChamadosType, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("codChamado", String(chamado?.COD_CHAMADO));

    setIsUploading(true);

    fetch("/api/upload/?codChamado=" + chamado?.COD_CHAMADO, {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          showAlert(
            `Arquivo "${file.name}" anexado ao chamado #${chamado?.COD_CHAMADO} com sucesso!`,
            "success",
          );
        } else {
          showAlert(
            data?.message ??
              `Não foi possível anexar o arquivo "${file.name}" ao chamado #${chamado?.COD_CHAMADO}.`,
            "warning",
          );
        }
      })
      .catch(() =>
        showAlert(
          `Não foi possível anexar o arquivo "${file.name}" ao chamado #${chamado?.COD_CHAMADO}. Verifique sua conexão e tente novamente.`,
          "error",
        ),
      )
      .finally(() => setIsUploading(false));
  }

  function handleDownload(chamado: ChamadosType) {
    fetch("/api/arquivos?codChamado=" + chamado?.COD_CHAMADO)
      .then(async (res) => {
        const contentType = res.headers.get("Content-Type") ?? "";

        if (!contentType.includes("zip")) {
          showAlert(
            `O chamado #${chamado?.COD_CHAMADO} não possui arquivos anexados.`,
            "warning",
          );
          return;
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `chamado-${chamado?.COD_CHAMADO}.zip`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch(() =>
        showAlert(
          `Não foi possível baixar os arquivos do chamado #${chamado?.COD_CHAMADO}. Verifique sua conexão e tente novamente.`,
          "error",
        ),
      );
  }

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
            <th className="w-32">Ações</th>
            <th className="w-24">Acesso</th>
            <th className="w-28">Arquivos</th>
          </tr>
        ))}
        <tr className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          {table.getHeaderGroups()[0].headers.map((header) => (
            <th key={header.id} className="p-1.5">
              {header.column.getCanFilter() ? (
                <ColumnFilterInput column={header.column} />
              ) : (
                <DisabledFilterInput />
              )}
            </th>
          ))}
          <th className="w-32 p-1.5">
            <DisabledFilterInput />
          </th>
          <th className="w-24 p-1.5">
            <DisabledFilterInput />
          </th>
          <th className="w-28 p-1.5">
            <DisabledFilterInput />
          </th>
        </tr>
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => {
          const c = row.original;
          return (
            <tr
              key={row.id}
              className={
                "border-b border-slate-200 dark:border-slate-700 transition-all duration-150 cursor-pointer hover:bg-cyan-200/70 dark:hover:bg-cyan-800/50 hover:shadow-[inset_4px_0_0_0_#0f3d63]" +
                (c?.COD_CHAMADO === selectedCall?.COD_CHAMADO
                  ? " !bg-cyan-200 dark:!bg-cyan-800/70 font-semibold shadow-[inset_4px_0_0_0_#0f3d63] outline outline-2 outline-cyan-500 dark:outline-cyan-400 -outline-offset-2"
                  : "")
              }
              onClick={() => changeSelectedCall(c)}
            >
              <td className="text-center p-2">
                {c?.COD_CHAMADO?.toLocaleString("pt-br")}
              </td>
              <td className="text-start p-2">{c?.ASSUNTO_CHAMADO}</td>
              <td className="text-center p-2">
                <Tooltip content="Solicitação do chamado">
                  <TbFileSearch
                    onClick={(e) => {
                      e.stopPropagation();
                      openDescriptions(c);
                    }}
                    style={{ cursor: "pointer" }}
                    className="text-fuchsia-700 hover:text-fuchsia-500 hover:bg-fuchsia-50 rounded-full p-1 transition hover:scale-125 depth-icon"
                    size={28}
                  />
                </Tooltip>
              </td>
              <td className="text-start p-2">{c?.EMAIL_CHAMADO}</td>
              <td className="text-center p-2">
                {(c as any)?.DTENVIO_CHAMADO?.replace(" ", " - ")}
              </td>
              <td className="text-center p-2">
                <StatusBadge status={c?.STATUS_CHAMADO} />
              </td>
              <td className="text-center p-2">
                <div className="flex flex-row gap-4 sm:gap-2 flex-wrap sm:flex-nowrap justify-center items-center">
                  {c.STATUS_CHAMADO !== "EM ATENDIMENTO" && (
                    <Tooltip content="Iniciar ou retomar o atendimento, trabalho em andamento.">
                      <TbPlayerPlay
                        onClick={async (e) => {
                          e.stopPropagation();
                          const confirmado = await useAlertStore
                            .getState()
                            .showConfirm(
                              `Deseja iniciar ou retomar o atendimento do chamado #${c.COD_CHAMADO}?`,
                            );
                          if (confirmado) {
                            selectCallRow(c);
                            onStart(c);
                          }
                        }}
                        style={{ cursor: "pointer" }}
                        className="text-blue-600 hover:text-blue-400 hover:bg-blue-50 rounded-full p-1 transition hover:scale-125 depth-icon"
                        size={28}
                      />
                    </Tooltip>
                  )}

                  {c.STATUS_CHAMADO !== "STANDBY" &&
                    c.STATUS_CHAMADO !== "AGUARDANDO VALIDACAO" &&
                    c.STATUS_CHAMADO !== "ATRIBUIDO" && (
                      <Tooltip content="Pausar atendimento, por um motivo externo ou interno.">
                        <TbPlayerPause
                          onClick={async (e) => {
                            e.stopPropagation();
                            const escolha = await useAlertStore
                              .getState()
                              .showChoice(
                                `O que deseja fazer com o chamado #${c.COD_CHAMADO}?`,
                                [
                                  {
                                    id: "apenas",
                                    label:
                                      'Apenas alterar o status para "Standby"',
                                  },
                                  {
                                    id: "apontar",
                                    label:
                                      'Realizar apontamento e alterar o status para "Standby"',
                                  },
                                ],
                              );

                            if (escolha === "apenas") {
                              selectCallRow(c);
                              onChangeStatus(c, STATUS_CHAMADO["STANDBY"]);
                            } else if (escolha === "apontar") {
                              setSelectedCall(c);
                              setModalStandby(true);
                            }
                          }}
                          style={{ cursor: "pointer" }}
                          className="text-yellow-500 hover:text-yellow-300 hover:bg-yellow-50 rounded-full p-1 transition hover:scale-125 depth-icon"
                          size={28}
                        />
                      </Tooltip>
                    )}

                  {c.STATUS_CHAMADO === "STANDBY" && (
                    <Tooltip content="Atendimento concluído, aguardar validação do cliente.">
                      <TbHourglass
                        onClick={async (e) => {
                          e.stopPropagation();
                          const confirmado = await useAlertStore
                            .getState()
                            .showConfirm(
                              `Deseja alterar o chamado #${c.COD_CHAMADO} para "Aguardando Validação"?`,
                            );
                          if (confirmado) {
                            selectCallRow(c);
                            onChangeStatus(
                              c,
                              STATUS_CHAMADO["AGUARDANDO VALIDACAO"],
                            );
                          }
                        }}
                        style={{ cursor: "pointer" }}
                        className="text-orange-500 hover:text-orange-300 hover:bg-orange-50 rounded-full p-1 transition hover:scale-125 depth-icon"
                        size={28}
                      />
                    </Tooltip>
                  )}

                  {c.STATUS_CHAMADO === "AGUARDANDO VALIDACAO" && (
                    <Tooltip content="Finalizar atendimento, trabalho concluído.">
                      <TbCircleCheck
                        onClick={async (e) => {
                          e.stopPropagation();

                          const confirmado = await useAlertStore
                            .getState()
                            .showConfirm(
                              `Deseja finalizar o chamado #${c.COD_CHAMADO}?`,
                            );
                          if (confirmado) {
                            selectCallRow(c);
                            onChangeStatus(c, STATUS_CHAMADO["FINALIZADO"]);
                          }
                        }}
                        style={{ cursor: "pointer" }}
                        className="text-green-600 hover:text-green-400 hover:bg-green-50 rounded-full p-1 transition hover:scale-125 depth-icon"
                        size={28}
                      />
                    </Tooltip>
                  )}
                </div>
              </td>
              <td className="text-center">
                <div className="flex justify-center">
                  <Tooltip content="Dados de acesso do cliente">
                    <TbKey
                      onClick={(e) => {
                        e.stopPropagation();
                        openAccess(c);
                      }}
                      style={{ cursor: "pointer" }}
                      className="text-fuchsia-700 hover:text-fuchsia-500 hover:bg-fuchsia-50 rounded-full p-1 transition hover:scale-125 depth-icon"
                      size={28}
                    />
                  </Tooltip>
                </div>
              </td>
              <td className="text-center">
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row-reverse",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <form
                    action={"/api/upload?codChamado=" + c?.COD_CHAMADO}
                    method="post"
                    encType="multipart/form-data"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectCallRow(c);
                    }}
                  >
                    <input
                      type="file"
                      name="file"
                      accept="image/*"
                      className="hidden"
                      id={`upload-${c?.COD_CHAMADO}`}
                      onChange={(e) => {
                        if (e.target.files?.length) {
                          handleUpload(c, e.target.files[0]);
                        }
                      }}
                    />
                    <Tooltip content="Anexar arquivo">
                      <label
                        htmlFor={`upload-${c?.COD_CHAMADO}`}
                        className="cursor-pointer inline-flex text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-full p-1 transition hover:scale-125 depth-icon"
                      >
                        <TbUpload size={28} />
                      </label>
                    </Tooltip>
                  </form>
                  <Tooltip content="Baixar arquivos">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectCallRow(c);
                        handleDownload(c);
                      }}
                      className="inline-flex text-green-600 hover:text-green-700 hover:bg-green-50 rounded-full p-1 transition hover:scale-125 depth-icon"
                    >
                      <TbDownload size={28} />
                    </button>
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
