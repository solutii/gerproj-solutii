"use client";

import type { Column } from "@tanstack/react-table";
import { TbFilter } from "react-icons/tb";

type Props<T> = {
    column: Column<T, unknown>;
};

// Input de filtro por coluna, usado na linha extra abaixo do cabeçalho das
// tabelas de Chamados, Projetos e OS's -- filtra só sobre os dados já
// carregados na tabela (client-side), via getFilteredRowModel do TanStack.
export default function ColumnFilterInput<T>({ column }: Props<T>) {
    if (!column.getCanFilter()) return null;

    return (
        <div className="relative">
            <TbFilter
                size={14}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
            />
            <input
                type="text"
                value={(column.getFilterValue() as string) ?? ""}
                onChange={(e) => column.setFilterValue(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Filtrar..."
                className="w-full h-7 pl-6 pr-2 text-xs font-normal normal-case rounded-md border border-slate-300 dark:border-slate-600 bg-slate-200 dark:bg-slate-700 dark:text-slate-100 outline-none focus:border-[#0f3d63] focus:ring-2 focus:ring-[#0f3d63]/20"
            />
        </div>
    );
}

// Preenche o espaço das colunas que não têm filtro (Ações, Acesso, Arquivos,
// etc), pra linha de filtros não ficar com buracos vazios no meio.
export function DisabledFilterInput() {
    return (
        <div className="relative">
            <TbFilter
                size={14}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 pointer-events-none"
            />
            <input
                type="text"
                disabled
                className="w-full h-7 pl-6 pr-2 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-slate-200 dark:bg-slate-700/60 cursor-not-allowed"
            />
        </div>
    );
}
