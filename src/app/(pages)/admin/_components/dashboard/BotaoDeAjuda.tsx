"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TbHelp, TbX } from "react-icons/tb";
import Tooltip from "@/components/tooltip";
import type { Ajuda } from "./ajudas";

const FOCAVEIS = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

const botaoDoCabecalho =
  "flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 outline-none transition hover:bg-slate-100 hover:text-[#0f3d63] focus-visible:ring-2 focus-visible:ring-[#0f3d63] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 dark:hover:text-cyan-300";

type DialogoProps = { ajuda: Ajuda; idTitulo: string; onFechar: () => void };

// Janela com o resumo do card. Vai para o <body> (portal), então o card não a corta.
// Fecha só pelo X, pelo "Entendi" ou pelo Esc: clicar FORA dela não fecha (o fundo escurecido
// só impede o clique no resto da página). O Tab fica preso dentro dela e a rolagem da página
// trava enquanto ela está aberta.
function Dialogo({ ajuda, idTitulo, onFechar }: DialogoProps) {
  const painel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    painel.current?.querySelector<HTMLElement>("[data-fechar]")?.focus();

    const rolagem = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onFechar();
        return;
      }
      if (e.key !== "Tab" || !painel.current) return;

      const itens = Array.from(painel.current.querySelectorAll<HTMLElement>(FOCAVEIS));
      if (itens.length === 0) return;

      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];

      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    }

    document.addEventListener("keydown", aoTeclar);

    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = rolagem;
    };
  }, [onFechar]);

  const titulosDeSecao = "text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400";
  const lista = "mt-1.5 flex list-disc flex-col gap-1.5 pl-5 text-sm font-medium leading-snug text-slate-700 dark:text-slate-200";

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 p-4 motion-safe:animate-modal-fade">
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl motion-safe:animate-modal-rise dark:border-slate-700 dark:bg-slate-800"
      >
        <header className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <p className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">Como funciona este card</p>
            <h2 id={idTitulo} className="text-lg font-extrabold text-slate-800 dark:text-white">
              {ajuda.titulo}
            </h2>
          </div>
          <button
            type="button"
            data-fechar
            aria-label="Fechar"
            onClick={onFechar}
            className="cursor-pointer rounded-full p-1 text-slate-500 outline-none transition hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-[#0f3d63] dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <TbX aria-hidden size={20} />
          </button>
        </header>

        <section>
          <h3 className={titulosDeSecao}>Para que serve</h3>
          <p className="mt-1.5 text-sm font-medium leading-snug text-slate-700 dark:text-slate-200">{ajuda.paraQueServe}</p>
        </section>

        <section>
          <h3 className={titulosDeSecao}>O que mostra</h3>
          <ul className={lista}>
            {ajuda.oQueMostra.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className={titulosDeSecao}>Como ler</h3>
          <ul className={lista}>
            {ajuda.comoLer.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>

        <footer className="flex justify-end">
          <button
            type="button"
            onClick={onFechar}
            className="cursor-pointer rounded-md border border-blue-900 bg-gradient-to-br from-blue-600 to-blue-700 px-5 py-1.5 text-sm font-medium text-white outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#0f3d63] active:scale-95"
          >
            Entendi
          </button>
        </footer>
      </div>
    </div>
  );
}

// Botão "?" do cabeçalho do card: abre o resumo (para que serve, o que mostra, como ler).
export default function BotaoDeAjuda({ ajuda }: { ajuda: Ajuda }) {
  const [aberto, setAberto] = useState(false);
  const gatilho = useRef<HTMLButtonElement>(null);
  const idTitulo = useId();

  // ao fechar, o foco volta para o "?" (quem navega pelo teclado não se perde)
  const fechar = useCallback(() => {
    setAberto(false);
    gatilho.current?.focus();
  }, []);

  return (
    <>
      <Tooltip content="Como funciona este card">
        <button
          ref={gatilho}
          type="button"
          aria-label={`Como funciona: ${ajuda.titulo}`}
          aria-haspopup="dialog"
          aria-expanded={aberto}
          onClick={() => setAberto(true)}
          className={botaoDoCabecalho}
        >
          <TbHelp aria-hidden size={18} />
        </button>
      </Tooltip>
      {aberto && createPortal(<Dialogo ajuda={ajuda} idTitulo={idTitulo} onFechar={fechar} />, document.body)}
    </>
  );
}
