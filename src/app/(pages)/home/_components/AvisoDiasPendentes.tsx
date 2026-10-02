"use client";

import { useState } from "react";
import { usePendentes } from "@/hooks/queries/leituras";

type Props = {
  // abre o apontamento no dia mais antigo pendente
  onApontarEm: (data: string) => void;
  onVerPainel: () => void;
};

const MAX_DIAS_MOSTRADOS = 5;

const dia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const botao =
  "rounded-md border border-amber-800 dark:border-amber-300 px-3 py-1 text-xs font-semibold text-amber-900 dark:text-amber-200 cursor-pointer transition hover:bg-amber-100 dark:hover:bg-amber-900/50 outline-none focus-visible:ring-2 focus-visible:ring-amber-600";

// "Dispensar" vale até recarregar a página (trocar de aba da Home remonta o
// componente, e o aviso não deve voltar na hora).
let dispensadoNaSessao = false;

// Faixa da Home: lembra dos dias úteis recentes sem apontamento. O dado (leve,
// /api/painel/pendentes) fica em cache e é atualizado quando um apontamento é
// gravado ou excluído. Falha de rede não aparece: o aviso é só um lembrete.
export default function AvisoDiasPendentes({ onApontarEm, onVerPainel }: Props) {
  const { data } = usePendentes();
  const [dispensado, setDispensado] = useState(dispensadoNaSessao);
  const dias = data && Array.isArray(data.dias) ? data.dias : [];

  if (dispensado || dias.length === 0) return null;

  const mostrados = dias.slice(0, MAX_DIAS_MOSTRADOS).map(dia).join(", ");
  const restantes = dias.length - MAX_DIAS_MOSTRADOS;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 w-full max-w-xl mx-auto rounded-xl border border-amber-700 dark:border-amber-400 bg-amber-50 dark:bg-amber-950/40 px-4 py-2.5"
    >
      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
        {dias.length === 1 ? "Você tem 1 dia útil sem apontamento" : `Você tem ${dias.length} dias úteis sem apontamento`}
        : {mostrados}
        {restantes > 0 && ` e mais ${restantes}`}.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={botao} onClick={() => onApontarEm(dias[0])}>
          Apontar em {dia(dias[0])}
        </button>
        <button type="button" className={botao} onClick={onVerPainel}>
          Ver no painel
        </button>
        <button
          type="button"
          className={botao}
          onClick={() => {
            dispensadoNaSessao = true;
            setDispensado(true);
          }}
          aria-label="Dispensar aviso"
        >
          Dispensar
        </button>
      </div>
    </div>
  );
}
