import { useState } from "react";
import { TbX } from "react-icons/tb";
import { useAlertStore } from "@/stores/alert-store";

type ModalType = {
  children: React.ReactNode;
  isOpen: boolean;
  setOpenModal: (open: boolean) => void;
  title: string;
  actionText?: string | undefined;
  action?: Function | undefined;
  // Quando true, o botão de ação fica desabilitado (ex: campos obrigatórios
  // ainda não preenchidos) -- não abre confirmação nem executa `action`.
  isActionDisabled?: boolean;
  // Mensagem específica da confirmação -- quando omitida, usa o texto
  // genérico baseado em `actionText`.
  confirmMessage?: string;
};

export default function Modal({
  children,
  isOpen,
  setOpenModal,
  title,
  actionText,
  action,
  isActionDisabled,
  confirmMessage,
}: ModalType) {
  const [showModal, setShowModal] = useState(isOpen);

  async function handleAction() {
    const confirmado = await useAlertStore
      .getState()
      .showConfirm(
        confirmMessage ??
          `Deseja realmente ${(actionText ?? "confirmar").toLowerCase()}?`,
        { confirmText: actionText ?? "Confirmar", cancelText: "Cancelar" },
      );

    if (!confirmado) return;

    (action as any)?.();
  }

  return (
    <>
      {showModal ? (
        <>
          <div
            className="justify-center items-center flex fixed inset-0 z-50 outline-none focus:outline-none p-4"
            onClick={() => setOpenModal(false)}
          >
            <div
              className="relative w-full max-w-[900px]"
              onClick={(e) => e.stopPropagation()}
            >
              {/*content*/}
              <div className="border-0 rounded-2xl shadow-xl relative flex flex-col w-full bg-white dark:bg-slate-800 outline-none focus:outline-none mx-auto">
                {/*header*/}
                <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {title}
                  </h3>
                  <button
                    className="p-1.5 rounded-full text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors outline-none focus:outline-none"
                    onClick={() => setOpenModal(false)}
                    aria-label="Fechar"
                  >
                    <TbX size={20} className="depth-icon" />
                  </button>
                </div>
                {/*body*/}
                <div className="relative p-6 flex-auto max-h-[60vh] overflow-y-auto text-slate-700 dark:text-slate-200">
                  {children}
                </div>
                {/*footer*/}
                <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
                  <button
                    className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-200 rounded-md border border-slate-400 dark:border-slate-600 bg-gradient-to-br from-white to-slate-100 dark:from-slate-700 dark:to-slate-800 depth-btn-soft transition-all hover:-translate-y-0.5 active:scale-95 outline-none focus:outline-none"
                    type="button"
                    onClick={() => setOpenModal(false)}
                  >
                    Fechar
                  </button>

                  {action && (
                    <button
                      className="bg-[#0f3d63] text-white font-semibold text-sm px-5 py-2 rounded-lg depth-btn transition-all hover:bg-[#0c3252] hover:-translate-y-0.5 active:scale-95 outline-none focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:active:scale-100"
                      type="button"
                      disabled={isActionDisabled}
                      onClick={handleAction}
                    >
                      {actionText ? actionText : "Confirmar"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"></div>
        </>
      ) : null}
    </>
  );
}
