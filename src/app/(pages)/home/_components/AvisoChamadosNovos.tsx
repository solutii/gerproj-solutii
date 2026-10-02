"use client";

import { useEffect, useRef, useState } from "react";
import { useChamados } from "@/hooks/queries/leituras";
import { chamadosNovos, textoChamadosNovos } from "@/utils/chamados-novos";
import type { ChamadosType } from "@/types/chamados";

type Props = {
  // leva o consultor à lista de chamados
  onVer: () => void;
};

const botao =
  "rounded-md border border-sky-800 dark:border-sky-300 px-3 py-1 text-xs font-semibold text-sky-900 dark:text-sky-200 cursor-pointer transition hover:bg-sky-100 dark:hover:bg-sky-900/50 outline-none focus-visible:ring-2 focus-visible:ring-sky-600";

// Faixa da Home: avisa quando chega um chamado novo. A lista de chamados é
// conferida de tempos em tempos (só com a aba visível, ver useChamados); a
// primeira lista carregada é a base, então abrir a Home nunca "avisa" dos
// chamados que já estavam lá.
export default function AvisoChamadosNovos({ onVer }: Props) {
  const { data } = useChamados();
  const conhecidos = useRef<Set<number> | null>(null);
  const [novos, setNovos] = useState<ChamadosType[]>([]);

  useEffect(() => {
    if (!data) return;

    if (conhecidos.current === null) {
      conhecidos.current = new Set(data.map((c) => c.COD_CHAMADO));
      return;
    }

    const achados = chamadosNovos(conhecidos.current, data);
    if (achados.length === 0) return;

    for (const c of achados) conhecidos.current.add(c.COD_CHAMADO);
    setNovos((anteriores) => [...anteriores, ...achados]);
  }, [data]);

  if (novos.length === 0) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 w-full max-w-xl mx-auto rounded-xl border border-sky-700 dark:border-sky-400 bg-sky-50 dark:bg-sky-950/40 px-4 py-2.5"
    >
      <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">{textoChamadosNovos(novos)}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={botao}
          onClick={() => {
            onVer();
            setNovos([]);
          }}
        >
          Ver chamados
        </button>
        <button type="button" className={botao} onClick={() => setNovos([])} aria-label="Dispensar aviso de chamado novo">
          Dispensar
        </button>
      </div>
    </div>
  );
}
