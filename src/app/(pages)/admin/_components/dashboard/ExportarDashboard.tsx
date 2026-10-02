"use client";

import { useState } from "react";
import type { DashboardResposta } from "@/types/admin-dashboard";
import { baixarArquivo, imprimirHtml } from "@/utils/baixar";
import { csvDashboard, htmlDashboard } from "@/utils/admin-dashboard-export";
import { botaoSecundario } from "../estilos";

// Exporta o que está na tela (os mesmos números), sem nova consulta ao banco.
export default function ExportarDashboard({ dados }: { dados: DashboardResposta }) {
  const [erro, setErro] = useState<string | null>(null);

  function exportar(formato: "csv" | "pdf") {
    setErro(null);

    try {
      if (formato === "csv") baixarArquivo(`dashboard-${dados.mes}.csv`, csvDashboard(dados), "text/csv;charset=utf-8");
      else imprimirHtml(htmlDashboard(dados));
    } catch {
      setErro("Não foi possível gerar a exportação.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={botaoSecundario} onClick={() => exportar("csv")}>
        Baixar Excel (CSV)
      </button>
      <button type="button" className={botaoSecundario} onClick={() => exportar("pdf")}>
        Imprimir / salvar PDF
      </button>
      {erro && (
        <span role="alert" className="text-xs font-semibold text-red-700 dark:text-red-300">
          {erro}
        </span>
      )}
    </div>
  );
}
