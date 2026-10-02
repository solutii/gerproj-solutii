"use client";

import { useState } from "react";
import { useExportarEspelho } from "@/hooks/queries/mutacoes";
import { mensagemDoErro } from "@/lib/api";
import { baixarArquivo, imprimirHtml } from "@/utils/baixar";
import { csvEspelho, htmlEspelho } from "@/utils/painel/espelho";

type Props = {
  mes: string;
  nomeMes: string;
  // permite ao pai mostrar a falha no mesmo padrão de alerta da Home
  onErro: (mensagem: string) => void;
};

const botao =
  "rounded-md border border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-white depth-btn cursor-pointer transition hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-[#0f3d63]";

export default function ExportarEspelho({ mes, nomeMes, onErro }: Props) {
  const [ocupado, setOcupado] = useState<"csv" | "pdf" | null>(null);
  // Exportar é uma ação pontual (sempre busca dados frescos), não um dado em cache.
  const buscar = useExportarEspelho();

  async function exportar(formato: "csv" | "pdf") {
    setOcupado(formato);

    try {
      const espelho = await buscar.mutateAsync(mes);

      if (espelho.linhas.length === 0) {
        onErro(`Não há OS lançadas em ${nomeMes} para exportar.`);
        return;
      }

      if (formato === "csv") {
        baixarArquivo(`espelho-${mes}.csv`, csvEspelho(espelho.linhas), "text/csv;charset=utf-8");
      } else {
        imprimirHtml(htmlEspelho(espelho));
      }
    } catch (erro) {
      onErro(mensagemDoErro(erro, "Não foi possível gerar o espelho."));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Espelho de {nomeMes}:</span>
      <button type="button" className={botao} disabled={ocupado !== null} onClick={() => exportar("csv")}>
        {ocupado === "csv" ? "Gerando..." : "Baixar Excel (CSV)"}
      </button>
      <button type="button" className={botao} disabled={ocupado !== null} onClick={() => exportar("pdf")}>
        {ocupado === "pdf" ? "Gerando..." : "Imprimir / salvar PDF"}
      </button>
    </div>
  );
}
