"use client";

import { useAlertStore, type AlertType } from "@/stores/alert-store";
import {
  TbAlertTriangle,
  TbCircleCheck,
  TbCircleX,
  TbInfoCircle,
} from "react-icons/tb";

const ICONS: Record<AlertType, React.ReactNode> = {
  warning: <TbAlertTriangle size={24} className="depth-icon" />,
  error: <TbCircleX size={24} className="depth-icon" />,
  success: <TbCircleCheck size={24} className="depth-icon" />,
  info: <TbInfoCircle size={24} className="depth-icon" />,
};

const ICON_STYLES: Record<AlertType, string> = {
  warning: "bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400",
  error: "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400",
  success: "bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400",
  info: "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400",
};

// Diálogo global que substitui os `alert()` nativos e o SweetAlert2 --
// montado uma única vez no layout raiz, lendo/escrevendo direto na store
// (mesmo padrão do ThemeInitializer). Qualquer parte da aplicação dispara um
// aviso com `showAlert(mensagem)`, pede uma confirmação (Promise<boolean>)
// com `showConfirm(mensagem)`, ou apresenta uma escolha entre opções
// (Promise<string | null>) com `showChoice(titulo, opcoes)`.
export default function AlertDialog() {
  const {
    isOpen,
    mode,
    title,
    message,
    type,
    confirmText,
    cancelText,
    options,
    selectedOptionId,
    closeAlert,
    confirm,
    selectOption,
    confirmChoice,
  } = useAlertStore();

  if (!isOpen) return null;

  const isChoice = mode === "choice";

  const handleBackdropClose = () => {
    if (mode === "confirm") {
      confirm(false);
    } else {
      closeAlert();
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        role="alertdialog"
        aria-modal="true"
        onClick={handleBackdropClose}
      >
        <div
          className={`relative w-full rounded-2xl shadow-xl bg-white dark:bg-slate-800 ${isChoice ? "max-w-lg" : "max-w-sm"}`}
          onClick={(e) => e.stopPropagation()}
        >
          {isChoice ? (
            <div className="flex flex-col gap-4 p-6">
              <div className="flex items-start gap-3">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${ICON_STYLES[type]}`}
                >
                  {ICONS[type]}
                </div>
                <div className="flex flex-col gap-1 pt-1.5">
                  {title && (
                    <p className="text-base font-bold text-slate-800 dark:text-slate-100">
                      {title}
                    </p>
                  )}
                  {message && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {options.map((option) => (
                  <label
                    key={option.id}
                    className={
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors " +
                      (selectedOptionId === option.id
                        ? "border-[#0f3d63] bg-[#0f3d63]/5 dark:bg-cyan-950/40 dark:border-cyan-500"
                        : "border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50")
                    }
                  >
                    <input
                      type="radio"
                      name="alert-dialog-choice"
                      checked={selectedOptionId === option.id}
                      onChange={() => selectOption(option.id)}
                      className="w-4 h-4 accent-[#0f3d63] shrink-0"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-200">
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 p-6 text-center">
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-full ${ICON_STYLES[type]}`}
              >
                {ICONS[type]}
              </div>
              {title && (
                <p className="text-base font-bold text-slate-800 dark:text-slate-100">
                  {title}
                </p>
              )}
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {message}
              </p>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
            {(mode === "confirm" || isChoice) && (
              <button
                type="button"
                onClick={() => (isChoice ? closeAlert() : confirm(false))}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-200 rounded-md border border-slate-400 dark:border-slate-600 bg-gradient-to-br from-white to-slate-100 dark:from-slate-700 dark:to-slate-800 depth-btn-soft transition-all hover:-translate-y-0.5 active:scale-95 outline-none focus:outline-none"
              >
                {cancelText}
              </button>
            )}
            <button
              type="button"
              autoFocus={!isChoice}
              disabled={isChoice && !selectedOptionId}
              onClick={() => {
                if (isChoice) confirmChoice();
                else if (mode === "confirm") confirm(true);
                else closeAlert();
              }}
              className="bg-[#0f3d63] text-white font-semibold text-sm px-6 py-2 rounded-lg depth-btn transition-all hover:bg-[#0c3252] hover:-translate-y-0.5 active:scale-95 outline-none focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:active:scale-100"
            >
              {mode === "confirm" || isChoice ? confirmText : "OK"}
            </button>
          </div>
        </div>
      </div>
      <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm" />
    </>
  );
}
