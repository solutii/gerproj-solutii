"use client";

import type { ReactNode } from "react";
import { TbCheck, TbX } from "react-icons/tb";
import type { IconType } from "react-icons";
import { useAlertStore } from "@/stores/alert-store";

type Props = {
  title: string;
  subtitle?: string;
  icon: IconType;
  onClose: () => void;
  action: () => void;
  isActionDisabled?: boolean;
  confirmMessage: string;
  children: ReactNode;
};

// Layout dos 3 modais de apontamento (Apontamento, Standby e Editar OS):
// cabeçalho azul com ícone + título/subtítulo, corpo em cinza e rodapé com os
// botões. O <Modal> genérico continua sendo usado pelos demais modais do app.
export default function ApontamentoModalLayout({
  title,
  subtitle,
  icon: Icon,
  onClose,
  action,
  isActionDisabled,
  confirmMessage,
  children,
}: Props) {
  async function handleAction() {
    const confirmado = await useAlertStore
      .getState()
      .showConfirm(confirmMessage, {
        confirmText: "Confirmar",
        cancelText: "Cancelar",
      });

    if (!confirmado) return;

    action();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-modal-fade motion-reduce:animate-none"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex w-full max-w-[900px] max-h-[95vh] flex-col overflow-hidden rounded-xl bg-stone-200 dark:bg-slate-900 shadow-2xl animate-modal-rise motion-reduce:animate-none"
      >
        {/* header */}
        <header className="flex flex-shrink-0 items-center justify-between bg-[#0f3d63] px-5 py-4 shadow-md shadow-black/50">
          <div className="flex items-center gap-4 text-white select-none">
            <Icon
              className="flex-shrink-0 depth-icon"
              size={44}
            />
            <div className="flex flex-col gap-0.5">
              <h3 className="text-xl font-medium uppercase tracking-widest">
                {title}
              </h3>
              {subtitle && (
                <p className="text-sm font-medium tracking-wider text-cyan-100 dark:text-white">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className={`flex-shrink-0 rounded-md border border-red-800 bg-gradient-to-br from-red-600 to-red-700 p-1 text-white depth-btn transition-all duration-200 hover:scale-110 hover:from-red-500 hover:to-red-600 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-white`}
          >
            <TbX size={26} className="depth-icon" />
          </button>
        </header>

        {/* body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 text-slate-800 dark:text-white font-medium">
          {children}
        </div>

        {/* footer */}
        <footer className="flex flex-shrink-0 items-center justify-end gap-3 border-t border-stone-300 dark:border-slate-700 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-400 dark:border-slate-600 bg-gradient-to-br from-white to-slate-100 dark:from-slate-700 dark:to-slate-800 depth-btn-soft px-5 py-2 text-sm font-medium tracking-widest text-slate-700 dark:text-white transition-all duration-200 hover:-translate-y-0.5 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-[#0f3d63]"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={isActionDisabled}
            onClick={handleAction}
            className={`flex items-center gap-2 rounded-md border border-blue-900 bg-gradient-to-br from-blue-600 to-blue-700 px-6 py-2 text-sm font-medium tracking-widest text-white depth-btn transition-all duration-200 hover:-translate-y-0.5 hover:from-blue-500 hover:to-blue-600 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:scale-100`}
          >
            <TbCheck size={20} className="depth-icon" />
            Confirmar
          </button>
        </footer>
      </div>
    </div>
  );
}
