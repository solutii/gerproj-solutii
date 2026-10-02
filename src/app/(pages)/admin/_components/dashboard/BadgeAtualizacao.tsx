"use client";

import { useEffect, useState } from "react";
import { TbRefresh } from "react-icons/tb";
import Tooltip from "@/components/tooltip";
import { INTERVALO_DO_DASHBOARD_MS } from "@/hooks/queries/admin";
import { horaDeBrasilia, textoDeFalta, textoDeIdade } from "@/utils/admin-dashboard";

type Props = {
  // instante (ISO) em que os números mostrados foram calculados; indefinido enquanto carrega
  geradoEm?: string;
  // instante (ms) da última busca concluída: dele se conta o tempo até a próxima atualização
  ultimaBuscaEm?: number | null;
  // buscando agora (automático ou pelo clique)
  atualizando: boolean;
  // a última tentativa falhou, mas ainda há números antigos na tela
  falhou: boolean;
  onAtualizar: () => void;
};

type Aparencia = { pilula: string; ponto: string; barra: string; pulsar: boolean };

const APARENCIAS: Record<"ok" | "buscando" | "falha", Aparencia> = {
  ok: {
    pilula: "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-950/50 dark:text-emerald-100 dark:hover:bg-emerald-900/50",
    ponto: "bg-emerald-500 dark:bg-emerald-400",
    barra: "bg-emerald-500 dark:bg-emerald-400",
    pulsar: true,
  },
  buscando: {
    pilula: "border-cyan-300 bg-cyan-50 text-cyan-900 dark:border-cyan-500/40 dark:bg-cyan-950/50 dark:text-cyan-100",
    ponto: "bg-cyan-500 dark:bg-cyan-400",
    barra: "bg-cyan-500 dark:bg-cyan-400",
    pulsar: false,
  },
  falha: {
    pilula: "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-100 dark:hover:bg-amber-900/50",
    ponto: "bg-amber-500 dark:bg-amber-400",
    barra: "bg-amber-500 dark:bg-amber-400",
    pulsar: false,
  },
};

// Barra que enche DEVAGAR e CONTINUAMENTE: a largura é exatamente (tempo desde a última busca)
// / (intervalo de 5 minutos). O relógio é só dela e bate 4 vezes por segundo, então cada passo
// é minúsculo (0,08% ≈ 0,1 px) e a animação de 300 ms só suaviza, sem dar "pulos".
const TIQUE_DA_BARRA_MS = 250;

export function progressoDaBarra(ultimaBuscaEm: number | null, agora: number, intervaloMs: number = INTERVALO_DO_DASHBOARD_MS): number {
  if (ultimaBuscaEm === null) return 0;

  const decorrido = Math.min(intervaloMs, Math.max(0, agora - ultimaBuscaEm));

  return (decorrido / intervaloMs) * 100;
}

function BarraDaProximaAtualizacao({ ultimaBuscaEm, atualizando, cor }: { ultimaBuscaEm: number | null; atualizando: boolean; cor: string }) {
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    if (atualizando) return; // durante a busca a barra fica cheia: não precisa de relógio

    const relogio = window.setInterval(() => setAgora(Date.now()), TIQUE_DA_BARRA_MS);

    return () => window.clearInterval(relogio);
  }, [atualizando]);

  const progresso = atualizando ? 100 : progressoDaBarra(ultimaBuscaEm, agora);

  return (
    <span aria-hidden data-barra-progresso={Math.round(progresso)} className="absolute inset-x-7 bottom-[5px] h-[3px] overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
      <span
        className={`block h-full rounded-full ${cor} ${atualizando ? "motion-safe:animate-pulse" : "transition-[width] duration-300 ease-linear motion-reduce:transition-none"}`}
        style={{ width: `${Number(progresso.toFixed(2))}%` }}
      />
    </span>
  );
}

// Selo do cabeçalho: diz quando o dashboard foi atualizado pela última vez, mostra quanto
// falta para a próxima atualização automática (barra na base do selo) e, ao clicar,
// atualiza na hora. Os textos e a barra se renovam sozinhos (a cada segundo).
export default function BadgeAtualizacao({ geradoEm, ultimaBuscaEm = null, atualizando, falhou, onAtualizar }: Props) {
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const relogio = window.setInterval(() => setAgora(Date.now()), 1000);

    return () => window.clearInterval(relogio);
  }, []);

  const hora = geradoEm ? horaDeBrasilia(geradoEm) : "";
  const estado = atualizando ? "buscando" : falhou ? "falha" : "ok";
  const { pilula, ponto, barra, pulsar } = APARENCIAS[estado];

  const decorrido = ultimaBuscaEm === null ? 0 : Math.min(INTERVALO_DO_DASHBOARD_MS, Math.max(0, agora - ultimaBuscaEm));
  const falta = textoDeFalta(INTERVALO_DO_DASHBOARD_MS - decorrido);

  const principal = !geradoEm && atualizando
    ? "Carregando..."
    : atualizando
      ? "Atualizando..."
      : falhou
        ? "Falha ao atualizar"
        : geradoEm
          ? `Atualizado ${textoDeIdade(geradoEm, agora)}`
          : "Aguardando dados";
  const secundario = falhou
    ? `Última atualização às ${hora}. Clique para tentar de novo`
    : hora
      ? `às ${hora} · próxima atualização ${falta}`
      : "";

  return (
    <Tooltip content={falhou ? "Clique para tentar atualizar de novo" : "Clique para atualizar agora"}>
      <button
        type="button"
        onClick={onAtualizar}
        disabled={atualizando}
        aria-label={`${principal}${secundario ? `. ${secundario}` : ""}. Clique para atualizar agora.`}
        className={`group relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-full border pb-3 pl-3.5 pr-3 pt-1.5 text-left shadow-sm outline-none transition hover:-translate-y-0.5 active:scale-95 focus-visible:ring-2 focus-visible:ring-[#0f3d63] disabled:cursor-progress disabled:hover:translate-y-0 ${pilula}`}
      >
        <span aria-hidden className="relative flex h-2.5 w-2.5 shrink-0">
          {pulsar && <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping ${ponto}`} />}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${ponto}`} />
        </span>

        <span className="flex flex-col leading-tight">
          <span className="text-sm font-bold" aria-live="polite">
            {principal}
          </span>
          {secundario && <span className="text-[11px] font-medium opacity-80">{secundario}</span>}
        </span>

        <TbRefresh aria-hidden size={20} className={`shrink-0 opacity-80 transition group-hover:opacity-100 ${atualizando ? "motion-safe:animate-spin" : "group-hover:rotate-90"}`} />

        {/* barra na base do selo (afastada da borda): enche até a próxima atualização; durante a busca fica cheia e pulsando */}
        <BarraDaProximaAtualizacao ultimaBuscaEm={ultimaBuscaEm} atualizando={atualizando} cor={barra} />
      </button>
    </Tooltip>
  );
}
